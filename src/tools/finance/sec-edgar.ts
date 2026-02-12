import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { describeRequest, readCache, writeCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const SEC_DATA_BASE_URL = 'https://data.sec.gov';
const SEC_TICKER_MAPPING_URL = 'https://www.sec.gov/files/company_tickers.json';
const SEC_ARCHIVES_BASE_URL = 'https://www.sec.gov/Archives/edgar/data';

type CacheableParamValue = string | number | string[] | undefined;

interface SecApiResponse<T> {
  data: T;
  url: string;
}

interface SecTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

interface SecRecentFilings {
  accessionNumber?: string[];
  filingDate?: string[];
  reportDate?: (string | null)[];
  acceptanceDateTime?: (string | null)[];
  form?: string[];
  primaryDocument?: string[];
  primaryDocDescription?: (string | null)[];
  fileNumber?: (string | null)[];
  items?: (string | null)[];
}

interface SecSubmissionResponse {
  cik?: string;
  ticker?: string;
  name?: string;
  entityType?: string;
  fiscalYearEnd?: string;
  filings?: {
    recent?: SecRecentFilings;
  };
}

function getSecUserAgent(): string {
  const userAgent = process.env.SEC_EDGAR_USER_AGENT?.trim();
  if (userAgent) {
    return userAgent;
  }
  return 'dexter-ts/1.0 (financial research app; contact: support@example.com)';
}

function normalizeCik(cik: string | number): string {
  const digitsOnly = String(cik).replace(/\D/g, '');
  if (!digitsOnly) {
    throw new Error(`Invalid CIK: ${cik}`);
  }
  return digitsOnly.padStart(10, '0');
}

function asCikNumber(cik: string): string {
  return String(Number.parseInt(cik, 10));
}

function requireTickerOrCik(ticker?: string, cik?: string): void {
  if (!ticker && !cik) {
    throw new Error('Either ticker or cik must be provided.');
  }
}

async function callSecJson<T>(
  url: string,
  endpoint: string,
  params: Record<string, CacheableParamValue>,
  options?: { cacheable?: boolean }
): Promise<SecApiResponse<T>> {
  const label = describeRequest(endpoint, params);

  if (options?.cacheable) {
    const cached = readCache(endpoint, params);
    if (cached) {
      return { data: cached.data as T, url: cached.url };
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': getSecUserAgent(),
        Accept: 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[SEC EDGAR] network error: ${label} — ${message}`);
    throw new Error(`[SEC EDGAR] request failed for ${label}: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[SEC EDGAR] error: ${label} — ${detail}`);
    throw new Error(`[SEC EDGAR] request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[SEC EDGAR] parse error: ${label} — ${detail}`);
    throw new Error(`[SEC EDGAR] request failed: ${detail}`);
  });

  if (options?.cacheable && typeof data === 'object' && data !== null) {
    writeCache(endpoint, params, data as Record<string, unknown>, url);
  }

  return { data: data as T, url };
}

async function getTickerEntries(): Promise<{ entries: SecTickerEntry[]; url: string }> {
  const { data, url } = await callSecJson<Record<string, SecTickerEntry>>(
    SEC_TICKER_MAPPING_URL,
    '/sec/company_tickers',
    {},
    { cacheable: true }
  );
  return { entries: Object.values(data), url };
}

async function resolveCikFromInputs(input: {
  ticker?: string;
  cik?: string;
}): Promise<{ cik: string; resolvedTicker?: string; companyName?: string; sourceUrls: string[] }> {
  if (input.cik) {
    return { cik: normalizeCik(input.cik), sourceUrls: [] };
  }

  const ticker = input.ticker?.trim().toUpperCase();
  if (!ticker) {
    throw new Error('Ticker is required when cik is not provided.');
  }

  const { entries, url } = await getTickerEntries();
  const match = entries.find((entry) => entry.ticker.toUpperCase() === ticker);
  if (!match) {
    throw new Error(`Unable to resolve ticker '${ticker}' to a SEC CIK.`);
  }

  return {
    cik: normalizeCik(match.cik_str),
    resolvedTicker: match.ticker,
    companyName: match.title,
    sourceUrls: [url],
  };
}

function buildRecentFilings(
  submissions: SecSubmissionResponse,
  cik: string,
  limit: number,
  formTypes?: string[]
): Array<Record<string, unknown>> {
  const recent = submissions.filings?.recent;
  if (!recent?.accessionNumber?.length) {
    return [];
  }

  const accessionNumbers = recent.accessionNumber;
  const forms = recent.form ?? [];
  const filingDates = recent.filingDate ?? [];
  const reportDates = recent.reportDate ?? [];
  const acceptanceTimes = recent.acceptanceDateTime ?? [];
  const primaryDocuments = recent.primaryDocument ?? [];
  const primaryDocDescriptions = recent.primaryDocDescription ?? [];
  const fileNumbers = recent.fileNumber ?? [];
  const items = recent.items ?? [];

  const upperFormTypes = new Set((formTypes ?? []).map((form) => form.toUpperCase()));
  const hasFormFilter = upperFormTypes.size > 0;

  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < accessionNumbers.length; i += 1) {
    const accessionNumber = accessionNumbers[i];
    const form = forms[i] ?? null;
    if (!accessionNumber) {
      continue;
    }
    if (hasFormFilter && (!form || !upperFormTypes.has(form.toUpperCase()))) {
      continue;
    }

    const accessionNumberNoDash = accessionNumber.replace(/-/g, '');
    const cikNum = asCikNumber(cik);
    const filingDir = `${SEC_ARCHIVES_BASE_URL}/${cikNum}/${accessionNumberNoDash}`;
    const primaryDocument = primaryDocuments[i] ?? null;

    rows.push({
      accession_number: accessionNumber,
      form,
      filing_date: filingDates[i] ?? null,
      report_date: reportDates[i] ?? null,
      acceptance_datetime: acceptanceTimes[i] ?? null,
      file_number: fileNumbers[i] ?? null,
      items: items[i] ?? null,
      primary_document: primaryDocument,
      primary_document_description: primaryDocDescriptions[i] ?? null,
      filing_index_url: `${filingDir}/${accessionNumber}-index.html`,
      primary_document_url: primaryDocument ? `${filingDir}/${primaryDocument}` : null,
    });

    if (rows.length >= limit) {
      break;
    }
  }

  return rows;
}

const ResolveSecCikInputSchema = z.object({
  ticker: z.string().describe("Stock ticker symbol, for example 'AAPL'."),
});

export const resolveSecCik = new DynamicStructuredTool({
  name: 'resolve_sec_cik',
  description:
    'Resolves a stock ticker to its official SEC CIK (10-digit, zero-padded). Use before calling SEC EDGAR company submissions or company facts endpoints.',
  schema: ResolveSecCikInputSchema,
  func: async (input) => {
    const { cik, resolvedTicker, companyName, sourceUrls } = await resolveCikFromInputs({
      ticker: input.ticker,
    });
    return formatToolResult(
      {
        ticker: resolvedTicker ?? input.ticker.toUpperCase(),
        company_name: companyName ?? null,
        cik,
        cik_number: asCikNumber(cik),
      },
      sourceUrls
    );
  },
});

const SecSubmissionsInputSchema = z.object({
  ticker: z
    .string()
    .optional()
    .describe("Optional stock ticker symbol, for example 'AAPL'. Provide ticker or cik."),
  cik: z
    .string()
    .optional()
    .describe("Optional SEC CIK (digits or zero-padded). Provide cik or ticker."),
  form_types: z
    .array(z.string())
    .optional()
    .describe("Optional SEC form filter, for example ['10-K', '10-Q', '8-K']."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(40)
    .describe('Maximum number of filings to return from recent filings (default: 40).'),
});

export const getSecSubmissions = new DynamicStructuredTool({
  name: 'get_sec_submissions',
  description:
    'Retrieves official SEC EDGAR company submissions (recent filings metadata) from data.sec.gov for a ticker or CIK.',
  schema: SecSubmissionsInputSchema,
  func: async (input) => {
    requireTickerOrCik(input.ticker, input.cik);
    const resolved = await resolveCikFromInputs({ ticker: input.ticker, cik: input.cik });

    const submissionsUrl = `${SEC_DATA_BASE_URL}/submissions/CIK${resolved.cik}.json`;
    const { data, url } = await callSecJson<SecSubmissionResponse>(
      submissionsUrl,
      '/sec/submissions',
      { cik: resolved.cik },
      { cacheable: true }
    );

    const filings = buildRecentFilings(data, resolved.cik, input.limit, input.form_types);
    const result = {
      company: {
        cik: resolved.cik,
        cik_number: asCikNumber(resolved.cik),
        ticker: data.ticker ?? resolved.resolvedTicker ?? input.ticker ?? null,
        name: data.name ?? resolved.companyName ?? null,
        entity_type: data.entityType ?? null,
        fiscal_year_end: data.fiscalYearEnd ?? null,
      },
      recent_filings: filings,
    };

    const sourceUrls = [...resolved.sourceUrls, url];
    return formatToolResult(result, sourceUrls);
  },
});

const SecCompanyFactsInputSchema = z.object({
  ticker: z
    .string()
    .optional()
    .describe("Optional stock ticker symbol, for example 'AAPL'. Provide ticker or cik."),
  cik: z
    .string()
    .optional()
    .describe("Optional SEC CIK (digits or zero-padded). Provide cik or ticker."),
  taxonomy: z
    .string()
    .optional()
    .describe(
      "Optional taxonomy for concept-level queries (for example 'us-gaap'). Required if tag is provided."
    ),
  tag: z
    .string()
    .optional()
    .describe(
      "Optional XBRL concept tag (for example 'RevenueFromContractWithCustomerExcludingAssessedTax'). If provided, fetches the concept endpoint."
    ),
  unit: z
    .string()
    .optional()
    .describe("Optional unit filter for concept data, for example 'USD' or 'shares'."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(40)
    .describe('Maximum datapoints to return for concept-level queries (default: 40).'),
});

export const getSecCompanyFacts = new DynamicStructuredTool({
  name: 'get_sec_company_facts',
  description:
    'Retrieves official SEC EDGAR XBRL company facts. Supports both full company fact summaries and concept-level history from data.sec.gov.',
  schema: SecCompanyFactsInputSchema,
  func: async (input) => {
    requireTickerOrCik(input.ticker, input.cik);
    if ((input.taxonomy && !input.tag) || (!input.taxonomy && input.tag)) {
      throw new Error('taxonomy and tag must be provided together for concept-level queries.');
    }

    const resolved = await resolveCikFromInputs({ ticker: input.ticker, cik: input.cik });

    if (input.tag) {
      const taxonomy = input.taxonomy!;
      const conceptUrl = `${SEC_DATA_BASE_URL}/api/xbrl/companyconcept/CIK${resolved.cik}/${taxonomy}/${input.tag}.json`;
      const { data, url } = await callSecJson<Record<string, unknown>>(
        conceptUrl,
        '/sec/companyconcept',
        { cik: resolved.cik, taxonomy, tag: input.tag },
        { cacheable: true }
      );

      const units = (data.units as Record<string, unknown[]> | undefined) ?? {};
      const availableUnits = Object.keys(units);
      const selectedUnit = input.unit && units[input.unit] ? input.unit : availableUnits[0];
      const observations = selectedUnit && Array.isArray(units[selectedUnit])
        ? [...units[selectedUnit]].slice(-input.limit)
        : [];

      const result = {
        cik: resolved.cik,
        cik_number: asCikNumber(resolved.cik),
        ticker: resolved.resolvedTicker ?? input.ticker ?? null,
        entity_name: data.entityName ?? null,
        taxonomy,
        tag: input.tag,
        unit: selectedUnit ?? null,
        available_units: availableUnits,
        observations,
      };

      return formatToolResult(result, [...resolved.sourceUrls, url]);
    }

    const companyFactsUrl = `${SEC_DATA_BASE_URL}/api/xbrl/companyfacts/CIK${resolved.cik}.json`;
    const { data, url } = await callSecJson<Record<string, unknown>>(
      companyFactsUrl,
      '/sec/companyfacts',
      { cik: resolved.cik },
      { cacheable: true }
    );

    const facts = (data.facts as Record<string, Record<string, unknown>> | undefined) ?? {};
    const taxonomySummary = Object.fromEntries(
      Object.entries(facts).map(([taxonomy, concepts]) => [taxonomy, Object.keys(concepts).length])
    );

    const result = {
      cik: resolved.cik,
      cik_number: asCikNumber(resolved.cik),
      ticker: resolved.resolvedTicker ?? input.ticker ?? null,
      entity_name: data.entityName ?? null,
      taxonomy_summary: taxonomySummary,
      available_taxonomies: Object.keys(facts),
    };

    return formatToolResult(result, [...resolved.sourceUrls, url]);
  },
});

const SecFilingUrlsInputSchema = z.object({
  ticker: z
    .string()
    .optional()
    .describe("Optional stock ticker symbol, for example 'AAPL'. Provide ticker or cik."),
  cik: z
    .string()
    .optional()
    .describe("Optional SEC CIK (digits or zero-padded). Provide cik or ticker."),
  accession_number: z
    .string()
    .describe("SEC accession number, for example '0000320193-24-000123'."),
  primary_document: z
    .string()
    .optional()
    .describe(
      "Optional primary document filename. If omitted, the tool attempts to resolve it from company submissions."
    ),
});

export const getSecFilingDocumentUrls = new DynamicStructuredTool({
  name: 'get_sec_filing_document_urls',
  description:
    'Builds canonical SEC filing index and primary document URLs for a given accession number. If primary_document is omitted, it resolves it from recent submissions.',
  schema: SecFilingUrlsInputSchema,
  func: async (input) => {
    requireTickerOrCik(input.ticker, input.cik);
    const resolved = await resolveCikFromInputs({ ticker: input.ticker, cik: input.cik });
    const accessionNumber = input.accession_number.trim();
    const accessionNoDash = accessionNumber.replace(/-/g, '');
    const filingBase = `${SEC_ARCHIVES_BASE_URL}/${asCikNumber(resolved.cik)}/${accessionNoDash}`;

    let primaryDocument = input.primary_document?.trim();
    const sourceUrls = [...resolved.sourceUrls];

    if (!primaryDocument) {
      const submissionsUrl = `${SEC_DATA_BASE_URL}/submissions/CIK${resolved.cik}.json`;
      const { data, url } = await callSecJson<SecSubmissionResponse>(
        submissionsUrl,
        '/sec/submissions',
        { cik: resolved.cik },
        { cacheable: true }
      );
      sourceUrls.push(url);

      const recent = data.filings?.recent;
      const idx = recent?.accessionNumber?.findIndex((value) => value === accessionNumber) ?? -1;
      if (idx >= 0) {
        primaryDocument = recent?.primaryDocument?.[idx] ?? undefined;
      }
    }

    const result = {
      cik: resolved.cik,
      cik_number: asCikNumber(resolved.cik),
      accession_number: accessionNumber,
      filing_index_url: `${filingBase}/${accessionNumber}-index.html`,
      primary_document: primaryDocument ?? null,
      primary_document_url: primaryDocument ? `${filingBase}/${primaryDocument}` : null,
    };

    return formatToolResult(result, sourceUrls);
  },
});

