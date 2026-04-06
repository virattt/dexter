import { DOMParser } from 'linkedom';

const SEC_HEADERS = {
  'User-Agent': 'OpenClaw Dexter Free-US POC openclaw@example.invalid',
  'Accept-Encoding': 'gzip, deflate',
} as const;

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
} as const;

export interface PriceBar {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface FreeUsPriceSnapshot {
  ticker: string;
  currency?: string;
  exchange?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  latestBar?: PriceBar;
  recentBars: PriceBar[];
  sourceUrl: string;
}

export interface FreeUsFiling {
  form: string;
  filedAt: string;
  accessionNumber: string;
  primaryDocument: string;
  description?: string;
  secUrl: string;
}

export interface FinancialPoint {
  periodEnd?: string;
  filedAt?: string;
  fiscalYear?: number;
  fiscalPeriod?: string;
  form?: string;
  revenue?: number;
  netIncome?: number;
  operatingIncome?: number;
  operatingCashFlow?: number;
  assets?: number;
  cashAndEquivalents?: number;
}

export interface FreeUsFinancialSummary {
  ticker: string;
  companyName: string;
  cik: string;
  latestAnnual?: FinancialPoint;
  latestQuarterly?: FinancialPoint;
  sourceUrl: string;
}

export interface FreeUsNewsItem {
  title: string;
  link: string;
  publishedAt?: string;
  source?: string;
}

export interface FreeUsPocReport {
  ticker: string;
  companyName: string;
  cik: string;
  price: FreeUsPriceSnapshot;
  filings: FreeUsFiling[];
  financials: FreeUsFinancialSummary;
  news: FreeUsNewsItem[];
}

interface SecTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

interface CompanyFactsResponse {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, { units?: Record<string, SecFactValue[]> }>>;
}

interface SecFactValue {
  start?: string;
  end?: string;
  val: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
}

let secTickerMapPromise: Promise<Map<string, SecTickerEntry>> | null = null;

function toIsoDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.json() as Promise<T>;
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.text();
}

async function getSecTickerMap(): Promise<Map<string, SecTickerEntry>> {
  if (!secTickerMapPromise) {
    secTickerMapPromise = (async () => {
      const raw = await fetchJson<Record<string, SecTickerEntry>>(
        'https://www.sec.gov/files/company_tickers.json',
        { headers: SEC_HEADERS },
      );
      return new Map(Object.values(raw).map((entry) => [entry.ticker.toUpperCase(), entry]));
    })();
  }
  return secTickerMapPromise;
}

async function resolveSecCompany(ticker: string): Promise<{ cik: string; companyName: string }> {
  const upper = ticker.trim().toUpperCase();
  const map = await getSecTickerMap();
  const entry = map.get(upper);
  if (!entry) {
    throw new Error(`Ticker not found in SEC company_tickers.json: ${upper}`);
  }
  return {
    cik: String(entry.cik_str).padStart(10, '0'),
    companyName: entry.title,
  };
}

export async function getFreeUsPriceSnapshot(ticker: string): Promise<FreeUsPriceSnapshot> {
  const upper = ticker.trim().toUpperCase();
  const sourceUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${upper}?range=1mo&interval=1d&includePrePost=false&events=div%2Csplits`;
  const data = await fetchJson<any>(sourceUrl, { headers: YAHOO_HEADERS });
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo chart returned no result for ${upper}`);
  }

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const bars: PriceBar[] = timestamps.map((ts, index) => ({
    date: toIsoDate(ts),
    open: quote.open?.[index] ?? null,
    high: quote.high?.[index] ?? null,
    low: quote.low?.[index] ?? null,
    close: quote.close?.[index] ?? null,
    volume: quote.volume?.[index] ?? null,
  })).filter((bar) => bar.close !== null);

  return {
    ticker: upper,
    currency: result.meta?.currency,
    exchange: result.meta?.fullExchangeName ?? result.meta?.exchangeName,
    regularMarketPrice: result.meta?.regularMarketPrice,
    previousClose: result.meta?.previousClose,
    latestBar: bars.at(-1),
    recentBars: bars.slice(-5),
    sourceUrl,
  };
}

