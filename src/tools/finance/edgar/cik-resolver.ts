/**
 * Ticker → CIK resolver using SEC EDGAR company tickers file.
 *
 * Fetches https://www.sec.gov/files/company_tickers.json once, caches in-memory for 24h.
 * CIKs are zero-padded to 10 digits for EDGAR URL construction.
 */
import { logger } from '../../../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

interface ResolvedCik {
  cik: string;       // zero-padded 10-digit CIK
  cikRaw: number;    // raw numeric CIK
  companyName: string;
  ticker: string;
}

// ---------------------------------------------------------------------------
// In-memory cache (24h TTL)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

let tickerMap: Map<string, CompanyTickerEntry> | null = null;
let cacheTimestamp = 0;

function isCacheValid(): boolean {
  return tickerMap !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

async function loadTickerMap(): Promise<Map<string, CompanyTickerEntry>> {
  if (isCacheValid()) {
    return tickerMap!;
  }

  const userAgent = process.env.SEC_EDGAR_USER_AGENT;
  if (!userAgent) {
    throw new Error('SEC_EDGAR_USER_AGENT env var is required.');
  }

  const url = 'https://www.sec.gov/files/company_tickers.json';
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch company tickers: ${response.status} ${response.statusText}`);
  }

  const data: Record<string, CompanyTickerEntry> = await response.json();

  const map = new Map<string, CompanyTickerEntry>();
  for (const entry of Object.values(data)) {
    map.set(entry.ticker.toUpperCase(), entry);
  }

  tickerMap = map;
  cacheTimestamp = Date.now();
  logger.info(`CIK resolver loaded ${map.size} tickers`);

  return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a stock ticker to its SEC CIK number.
 * CIK is zero-padded to 10 digits for EDGAR URL paths.
 *
 * @throws Error if ticker is not found in SEC database
 */
export async function resolveCik(ticker: string): Promise<ResolvedCik> {
  const map = await loadTickerMap();
  const upperTicker = ticker.toUpperCase();
  const entry = map.get(upperTicker);

  if (!entry) {
    throw new Error(
      `Ticker "${upperTicker}" not found in SEC EDGAR database. ` +
      'Ensure you are using a valid US-listed stock ticker.'
    );
  }

  return {
    cik: String(entry.cik_str).padStart(10, '0'),
    cikRaw: entry.cik_str,
    companyName: entry.title,
    ticker: entry.ticker,
  };
}

/**
 * Build the EDGAR company facts URL for a given CIK.
 */
export function companyFactsUrl(cik: string): string {
  return `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
}

/**
 * Build the EDGAR submissions URL for a given CIK.
 */
export function submissionsUrl(cik: string): string {
  return `https://data.sec.gov/submissions/CIK${cik}.json`;
}
