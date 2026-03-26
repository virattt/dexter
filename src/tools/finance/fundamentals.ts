import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';

const FinancialStatementsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  period: z
    .enum(['annual', 'quarterly', 'ttm'])
    .describe("Reporting period: 'annual', 'quarterly', or 'ttm'."),
  limit: z
    .number()
    .default(4)
    .describe(
      'Maximum number of report periods to return (default: 4). Increase for longer historical analysis.'
    ),
  report_period_gte: z
    .string()
    .optional()
    .describe('Filter: report date on or after this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe('Filter: report date on or before this date (YYYY-MM-DD).'),
});

function createParams(
  input: z.infer<typeof FinancialStatementsInputSchema>,
): Record<string, string | number | undefined> {
  return {
    ticker: input.ticker.trim().toUpperCase(),
    timeframe: input.period,
    limit: input.limit,
    'period_of_report_date.gte': input.report_period_gte,
    'period_of_report_date.lte': input.report_period_lte,
    order: 'desc',
    sort: 'period_of_report_date',
  };
}

function extractStatements(
  results: Record<string, unknown>[],
  key: string,
): unknown[] {
  return results.map((r) => {
    const financials = r.financials as Record<string, unknown> | undefined;
    const statement = financials?.[key] as Record<string, unknown> | undefined;
    return {
      ...statement,
      ticker: (r.tickers as string[])?.[0],
      fiscal_period: r.fiscal_period,
      fiscal_year: r.fiscal_year,
      start_date: r.start_date,
      end_date: r.end_date,
      filing_date: r.filing_date,
    };
  });
}

export const getIncomeStatements = new DynamicStructuredTool({
  name: 'get_income_statements',
  description: `Fetches a company's income statements via Polygon, including revenues, expenses, and net income. Useful for evaluating profitability and operational efficiency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { data, url } = await api.get('/vX/reference/financials', createParams(input));
    const results = (data.results as Record<string, unknown>[]) || [];
    return formatToolResult(extractStatements(results, 'income_statement'), [url]);
  },
});

export const getBalanceSheets = new DynamicStructuredTool({
  name: 'get_balance_sheets',
  description: `Retrieves a company's balance sheets via Polygon, providing assets, liabilities, and shareholders' equity. Useful for assessing financial position.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { data, url } = await api.get('/vX/reference/financials', createParams(input));
    const results = (data.results as Record<string, unknown>[]) || [];
    return formatToolResult(extractStatements(results, 'balance_sheet'), [url]);
  },
});

export const getCashFlowStatements = new DynamicStructuredTool({
  name: 'get_cash_flow_statements',
  description: `Retrieves a company's cash flow statements via Polygon, showing operating, investing, and financing cash flows. Useful for understanding liquidity and solvency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { data, url } = await api.get('/vX/reference/financials', createParams(input));
    const results = (data.results as Record<string, unknown>[]) || [];
    return formatToolResult(extractStatements(results, 'cash_flow_statement'), [url]);
  },
});

export const getAllFinancialStatements = new DynamicStructuredTool({
  name: 'get_all_financial_statements',
  description: `Retrieves all three financial statements (income, balance sheet, cash flow) in a single call via Polygon. More efficient than calling each separately.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { data, url } = await api.get('/vX/reference/financials', createParams(input));
    const results = (data.results as Record<string, unknown>[]) || [];
    return formatToolResult(results, [url]);
  },
});