export async function getFreeUsFilings(
  ticker: string,
  forms: string[] = ['10-K', '10-Q', '8-K', '4'],
  limit = 8,
): Promise<FreeUsFiling[]> {
  const upper = ticker.trim().toUpperCase();
  const { cik } = await resolveSecCompany(upper);
  const sourceUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const data = await fetchJson<any>(sourceUrl, { headers: SEC_HEADERS });
  const recent = data?.filings?.recent;
  if (!recent) {
    return [];
  }

  const out: FreeUsFiling[] = [];
  for (let i = 0; i < recent.form.length; i += 1) {
    const form = recent.form[i];
    if (!forms.includes(form)) continue;
    const accessionNumber = recent.accessionNumber[i];
    const primaryDocument = recent.primaryDocument[i];
    const accessionCompact = String(accessionNumber).replace(/-/g, '');
    out.push({
      form,
      filedAt: recent.filingDate[i],
      accessionNumber,
      primaryDocument,
      description: recent.primaryDocDescription?.[i],
      secUrl: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionCompact}/${primaryDocument}`,
    });
    if (out.length >= limit) break;
  }

  return out;
}

const FACT_ALIASES = {
  revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'SalesRevenueNet',
    'Revenues',
  ],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  operatingIncome: ['OperatingIncomeLoss'],
  operatingCashFlow: [
    'NetCashProvidedByUsedInOperatingActivities',
    'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ],
  assets: ['Assets'],
  cashAndEquivalents: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
  ],
} as const;

function getUsdFacts(facts: CompanyFactsResponse['facts'], conceptNames: readonly string[]): SecFactValue[] {
  const usGaap = facts['us-gaap'] ?? {};
  for (const conceptName of conceptNames) {
    const concept = usGaap[conceptName];
    const usd = concept?.units?.USD;
    if (usd?.length) {
      return usd;
    }
  }
  return [];
}

function sortFactValues(values: SecFactValue[]): SecFactValue[] {
  return [...values].sort((a, b) => {
    const aFiled = a.filed ?? a.end ?? '';
    const bFiled = b.filed ?? b.end ?? '';
    if (aFiled !== bFiled) return bFiled.localeCompare(aFiled);
    const aEnd = a.end ?? '';
    const bEnd = b.end ?? '';
    return bEnd.localeCompare(aEnd);
  });
}

function pickLatestFact(values: SecFactValue[], mode: 'annual' | 'quarterly'): SecFactValue | undefined {
  const filtered = sortFactValues(values).filter((value) => {
    if (typeof value.val !== 'number') return false;
    if (mode === 'annual') {
      return value.form === '10-K' || value.fp === 'FY';
    }
    return value.form === '10-Q' || /^Q[1-4]$/.test(value.fp ?? '');
  });
  return filtered[0];
}

function buildFinancialPoint(
  facts: CompanyFactsResponse['facts'],
  mode: 'annual' | 'quarterly',
): FinancialPoint | undefined {
  const revenue = pickLatestFact(getUsdFacts(facts, FACT_ALIASES.revenue), mode);
  const netIncome = pickLatestFact(getUsdFacts(facts, FACT_ALIASES.netIncome), mode);
  const operatingIncome = pickLatestFact(getUsdFacts(facts, FACT_ALIASES.operatingIncome), mode);
  const operatingCashFlow = pickLatestFact(getUsdFacts(facts, FACT_ALIASES.operatingCashFlow), mode);
  const assets = pickLatestFact(getUsdFacts(facts, FACT_ALIASES.assets), mode);
  const cashAndEquivalents = pickLatestFact(getUsdFacts(facts, FACT_ALIASES.cashAndEquivalents), mode);

  const anchor = revenue ?? netIncome ?? operatingIncome ?? operatingCashFlow ?? assets ?? cashAndEquivalents;
  if (!anchor) return undefined;

  return {
    periodEnd: anchor.end,
    filedAt: anchor.filed,
    fiscalYear: anchor.fy,
    fiscalPeriod: anchor.fp,
    form: anchor.form,
    revenue: revenue?.val,
    netIncome: netIncome?.val,
    operatingIncome: operatingIncome?.val,
    operatingCashFlow: operatingCashFlow?.val,
    assets: assets?.val,
    cashAndEquivalents: cashAndEquivalents?.val,
  };
}

export async function getFreeUsFinancialSummary(ticker: string): Promise<FreeUsFinancialSummary> {
  const upper = ticker.trim().toUpperCase();
  const { cik, companyName } = await resolveSecCompany(upper);
  const sourceUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  const data = await fetchJson<CompanyFactsResponse>(sourceUrl, { headers: SEC_HEADERS });

  return {
    ticker: upper,
    companyName,
    cik,
    latestAnnual: buildFinancialPoint(data.facts, 'annual'),
    latestQuarterly: buildFinancialPoint(data.facts, 'quarterly'),
    sourceUrl,
  };
}

function textContent(node: Element | null | undefined): string | undefined {
  const text = node?.textContent?.trim();
  return text ? text : undefined;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function getFreeUsNews(ticker: string, limit = 5): Promise<FreeUsNewsItem[]> {
  const upper = ticker.trim().toUpperCase();
  const { companyName } = await resolveSecCompany(upper);
  const query = encodeURIComponent(`"${companyName}" OR ${upper}`);
  const sourceUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchText(sourceUrl, { headers: YAHOO_HEADERS });
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const items = Array.from(document.querySelectorAll('item')) as Element[];

  return items.slice(0, limit).map((item) => ({
    title: decodeHtmlEntities(textContent(item.querySelector('title')) ?? ''),
    link: textContent(item.querySelector('link')) ?? '',
    publishedAt: textContent(item.querySelector('pubDate')),
    source: textContent(item.querySelector('source')),
  }));
}

export async function buildFreeUsPocReport(ticker: string): Promise<FreeUsPocReport> {
  const upper = ticker.trim().toUpperCase();
  const { cik, companyName } = await resolveSecCompany(upper);
  const [price, filings, financials, news] = await Promise.all([
    getFreeUsPriceSnapshot(upper),
    getFreeUsFilings(upper),
    getFreeUsFinancialSummary(upper),
    getFreeUsNews(upper),
  ]);

  return {
    ticker: upper,
    companyName,
    cik,
    price,
    filings,
    financials,
    news,
  };
}
