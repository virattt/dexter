import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api, stripFieldsDeep } from './api.js';
import { formatToolResult } from '../types.js';
import { getFmpIncomeStatements, getFmpBalanceSheets, getFmpCashFlowStatements, FMP_PREMIUM_REQUIRED } from './fmp.js';
import { getYahooIncomeStatements } from './yahoo-finance.js';
import { tavilySearch } from '../search/tavily.js';
import { crossValidateFinancials, type FinancialRecord } from '../../utils/cross-validate.js';

const REDUNDANT_FINANCIAL_FIELDS = ['accession_number', 'currency', 'period'] as const;

const FinancialStatementsInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch financial statements for. For example, 'AAPL' for Apple."
    ),
  period: z
    .enum(['annual', 'quarterly', 'ttm'])
    .describe(
      "The reporting period for the financial statements. 'annual' for yearly, 'quarterly' for quarterly, and 'ttm' for trailing twelve months."
    ),
  limit: z
    .number()
    .default(4)
    .describe(
      'Maximum number of report periods to return (default: 4). Returns the most recent N periods based on the period type. Increase this for longer historical analysis when needed.'
    ),
  report_period_gt: z
    .string()
    .optional()
    .describe('Filter for financial statements with report periods after this date (YYYY-MM-DD).'),
  report_period_gte: z
    .string()
    .optional()
    .describe(
      'Filter for financial statements with report periods on or after this date (YYYY-MM-DD).'
    ),
  report_period_lt: z
    .string()
    .optional()
    .describe('Filter for financial statements with report periods before this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe(
      'Filter for financial statements with report periods on or before this date (YYYY-MM-DD).'
    ),
});

function createParams(input: z.infer<typeof FinancialStatementsInputSchema>): Record<string, string | number | undefined> {
  return {
    ticker: input.ticker,
    period: input.period,
    limit: input.limit,
    report_period_gt: input.report_period_gt,
    report_period_gte: input.report_period_gte,
    report_period_lt: input.report_period_lt,
    report_period_lte: input.report_period_lte,
  };
}

/**
 * Map our period enum to 'annual' | 'quarterly' for FMP (drops 'ttm').
 * FMP does not have a TTM endpoint; annual is the closest equivalent.
 */
function fmpPeriod(period: string): 'annual' | 'quarterly' {
  return period === 'quarterly' ? 'quarterly' : 'annual';
}

type FmpCallResult = { kind: 'ok'; result: string } | { kind: 'premium' } | { kind: 'error' };

/**
 * Try the FMP fallback tool.  Returns:
 * - `{ kind: 'ok', result }` when FMP returns real data
 * - `{ kind: 'premium' }` when FMP signals the ticker requires a paid plan (HTTP 402)
 * - `{ kind: 'error' }` for any other failure (empty data, API key missing, network error)
 */
async function tryFmp(
  fmpTool: { invoke: (input: { ticker: string; period: 'annual' | 'quarterly'; limit: number }) => Promise<string> },
  ticker: string,
  period: string,
  limit: number,
): Promise<FmpCallResult> {
  if (!process.env.FMP_API_KEY) return { kind: 'error' };
  try {
    const raw = await fmpTool.invoke({ ticker, period: fmpPeriod(period), limit });
    const parsed = JSON.parse(raw) as { data: unknown };
    if (!parsed.data) return { kind: 'error' };
    const error = (parsed.data as Record<string, unknown>)?.error;
    if (typeof error === 'string' && error.includes(FMP_PREMIUM_REQUIRED)) return { kind: 'premium' };
    if (error) return { kind: 'error' };
    return { kind: 'ok', result: raw };
  } catch {
    return { kind: 'error' };
  }
}

/**
 * Search for financial data via Tavily as a last resort.
 * Returns null if TAVILY_API_KEY is not set or the search fails.
 */
