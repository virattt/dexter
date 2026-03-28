import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { stripFieldsDeep } from './api.js';
import { formatToolResult } from '../types.js';
import { withRetry, isRateLimitError } from '../../utils/retry.js';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

const FMP_SOURCE_URL = (symbol: string) =>
  `https://financialmodelingprep.com/financial-statements/${symbol}`;

/**
 * Marker included in thrown errors when FMP returns HTTP 402 (ticker is
 * premium-only on the free plan).  Downstream callers check for this string
 * to decide whether to attempt a Yahoo Finance / Tavily fallback.
 */
export const FMP_PREMIUM_REQUIRED = 'FMP_PREMIUM_REQUIRED';

// Metadata-only fields that add noise without analytical value.
// Note: the new stable API uses 'filingDate' (fixed typo from legacy v3 'fillingDate').
const FMP_STRIP_FIELDS = ['cik', 'link', 'finalLink', 'filingDate', 'acceptedDate'] as const;

/** Map our period enum to the value FMP expects in its query param. */
function toFmpPeriod(period: 'annual' | 'quarterly'): 'annual' | 'quarter' {
  return period === 'quarterly' ? 'quarter' : 'annual';
}

/**
 * Thin FMP HTTP client.  Exported so tests can spy on `.get` without mocking
 * global fetch.
 */
export const fmpApi = {
  async get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const apiKey = process.env.FMP_API_KEY ?? '';
    if (!apiKey) {
      throw new Error(
        '[FMP API] FMP_API_KEY is not set. ' +
          'Register for a free key at https://site.financialmodelingprep.com.',
      );
    }

    const url = new URL(`${FMP_BASE_URL}${path}`);
    url.searchParams.set('apikey', apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(url.toString(), { signal: controller.signal });
          if (res.status === 429) throw new Error('429 rate limit');
          return res;
        },
        { maxAttempts: 4, shouldRetry: isRateLimitError },
      );
      if (response.status === 402) {
        throw new Error(
          `${FMP_PREMIUM_REQUIRED}: This ticker is not available under the free FMP plan. ` +
            'Upgrade at https://site.financialmodelingprep.com.',
        );
      }
      if (!response.ok) {
        throw new Error(`[FMP API] ${response.status} ${response.statusText}`);
      }
      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('[FMP API] request timed out after 30s');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },
};

// ---------------------------------------------------------------------------
// Shared schema — all three statement tools accept the same inputs
// ---------------------------------------------------------------------------

const FmpInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "Stock ticker symbol, including exchange suffix for international stocks " +
        "(e.g. 'VWS.CO', 'AZN.L', 'SAP.DE', 'AAPL').",
    ),
  period: z
    .enum(['annual', 'quarterly'])
    .default('annual')
    .describe("Reporting period: 'annual' for full-year, 'quarterly' for quarterly."),
  limit: z
    .number()
    .default(4)
    .describe('Number of periods to return (default: 4).'),
});

// ---------------------------------------------------------------------------
// Income Statements
// ---------------------------------------------------------------------------

export const getFmpIncomeStatements = new DynamicStructuredTool({
  name: 'get_fmp_income_statements',
  description:
    'Fetches historical income statements from Financial Modeling Prep (FMP). ' +
    'Covers US and international tickers including European stocks (e.g. VWS.CO, AZN.L, SAP.DE). ' +
    'Returns revenue, gross profit, operating income, net income, EPS, and EBITDA per period.',
  schema: FmpInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim();
    try {
      const data = await fmpApi.get<unknown[]>(`/income-statement`, {
        symbol: ticker,
        period: toFmpPeriod(input.period as 'annual' | 'quarterly'),
        limit: input.limit,
      });
      if (!Array.isArray(data) || data.length === 0) {
        return formatToolResult(
          { error: `No income statement data found for ${ticker} on FMP.` },
          [],
        );
      }
      return formatToolResult(
        stripFieldsDeep(data, FMP_STRIP_FIELDS) as unknown[],
        [FMP_SOURCE_URL(ticker)],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: message }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Balance Sheets
// ---------------------------------------------------------------------------

export const getFmpBalanceSheets = new DynamicStructuredTool({
  name: 'get_fmp_balance_sheets',
  description:
    'Fetches historical balance sheets from Financial Modeling Prep (FMP). ' +
    'Covers US and international tickers. ' +
    'Returns total assets, liabilities, shareholders equity, and debt per period.',
  schema: FmpInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim();
    try {
      const data = await fmpApi.get<unknown[]>(`/balance-sheet-statement`, {
        symbol: ticker,
        period: toFmpPeriod(input.period as 'annual' | 'quarterly'),
        limit: input.limit,
      });
      if (!Array.isArray(data) || data.length === 0) {
        return formatToolResult(
          { error: `No balance sheet data found for ${ticker} on FMP.` },
          [],
        );
      }
      return formatToolResult(
        stripFieldsDeep(data, FMP_STRIP_FIELDS) as unknown[],
        [FMP_SOURCE_URL(ticker)],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: message }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Cash Flow Statements
// ---------------------------------------------------------------------------

export const getFmpCashFlowStatements = new DynamicStructuredTool({
  name: 'get_fmp_cash_flow_statements',
  description:
    'Fetches historical cash flow statements from Financial Modeling Prep (FMP). ' +
    'Covers US and international tickers. ' +
    'Returns operating cash flow, capital expenditure, and free cash flow per period.',
  schema: FmpInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim();
    try {
      const data = await fmpApi.get<unknown[]>(`/cash-flow-statement`, {
        symbol: ticker,
        period: toFmpPeriod(input.period as 'annual' | 'quarterly'),
        limit: input.limit,
      });
      if (!Array.isArray(data) || data.length === 0) {
        return formatToolResult(
          { error: `No cash flow data found for ${ticker} on FMP.` },
          [],
        );
      }
      return formatToolResult(
        stripFieldsDeep(data, FMP_STRIP_FIELDS) as unknown[],
        [FMP_SOURCE_URL(ticker)],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: message }, []);
    }
  },
});
