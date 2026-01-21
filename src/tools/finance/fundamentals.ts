import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

/**
 * Parse a number from Alpha Vantage response (handles 'None' and undefined)
 */
function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === 'None' || value === '-') {
    return null;
  }
  const num = parseFloat(String(value));
  return isNaN(num) ? null : num;
}

/**
 * Transform Alpha Vantage financial report data to consistent format
 */
function transformReport(report: Record<string, unknown>): Record<string, unknown> {
  const transformed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(report)) {
    if (key === 'fiscalDateEnding' || key === 'reportedCurrency') {
      transformed[key] = value;
    } else {
      transformed[key] = parseNumber(value);
    }
  }
  return transformed;
}

/**
 * Filter reports by period type and limit
 */
function filterReports(
  data: Record<string, unknown>,
  periodType: 'annual' | 'quarterly',
  limit: number
): Record<string, unknown>[] {
  const key = periodType === 'annual' ? 'annualReports' : 'quarterlyReports';
  const reports = data[key] as Array<Record<string, unknown>> || [];
  return reports.slice(0, limit).map(transformReport);
}

const FinancialStatementsInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch financial statements for. For example, 'AAPL' for Apple."
    ),
  period: z
    .enum(['annual', 'quarterly'])
    .default('annual')
    .describe(
      "The reporting period for the financial statements. 'annual' for yearly reports, 'quarterly' for quarterly reports."
    ),
  limit: z
    .number()
    .default(5)
    .describe(
      'Maximum number of report periods to return (default: 5). Returns the most recent N periods.'
    ),
});

export const getIncomeStatements = new DynamicStructuredTool({
  name: 'get_income_statements',
  description: `Fetches a company's income statements, detailing revenues, expenses, gross profit, operating income, EBITDA, and net income over reporting periods. Useful for evaluating a company's profitability and operational efficiency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const params = { symbol: input.ticker };
    const { data, url } = await callApi('INCOME_STATEMENT', params);

    const result = {
      symbol: data['symbol'],
      reports: filterReports(data, input.period, input.limit),
    };

    return formatToolResult(result, [url]);
  },
});

export const getBalanceSheets = new DynamicStructuredTool({
  name: 'get_balance_sheets',
  description: `Retrieves a company's balance sheets, providing a snapshot of total assets, total liabilities, shareholders' equity, cash, debt, and other financial positions at specific points in time. Useful for assessing a company's financial health and capital structure.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const params = { symbol: input.ticker };
    const { data, url } = await callApi('BALANCE_SHEET', params);

    const result = {
      symbol: data['symbol'],
      reports: filterReports(data, input.period, input.limit),
    };

    return formatToolResult(result, [url]);
  },
});

export const getCashFlowStatements = new DynamicStructuredTool({
  name: 'get_cash_flow_statements',
  description: `Retrieves a company's cash flow statements, showing how cash is generated and used across operating activities, investing activities, and financing activities. Includes metrics like free cash flow, capital expenditures, and dividend payments. Useful for understanding a company's liquidity and solvency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const params = { symbol: input.ticker };
    const { data, url } = await callApi('CASH_FLOW', params);

    const result = {
      symbol: data['symbol'],
      reports: filterReports(data, input.period, input.limit),
    };

    return formatToolResult(result, [url]);
  },
});

const AllFinancialStatementsInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch financial statements for. For example, 'AAPL' for Apple."
    ),
  period: z
    .enum(['annual', 'quarterly'])
    .default('annual')
    .describe(
      "The reporting period for the financial statements. 'annual' for yearly reports, 'quarterly' for quarterly reports."
    ),
  limit: z
    .number()
    .default(5)
    .describe(
      'Maximum number of report periods to return for each statement type (default: 5).'
    ),
});

export const getAllFinancialStatements = new DynamicStructuredTool({
  name: 'get_all_financial_statements',
  description: `Retrieves all three financial statements (income statements, balance sheets, and cash flow statements) for a company. This provides comprehensive financial data for thorough analysis of a company's financial health, profitability, and cash generation.`,
  schema: AllFinancialStatementsInputSchema,
  func: async (input) => {
    const params = { symbol: input.ticker };

    // Fetch all three statements in parallel
    const [incomeResult, balanceResult, cashFlowResult] = await Promise.all([
      callApi('INCOME_STATEMENT', params),
      callApi('BALANCE_SHEET', params),
      callApi('CASH_FLOW', params),
    ]);

    const result = {
      symbol: input.ticker,
      incomeStatements: filterReports(incomeResult.data, input.period, input.limit),
      balanceSheets: filterReports(balanceResult.data, input.period, input.limit),
      cashFlowStatements: filterReports(cashFlowResult.data, input.period, input.limit),
    };

    const urls = [incomeResult.url, balanceResult.url, cashFlowResult.url];
    return formatToolResult(result, urls);
  },
});