async function tryTavilySearch(ticker: string, statementType: string): Promise<string | null> {
  if (!process.env.TAVILY_API_KEY) return null;
  try {
    const query = `${ticker} ${statementType} annual financial data 2024 2023`;
    const result = await tavilySearch.invoke({ query });
    const parsed = JSON.parse(result) as { data: unknown };
    if (!Array.isArray(parsed.data) || parsed.data.length === 0) return null;
    return result;
  } catch {
    return null;
  }
}

export const getIncomeStatements = new DynamicStructuredTool({
  name: 'get_income_statements',
  description: `Fetches a company's income statements, detailing its revenues, expenses, net income, etc. over a reporting period. Falls back to Financial Modeling Prep for international tickers (e.g. VWS.CO). Useful for evaluating a company's profitability and operational efficiency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim();
    const params = createParams(input);
    try {
      const { data, url } = await api.get('/financials/income-statements/', params);
      const statements = data.income_statements as unknown[];
      if (statements && statements.length > 0) {
        const primaryResult = formatToolResult(stripFieldsDeep(statements, REDUNDANT_FINANCIAL_FIELDS), [url]);

        // Fire FMP concurrently for cross-source validation (best-effort, annual only)
        if (input.period === 'annual') {
          try {
            const fmpResult = await tryFmp(getFmpIncomeStatements, ticker, 'annual', input.limit);
            if (fmpResult.kind === 'ok') {
              const fmpData = JSON.parse(fmpResult.result) as { data?: FinancialRecord[] };
              const primaryRecords: FinancialRecord[] = (statements as Array<Record<string, unknown>>).map(s => ({
                year: new Date(s.report_period as string ?? s.period as string ?? '').getFullYear(),
                totalRevenue: s.revenue as number ?? s.total_revenue as number,
                netIncome: s.net_income as number,
              }));
              const validation = crossValidateFinancials(primaryRecords, fmpData.data ?? []);
              if (!validation.ok) {
                return primaryResult + '\n\n' + validation.warnings.join('\n');
              }
            }
          } catch {
            // Validation is best-effort — never block primary result
          }
        }

        return primaryResult;
      }
    } catch {
      // Fall through to FMP
    }

    const fmpResult = await tryFmp(getFmpIncomeStatements, ticker, input.period, input.limit);
    if (fmpResult.kind === 'ok') return fmpResult.result;

    // FMP premium or error — try Yahoo Finance (has totalRevenue + netIncome for intl tickers)
    const yahooRaw = await getYahooIncomeStatements.invoke({ ticker, limit: input.limit });
    const yahooParsed = JSON.parse(yahooRaw) as { data: unknown };
    const yahooHasData =
      yahooParsed.data !== undefined &&
      yahooParsed.data !== null &&
      !(yahooParsed.data as Record<string, unknown>)?.error;
    if (yahooHasData) return yahooRaw;

    // Last resort: Tavily web search
    const tavilyRaw = await tryTavilySearch(ticker, 'income statement revenue earnings');
    if (tavilyRaw) return tavilyRaw;

    return formatToolResult(
      { error: `No income statement data available for ${ticker}. FMP free plan only covers US stocks — upgrade at https://site.financialmodelingprep.com for full international coverage.` },
      [],
    );
  },
});

export const getBalanceSheets = new DynamicStructuredTool({
  name: 'get_balance_sheets',
  description: `Retrieves a company's balance sheets, providing a snapshot of its assets, liabilities, shareholders' equity, etc. at a specific point in time. Falls back to Financial Modeling Prep for international tickers. Useful for assessing a company's financial position.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim();
    const params = createParams(input);
    try {
      const { data, url } = await api.get('/financials/balance-sheets/', params);
      const statements = data.balance_sheets as unknown[];
      if (statements && statements.length > 0) {
        return formatToolResult(stripFieldsDeep(statements, REDUNDANT_FINANCIAL_FIELDS), [url]);
      }
    } catch {
      // Fall through to FMP
    }

    const fmpResult = await tryFmp(getFmpBalanceSheets, ticker, input.period, input.limit);
    if (fmpResult.kind === 'ok') return fmpResult.result;

    // FMP premium or error — use Tavily web search (Yahoo Finance balance sheet is nearly empty)
    const tavilyRaw = await tryTavilySearch(ticker, 'balance sheet total assets shareholders equity');
    if (tavilyRaw) return tavilyRaw;

    return formatToolResult(
      { error: `No balance sheet data available for ${ticker}. FMP free plan only covers US stocks — upgrade at https://site.financialmodelingprep.com for full international coverage.` },
      [],
    );
  },
});

