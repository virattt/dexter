import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { runFinanceProviderChain } from './providers/fallback.js';
import {
  fdIncomeStatements,
  fdBalanceSheets,
  fdCashFlowStatements,
  fdAllFinancialStatements,
} from './providers/financialdatasets.js';
import {
  fmpIncomeStatements,
  fmpBalanceSheets,
  fmpCashFlowStatements,
} from './providers/fmp.js';
import {
  avIncomeStatements,
  avBalanceSheets,
  avCashFlowStatements,
} from './providers/alphavantage.js';

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
    .default(10)
    .describe(
      'Maximum number of report periods to return (default: 10). Returns the most recent N periods based on the period type.'
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

export const getIncomeStatements = new DynamicStructuredTool({
  name: 'get_income_statements',
  description: `Fetches a company's income statements, detailing its revenues, expenses, net income, etc. over a reporting period. Useful for evaluating a company's profitability and operational efficiency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const params = createParams(input);
    const result = await runFinanceProviderChain('get_income_statements', [
      {
        provider: 'financialdatasets',
        run: async () => {
          const { data, url } = await fdIncomeStatements(params);
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'fmp',
        run: async () => {
          const { data, url } = await fmpIncomeStatements({
            ticker: input.ticker,
            period: input.period,
            limit: input.limit,
            report_period_gt: input.report_period_gt,
            report_period_gte: input.report_period_gte,
            report_period_lt: input.report_period_lt,
            report_period_lte: input.report_period_lte,
          });
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'alphavantage',
        run: async () => {
          const { data, url } = await avIncomeStatements({
            ticker: input.ticker,
            period: input.period,
            limit: input.limit,
            report_period_gt: input.report_period_gt,
            report_period_gte: input.report_period_gte,
            report_period_lt: input.report_period_lt,
            report_period_lte: input.report_period_lte,
          });
          return { data, sourceUrls: [url] };
        },
      },
    ]);

    return formatToolResult(result.data, result.sourceUrls);
  },
});

export const getBalanceSheets = new DynamicStructuredTool({
  name: 'get_balance_sheets',
  description: `Retrieves a company's balance sheets, providing a snapshot of its assets, liabilities, shareholders' equity, etc. at a specific point in time. Useful for assessing a company's financial position.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const params = createParams(input);
    const result = await runFinanceProviderChain('get_balance_sheets', [
      {
        provider: 'financialdatasets',
        run: async () => {
          const { data, url } = await fdBalanceSheets(params);
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'fmp',
        run: async () => {
          const { data, url } = await fmpBalanceSheets({
            ticker: input.ticker,
            period: input.period,
            limit: input.limit,
            report_period_gt: input.report_period_gt,
            report_period_gte: input.report_period_gte,
            report_period_lt: input.report_period_lt,
            report_period_lte: input.report_period_lte,
          });
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'alphavantage',
        run: async () => {
          const { data, url } = await avBalanceSheets({
            ticker: input.ticker,
            period: input.period,
            limit: input.limit,
            report_period_gt: input.report_period_gt,
            report_period_gte: input.report_period_gte,
            report_period_lt: input.report_period_lt,
            report_period_lte: input.report_period_lte,
          });
          return { data, sourceUrls: [url] };
        },
      },
    ]);

    return formatToolResult(result.data, result.sourceUrls);
  },
});

export const getCashFlowStatements = new DynamicStructuredTool({
  name: 'get_cash_flow_statements',
  description: `Retrieves a company's cash flow statements, showing how cash is generated and used across operating, investing, and financing activities. Useful for understanding a company's liquidity and solvency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const params = createParams(input);
    const result = await runFinanceProviderChain('get_cash_flow_statements', [
      {
        provider: 'financialdatasets',
        run: async () => {
          const { data, url } = await fdCashFlowStatements(params);
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'fmp',
        run: async () => {
          const { data, url } = await fmpCashFlowStatements({
            ticker: input.ticker,
            period: input.period,
            limit: input.limit,
            report_period_gt: input.report_period_gt,
            report_period_gte: input.report_period_gte,
            report_period_lt: input.report_period_lt,
            report_period_lte: input.report_period_lte,
          });
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'alphavantage',
        run: async () => {
          const { data, url } = await avCashFlowStatements({
            ticker: input.ticker,
            period: input.period,
            limit: input.limit,
            report_period_gt: input.report_period_gt,
            report_period_gte: input.report_period_gte,
            report_period_lt: input.report_period_lt,
            report_period_lte: input.report_period_lte,
          });
          return { data, sourceUrls: [url] };
        },
      },
    ]);

    return formatToolResult(result.data, result.sourceUrls);
  },
});

export const getAllFinancialStatements = new DynamicStructuredTool({
  name: 'get_all_financial_statements',
  description: `Retrieves all three financial statements (income statements, balance sheets, and cash flow statements) for a company in a single API call. This is more efficient than calling each statement type separately when you need all three for comprehensive financial analysis.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const params = createParams(input);
    const result = await runFinanceProviderChain('get_all_financial_statements', [
      {
        provider: 'financialdatasets',
        run: async () => {
          const { data, url } = await fdAllFinancialStatements(params);
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'fmp',
        run: async () => {
          const [income, balance, cashflow] = await Promise.all([
            fmpIncomeStatements({
              ticker: input.ticker,
              period: input.period,
              limit: input.limit,
              report_period_gt: input.report_period_gt,
              report_period_gte: input.report_period_gte,
              report_period_lt: input.report_period_lt,
              report_period_lte: input.report_period_lte,
            }),
            fmpBalanceSheets({
              ticker: input.ticker,
              period: input.period,
              limit: input.limit,
              report_period_gt: input.report_period_gt,
              report_period_gte: input.report_period_gte,
              report_period_lt: input.report_period_lt,
              report_period_lte: input.report_period_lte,
            }),
            fmpCashFlowStatements({
              ticker: input.ticker,
              period: input.period,
              limit: input.limit,
              report_period_gt: input.report_period_gt,
              report_period_gte: input.report_period_gte,
              report_period_lt: input.report_period_lt,
              report_period_lte: input.report_period_lte,
            }),
          ]);
          return {
            data: {
              income_statements: income.data,
              balance_sheets: balance.data,
              cash_flow_statements: cashflow.data,
            },
            sourceUrls: [income.url, balance.url, cashflow.url],
          };
        },
      },
      {
        provider: 'alphavantage',
        run: async () => {
          const [income, balance, cashflow] = await Promise.all([
            avIncomeStatements({
              ticker: input.ticker,
              period: input.period,
              limit: input.limit,
              report_period_gt: input.report_period_gt,
              report_period_gte: input.report_period_gte,
              report_period_lt: input.report_period_lt,
              report_period_lte: input.report_period_lte,
            }),
            avBalanceSheets({
              ticker: input.ticker,
              period: input.period,
              limit: input.limit,
              report_period_gt: input.report_period_gt,
              report_period_gte: input.report_period_gte,
              report_period_lt: input.report_period_lt,
              report_period_lte: input.report_period_lte,
            }),
            avCashFlowStatements({
              ticker: input.ticker,
              period: input.period,
              limit: input.limit,
              report_period_gt: input.report_period_gt,
              report_period_gte: input.report_period_gte,
              report_period_lt: input.report_period_lt,
              report_period_lte: input.report_period_lte,
            }),
          ]);
          return {
            data: {
              income_statements: income.data,
              balance_sheets: balance.data,
              cash_flow_statements: cashflow.data,
            },
            sourceUrls: [income.url, balance.url, cashflow.url],
          };
        },
      },
    ]);

    return formatToolResult(result.data, result.sourceUrls);
  },
});
