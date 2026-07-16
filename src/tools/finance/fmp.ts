import { logger } from '../../utils/logger.js';

/**
 * Financial Modeling Prep (FMP) free-tier adapter.
 *
 * Activated only when FMP_API_KEY is set. Maps Dexter's fundamentals endpoints
 * onto FMP's free endpoints and reshapes the JSON into the top-level keys the
 * finance tools expect (income_statements, balance_sheets, cash_flow_statements,
 * financial_metrics, snapshot, earnings, news, investors, institutional_holdings).
 *
 * NOTE: not all Financial Datasets endpoints have a free FMP equivalent
 * (insider trades, beneficial ownership, stock screener, segments). Those stay
 * on Financial Datasets and degrade gracefully without a key.
 */

const FMP_BASE = 'https://financialmodelingprep.com/api/v3';
const KEY = process.env.FMP_API_KEY || '';

type Json = unknown;

async function fmpGet(
  path: string,
  search: Record<string, string | number | undefined>,
): Promise<Json> {
  const url = new URL(`${FMP_BASE}${path}`);
  url.searchParams.set('apikey', KEY);
  for (const [k, v] of Object.entries(search)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[FMP] network error: ${message}`);
  }
  if (!response.ok) {
    throw new Error(`[FMP] ${response.status} ${response.statusText}`);
  }
  const json = (await response.json()) as Json;
  if (json && typeof json === 'object' && 'Error Message' in (json as Record<string, unknown>)) {
    const msg = (json as Record<string, unknown>)['Error Message'];
    throw new Error(`[FMP] ${String(msg)}`);
  }
  return json;
}

function periodParam(p: unknown): string {
  const s = String(p || '').toLowerCase();
  if (s === 'quarterly' || s === 'quarter') return 'quarter';
  return 'annual';
}

function tickerOf(params: Record<string, string | number | string[] | undefined>): string {
  return String(params.ticker || '').toUpperCase();
}

function limitOf(params: Record<string, string | number | string[] | undefined>, fallback: number): number {
  const v = params.limit;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function fmpRequest(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
): Promise<Record<string, unknown>> {
  const ticker = tickerOf(params);
  const period = periodParam(params.period);
  const limit = limitOf(params, 5);

  try {
    switch (endpoint) {
      case '/financials/income-statements/':
        return {
          income_statements: (await fmpGet(`/income-statement/${ticker}`, { period, limit })) as Json,
        };

      case '/financials/balance-sheets/':
        return {
          balance_sheets: (await fmpGet(`/balance-sheet-statement/${ticker}`, { period, limit })) as Json,
        };

      case '/financials/cash-flow-statements/':
        return {
          cash_flow_statements: (await fmpGet(`/cash-flow-statement/${ticker}`, { period, limit })) as Json,
        };

      case '/financials/':
        // Best-effort: no single combined endpoint on free FMP; return income
        // statements under the expected `financials` key.
        return {
          financials: (await fmpGet(`/income-statement/${ticker}`, { period, limit })) as Json,
        };

      case '/financial-metrics/snapshot/': {
        const ratios = (await fmpGet(`/ratios/${ticker}`, { period, limit: 1 })) as unknown[];
        return { snapshot: (Array.isArray(ratios) ? ratios[0] : {}) || {} };
      }

      case '/financial-metrics/':
        return {
          financial_metrics: (await fmpGet(`/ratios/${ticker}`, { period, limit })) as Json,
        };

      case '/earnings':
        return { earnings: (await fmpGet(`/earnings/${ticker}`, {})) as Json };

      case '/news':
        return {
          news: (await fmpGet('/stock_news', { tickers: ticker, limit: limitOf(params, 20) })) as Json,
        };

      case '/institutional-holdings/investors':
        return {
          investors: (await fmpGet(`/institutional-holder/${ticker}`, {})) as Json,
        };

      case '/institutional-holdings/':
        return {
          institutional_holdings: (await fmpGet(`/institutional-holder/${ticker}`, {})) as Json,
        };

      default:
        throw new Error(`[FMP] unsupported endpoint: ${endpoint}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[FMP] ${message}`);
    throw new Error(`[FMP] ${message}`);
  }
}