export const getCashFlowStatements = new DynamicStructuredTool({
  name: 'get_cash_flow_statements',
  description: `Retrieves a company's cash flow statements, showing how cash is generated and used across operating, investing, and financing activities. Falls back to Financial Modeling Prep for international tickers. Useful for understanding a company's liquidity and solvency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim();
    const params = createParams(input);
    try {
      const { data, url } = await api.get('/financials/cash-flow-statements/', params);
      const statements = data.cash_flow_statements as unknown[];
      if (statements && statements.length > 0) {
        return formatToolResult(stripFieldsDeep(statements, REDUNDANT_FINANCIAL_FIELDS), [url]);
      }
    } catch {
      // Fall through to FMP
    }

    const fmpResult = await tryFmp(getFmpCashFlowStatements, ticker, input.period, input.limit);
    if (fmpResult.kind === 'ok') return fmpResult.result;

    // FMP premium or error — use Tavily web search (Yahoo Finance cashflow is nearly empty)
    const tavilyRaw = await tryTavilySearch(ticker, 'cash flow statement operating investing free cash flow');
    if (tavilyRaw) return tavilyRaw;

    return formatToolResult(
      { error: `No cash flow data available for ${ticker}. FMP free plan only covers US stocks — upgrade at https://site.financialmodelingprep.com for full international coverage.` },
      [],
    );
  },
});

export const getAllFinancialStatements = new DynamicStructuredTool({
  name: 'get_all_financial_statements',
  description: `Retrieves all three financial statements (income statements, balance sheets, and cash flow statements) for a company in a single API call. This is more efficient than calling each statement type separately when you need all three for comprehensive financial analysis. Falls back to FMP and web search if the primary API is unavailable.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim();
    const params = createParams(input);
    try {
      const { data, url } = await api.get('/financials/', params);
      if (data.financials && Object.keys(data.financials as object).length > 0) {
        return formatToolResult(
          stripFieldsDeep(data.financials, REDUNDANT_FINANCIAL_FIELDS),
          [url],
        );
      }
    } catch {
      // Fall through to FMP
    }

    // FMP fallback — try all three statements individually
    const [incomeResult, balanceResult, cashResult] = await Promise.allSettled([
      tryFmp(getFmpIncomeStatements, ticker, input.period, input.limit),
      tryFmp(getFmpBalanceSheets, ticker, input.period, input.limit),
      tryFmp(getFmpCashFlowStatements, ticker, input.period, input.limit),
    ]);

    const fmpData: Record<string, unknown> = {};
    for (const [key, settled] of [
      ['income_statements', incomeResult],
      ['balance_sheets', balanceResult],
      ['cash_flow_statements', cashResult],
    ] as [string, PromiseSettledResult<FmpCallResult>][]) {
      if (settled.status === 'fulfilled' && settled.value.kind === 'ok') {
        const parsed = JSON.parse(settled.value.result) as { data: unknown };
        fmpData[key] = parsed.data;
      }
    }
    if (Object.keys(fmpData).length > 0) {
      return formatToolResult(fmpData, []);
    }

    // Tavily last resort
    const tavilyRaw = await tryTavilySearch(ticker, 'income statement balance sheet cash flow annual results');
    if (tavilyRaw) return tavilyRaw;

    return formatToolResult(
      { error: `No financial statements available for ${ticker}. API access may require an upgrade — use web_search to find recent annual results.` },
      [],
    );
  },
});

