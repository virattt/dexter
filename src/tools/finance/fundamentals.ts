import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api, stripFieldsDeep } from './api.js';
import { formatToolResult } from '../types.js';
import { getFmpIncomeStatements, getFmpBalanceSheets, getFmpCashFlowStatements } from './fmp.js';

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

/**
 * Try the FMP fallback tool and return its result only when it contains real
 * data (not an error object).  Returns null when FMP also comes up empty so
 * the caller can continue to a final error response.
 */
async function tryFmp(
  fmpTool: { invoke: (input: { ticker: string; period: 'annual' | 'quarterly'; limit: number }) => Promise<string> },
  ticker: string,
  period: string,
  limit: number,
): Promise<string | null> {
  if (!process.env.FMP_API_KEY) return null;
  const raw = await fmpTool.invoke({ ticker, period: fmpPeriod(period), limit });
  const parsed = JSON.parse(raw) as { data: unknown };
  if ((parsed.data as Record<string, unknown>)?.error) return null;
  return raw;
}

export const getIncomeStatements = new DynamicStructuredTool({
  name: 'get_income_statements',
  description: `Fetches a company's income statements, detailing its revenues, expenses, net income, etc. over a reporting period. Falls back to Financial Modeling Prep for international tickers (e.g. VWS.CO). Useful for evaluating a company's profitability and operational efficiency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const params = createParams(input);
    try {
      const { data, url } = await api.get('/financials/income-statements/', params);
      const statements = data.income_statements as unknown[];
      if (statements && statements.length > 0) {
        return formatToolResult(stripFieldsDeep(statements, REDUNDANT_FINANCIAL_FIELDS), [url]);
      }
    } catch {
      // Fall through to FMP
    }

    const fmpResult = await tryFmp(getFmpIncomeStatements, input.ticker.trim(), input.period, input.limit);
    if (fmpResult) return fmpResult;

    return formatToolResult(
      { error: `No income statement data available for ${input.ticker}. Configure FMP_API_KEY for international ticker support (https://site.financialmodelingprep.com).` },
      [],
    );
  },
});

export const getBalanceSheets = new DynamicStructuredTool({
  name: 'get_balance_sheets',
  description: `Retrieves a company's balance sheets, providing a snapshot of its assets, liabilities, shareholders' equity, etc. at a specific point in time. Falls back to Financial Modeling Prep for international tickers. Useful for assessing a company's financial position.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
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

    const fmpResult = await tryFmp(getFmpBalanceSheets, input.ticker.trim(), input.period, input.limit);
    if (fmpResult) return fmpResult;

    return formatToolResult(
      { error: `No balance sheet data available for ${input.ticker}. Configure FMP_API_KEY for international ticker support (https://site.financialmodelingprep.com).` },
      [],
    );
  },
});

export const getCashFlowStatements = new DynamicStructuredTool({
  name: 'get_cash_flow_statements',
  description: `Retrieves a company's cash flow statements, showing how cash is generated and used across operating, investing, and financing activities. Falls back to Financial Modeling Prep for international tickers. Useful for understanding a company's liquidity and solvency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
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

    const fmpResult = await tryFmp(getFmpCashFlowStatements, input.ticker.trim(), input.period, input.limit);
    if (fmpResult) return fmpResult;

    return formatToolResult(
      { error: `No cash flow data available for ${input.ticker}. Configure FMP_API_KEY for international ticker support (https://site.financialmodelingprep.com).` },
      [],
    );
  },
});

export const getAllFinancialStatements = new DynamicStructuredTool({
  name: 'get_all_financial_statements',
  description: `Retrieves all three financial statements (income statements, balance sheets, and cash flow statements) for a company in a single API call. This is more efficient than calling each statement type separately when you need all three for comprehensive financial analysis.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const params = createParams(input);
    const { data, url } = await api.get('/financials/', params);
    return formatToolResult(
      stripFieldsDeep(data.financials || {}, REDUNDANT_FINANCIAL_FIELDS),
      [url]
    );
  },
});

