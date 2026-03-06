import { logger } from '../../utils/logger.js';

const YAHOO_BASE10 = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';
const YAHOO_BASE8 = 'https://query1.finance.yahoo.com/v8/finance/chart';

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
};

let cachedCookie: string | null = null;
let cachedCrumb: string | null = null;
let sessionPromise: Promise<{ cookie: string; crumb: string } | null> | null = null;

async function getYahooSession(): Promise<{ cookie: string; crumb: string } | null> {
  if (cachedCrumb && cachedCookie) return { cookie: cachedCookie, crumb: cachedCrumb };
  
  // If a fetch is already in progress, await its result
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    try {
      const cookieRes = await fetch('https://fc.yahoo.com/', { headers: YAHOO_HEADERS, redirect: 'manual' });
      let cookie = cookieRes.headers.get('set-cookie') || '';
      if (cookie) {
        cookie = cookie.split(';')[0];
      } else {
        sessionPromise = null;
        return null; // Cookie required
      }

      const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        headers: { ...YAHOO_HEADERS, Cookie: cookie },
      });
      
      if (!crumbRes.ok) {
        sessionPromise = null;
        return null;
      }
      
      const crumb = await crumbRes.text();

      cachedCookie = cookie;
      cachedCrumb = crumb;
      sessionPromise = null;
      return { cookie, crumb };
    } catch {
      sessionPromise = null;
      return null;
    }
  })();

  return sessionPromise;
}

async function fetchWithCrumb(url: string, init?: RequestInit): Promise<Response> {
  const session = await getYahooSession();
  const finalUrl = session?.crumb ? `${url}${url.includes('?') ? '&' : '?'}crumb=${session.crumb}` : url;
  const headers = { ...YAHOO_HEADERS, ...init?.headers } as Record<string, string>;
  if (session?.cookie) {
    headers['Cookie'] = session.cookie;
  }
  return fetch(finalUrl, { ...init, headers });
}

/**
 * Fetch current price, market cap, and basic metrics for a US stock.
 */
