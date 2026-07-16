import { logger } from '../../utils/logger.js';

/**
 * SEC EDGAR adapter (free, no API key required).
 *
 * Replaces Financial Datasets for SEC filing access:
 *   - /filings/         -> lists recent filings via the SEC submissions API
 *   - /filings/items/   -> fetches the filing's primary document and returns
 *                          best-effort plain-text content
 *
 * Requires a User-Agent per SEC policy.
 */

const SEC_HEADERS = {
  'User-Agent': 'dexter/1.0 (local research agent; mailto:dexter@example.com)',
};

let tickerCikCache: Record<string, number> | null = null;
let tickerCikPromise: Promise<Record<string, number>> | null = null;

async function loadTickerCikMap(): Promise<Record<string, number>> {
  if (tickerCikCache) return tickerCikCache;
  if (tickerCikPromise) return tickerCikPromise;
  tickerCikPromise = (async () => {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: SEC_HEADERS,
    });
    if (!res.ok) throw new Error(`SEC company_tickers.json ${res.status}`);
    const json = (await res.json()) as Record<string, { ticker: string; cik_str: string }>;
    const map: Record<string, number> = {};
    for (const v of Object.values(json)) {
      map[v.ticker.toUpperCase()] = parseInt(v.cik_str, 10);
    }
    tickerCikCache = map;
    return map;
  })();
  return tickerCikPromise;
}

async function cikForTicker(ticker: string): Promise<number> {
  const map = await loadTickerCikMap();
  const cik = map[ticker.toUpperCase()];
  if (!cik) throw new Error(`SEC EDGAR: unknown ticker ${ticker}`);
  return cik;
}

interface Submission {
  cik: number;
  filings: {
    recent: Array<{
      form: string;
      filingDate: string;
      accessionNumber: string;
      primaryDocument: string;
      primaryDocDescription?: string;
      items?: string;
    }>;
  };
}

async function getSubmissions(cik: number): Promise<Submission> {
  const padded = String(cik).padStart(10, '0');
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const res = await fetch(url, { headers: SEC_HEADERS });
  if (!res.ok) throw new Error(`SEC submissions ${res.status} for CIK ${padded}`);
  return (await res.json()) as Submission;
}

type FilingRow = {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
  primaryDocDescription?: string;
  items?: string;
};

/**
 * SEC returns `filings.recent` either as an array of objects (legacy) or as a
 * column-oriented dict of parallel arrays (current). Normalise to rows.
 */
function recentRows(sub: Submission): FilingRow[] {
  const recent = sub.filings.recent as unknown;
  if (Array.isArray(recent)) {
    return recent as FilingRow[];
  }
  if (recent && typeof recent === 'object') {
    const r = recent as Record<string, string[]>;
    const n = (r.form || []).length;
    const rows: FilingRow[] = [];
    for (let i = 0; i < n; i++) {
      rows.push({
        form: r.form?.[i],
        filingDate: r.filingDate?.[i],
        accessionNumber: r.accessionNumber?.[i],
        primaryDocument: r.primaryDocument?.[i],
        primaryDocDescription: r.primaryDocDescription?.[i],
        items: r.items?.[i],
      });
    }
    return rows;
  }
  return [];
}

function stripHtml(html: string): string {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n+/g, '\n');
  return text.trim();
}

async function listFilings(
  params: Record<string, string | number | string[] | undefined>,
): Promise<Record<string, unknown>> {
  const ticker = String(params.ticker || '').toUpperCase();
  const limit = typeof params.limit === 'number' ? params.limit : Number(params.limit) || 10;
  const types = Array.isArray(params.filing_type)
    ? (params.filing_type as string[])
    : params.filing_type
      ? [String(params.filing_type)]
      : [];

  const cik = await cikForTicker(ticker);
  const sub = await getSubmissions(cik);
  let rows = recentRows(sub);
  if (types.length > 0) {
    rows = rows.filter((r) => types.includes(r.form));
  }
  rows = rows.slice(0, limit);

  const filings = rows.map((r) => {
    const accessionNoDots = r.accessionNumber.replace(/-/g, '');
    return {
      ticker,
      filing_type: r.form,
      filing_date: r.filingDate,
      accession_number: r.accessionNumber,
      primary_document: r.primaryDocument,
      description: r.primaryDocDescription || '',
      document_url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDots}/${r.primaryDocument}`,
    };
  });

  return { filings };
}

async function getFilingItems(
  params: Record<string, string | number | string[] | undefined>,
): Promise<Record<string, unknown>> {
  const ticker = String(params.ticker || '').toUpperCase();
  const accessionNumber = String(params.accession_number || '');
  if (!accessionNumber) throw new Error('SEC EDGAR: accession_number is required');

  const cik = await cikForTicker(ticker);
  const sub = await getSubmissions(cik);
  const row = recentRows(sub).find((r) => r.accessionNumber === accessionNumber);
  if (!row) throw new Error(`SEC EDGAR: accession ${accessionNumber} not found for ${ticker}`);

  const accessionNoDots = accessionNumber.replace(/-/g, '');
  const docUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDots}/${row.primaryDocument}`;

  const res = await fetch(docUrl, { headers: SEC_HEADERS });
  if (!res.ok) throw new Error(`SEC document fetch ${res.status} for ${docUrl}`);
  const raw = await res.text();
  const content = stripHtml(raw);

  const items = params.item
    ? Array.isArray(params.item)
      ? (params.item as string[])
      : [String(params.item)]
    : [];

  return {
    filing_type: row.form,
    accession_number: accessionNumber,
    items_requested: items,
    content,
    note: 'Best-effort plain-text extraction of the full filing document. Item-level sectioning is not performed; the model should locate the requested sections within the text.',
    document_url: docUrl,
  };
}

export async function secEdgarRequest(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
): Promise<Record<string, unknown>> {
  try {
    if (endpoint === '/filings/' || endpoint.startsWith('/filings?')) {
      return await listFilings(params);
    }
    if (endpoint.startsWith('/filings/items')) {
      return await getFilingItems(params);
    }
    throw new Error(`[SEC EDGAR] unsupported endpoint: ${endpoint}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[SEC EDGAR] ${message}`);
    throw new Error(`[SEC EDGAR] ${message}`);
  }
}