export async function getYahooQuote(ticker: string): Promise<Record<string, unknown>[]> {
  const url = `${YAHOO_BASE10}/${encodeURIComponent(
    ticker
  )}?modules=financialData,defaultKeyStatistics,summaryDetail`;
  try {
    const response = await fetchWithCrumb(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      console.log(`[Yahoo Debug] Quote fetch failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const json = (await response.json()) as any;
    const result = json?.quoteSummary?.result?.[0];
    if (!result) {
      console.log(`[Yahoo Debug] No result in JSON:`, JSON.stringify(json).slice(0, 200));
      return [];
    }

    const fd = result.financialData || {};
    const dks = result.defaultKeyStatistics || {};
    const sd = result.summaryDetail || {};

    // Map Yahoo fields to mimic FinancialDatasets structure roughly
    const quote = {
      ticker,
      price: fd.currentPrice?.raw || sd.previousClose?.raw,
      market_cap: sd.marketCap?.raw,
      enterprise_value: dks.enterpriseValue?.raw,
      price_to_book: dks.priceToBook?.raw,
      trailing_pe: sd.trailingPE?.raw,
      forward_pe: sd.forwardPE?.raw,
      peg_ratio: dks.pegRatio?.raw,
      dividend_yield: sd.dividendYield?.raw,
      debt_to_equity: fd.debtToEquity?.raw,
      free_cash_flow: fd.freeCashflow?.raw,
      operating_cash_flow: fd.operatingCashflow?.raw,
      revenue_growth: fd.revenueGrowth?.raw,
      ebitda: fd.ebitda?.raw,
      gross_margins: fd.grossMargins?.raw,
      operating_margins: fd.operatingMargins?.raw,
      profit_margins: fd.profitMargins?.raw,
      source: 'YahooFinance_Fallback',
    };

    return [quote];
  } catch (error) {
    logger.error(`[Yahoo Fallback] Error fetching quote for ${ticker}: ${error}`);
    return [];
  }
}

/**
 * Fetch historical prices for a US stock.
 */
export async function getYahooPrices(
  ticker: string,
  startDate?: string,
  endDate?: string
): Promise<Record<string, unknown>[]> {
  try {
    // Determine period1 and period2 (UNIX seconds)
    let period1 = Math.floor(new Date(new Date().getFullYear() - 1, 0, 1).getTime() / 1000); // Default: 1 yr ago
    let period2 = Math.floor(Date.now() / 1000);

    if (startDate) period1 = Math.floor(new Date(startDate).getTime() / 1000);
    if (endDate) period2 = Math.floor(new Date(endDate).getTime() / 1000);

    const url = `${YAHOO_BASE8}/${encodeURIComponent(
      ticker
    )}?period1=${period1}&period2=${period2}&interval=1d&events=history`;

    const response = await fetchWithCrumb(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];

    const json = (await response.json()) as any;
    const result = json?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const ohlcv = result.indicators?.quote?.[0] || {};

    const prices = timestamps.map((ts, i) => {
      const date = new Date(ts * 1000).toISOString().split('T')[0];
      return {
        ticker,
        date,
        open: typeof ohlcv.open?.[i] === 'number' ? Math.round(ohlcv.open[i] * 100) / 100 : null,
        high: typeof ohlcv.high?.[i] === 'number' ? Math.round(ohlcv.high[i] * 100) / 100 : null,
        low: typeof ohlcv.low?.[i] === 'number' ? Math.round(ohlcv.low[i] * 100) / 100 : null,
        close: typeof ohlcv.close?.[i] === 'number' ? Math.round(ohlcv.close[i] * 100) / 100 : null,
        volume: ohlcv.volume?.[i] || null,
        source: 'YahooFinance_Fallback',
      };
    });

    return prices.filter((p) => p.close !== null).reverse(); // Return newest first
  } catch (error) {
    logger.error(`[Yahoo Fallback] Error fetching prices for ${ticker}: ${error}`);
    return [];
  }
}

/**
 * Fetch Income Statements.
 */
export async function getYahooIncomeStatements(ticker: string, period?: string): Promise<Record<string, unknown>[]> {
  return fetchYahooFinancialStatements(ticker, 'incomeStatementHistory', period);
}

/**
 * Fetch Balance Sheets.
 */
export async function getYahooBalanceSheets(ticker: string, period?: string): Promise<Record<string, unknown>[]> {
  return fetchYahooFinancialStatements(ticker, 'balanceSheetHistory', period);
}

/**
 * Fetch Cash Flow Statements.
 */
export async function getYahooCashFlowStatements(ticker: string, period?: string): Promise<Record<string, unknown>[]> {
  return fetchYahooFinancialStatements(ticker, 'cashflowStatementHistory', period);
}

/**
 * Generic fetcher for Yahoo Financial statements.
 * @param module e.g., incomeStatementHistory, balanceSheetHistory, cashflowStatementHistory
 */
async function fetchYahooFinancialStatements(
  ticker: string,
  module: string,
  period: string = 'annual'
): Promise<Record<string, unknown>[]> {
  // Yahoo appends 'Quarterly' to module name for TTM/Quarterly data
  const targetModule = period === 'quarterly' ? `${module}Quarterly` : module;
  const url = `${YAHOO_BASE10}/${encodeURIComponent(ticker)}?modules=${targetModule}`;

  try {
    const response = await fetchWithCrumb(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];

    const json = (await response.json()) as any;
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return [];

    const container = result[targetModule];
    // Different modules have different array keys (e.g. incomeStatementHistory vs cashflowStatements)
    const dataArray =
      container?.incomeStatementHistory || // incomeStatementHistory
      container?.balanceSheetStatements || // balanceSheetHistory
      container?.cashflowStatements || // cashflowStatementHistory
      [];

    return dataArray.map((statement: any) => {
      // Convert Yahoo's nested { raw, fmt, longFmt } to flat { value }
      const flat: Record<string, unknown> = {
        ticker,
        period,
        calendar_date: statement.endDate?.fmt || new Date(statement.endDate?.raw * 1000).toISOString().split('T')[0],
        report_period: statement.endDate?.fmt || new Date(statement.endDate?.raw * 1000).toISOString().split('T')[0],
        source: 'YahooFinance_Fallback',
      };

      for (const [key, val] of Object.entries(statement)) {
        if (key === 'endDate' || key === 'maxAge') continue;
        if (val && typeof val === 'object' && 'raw' in val) {
          flat[key] = (val as any).raw;
        } else {
          flat[key] = val;
        }
      }

      return flat;
    });
  } catch (error) {
    logger.error(`[Yahoo Fallback] Error fetching ${module} for ${ticker}: ${error}`);
    return [];
  }
}
