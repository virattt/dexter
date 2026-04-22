import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export const INDIAN_FUNDAMENTALS_DESCRIPTION = `
Fetches fundamental financial data for Indian companies (NSE/BSE) using Yahoo Finance, including income statements, balance sheets, and cash flow statements.

## When to Use

- Analyzing a company's financial performance over time (annual or quarterly)
- Checking profitability (Income Statement)
- Assessing financial position (Balance Sheet)
- Evaluating cash management (Cash Flow Statement)

## Ticker Format

- Use .NS suffix for NSE (e.g., RELIANCE.NS)
- Use .BS suffix for BSE (e.g., RELIANCE.BS)
`.trim();

const IndianFinancialStatementsInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The Indian stock ticker symbol to fetch financial statements for. Use .NS for NSE or .BS for BSE suffix. For example, 'RELIANCE.NS' for Reliance Industries on NSE."
    ),
  period: z
    .enum(['annual', 'quarterly'])
    .default('annual')
    .describe(
      "The reporting period for the financial statements. 'annual' for yearly, 'quarterly' for quarterly."
    ),
});

function formatTicker(ticker: string): string {
  let t = ticker.trim().toUpperCase();
  // Yahoo Finance uses .NS for NSE, .BO for BSE (Bombay Stock Exchange)
  if (!t.endsWith('.NS') && !t.endsWith('.BO') && !t.endsWith('.BSE')) {
    t = `${t}.NS`;
  }
  return t;
}

export const getIndianIncomeStatement = new DynamicStructuredTool({
  name: 'get_indian_income_statement',
  description: `Fetches an Indian company's income statements, detailing its revenues, expenses, net income, etc. over a reporting period.`,
  schema: IndianFinancialStatementsInputSchema,
  func: async (input) => {
    const ticker = formatTicker(input.ticker);
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: [input.period === 'annual' ? 'incomeStatementHistory' : 'incomeStatementHistoryQuarterly'],
      });
      const data = input.period === 'annual' 
        ? result.incomeStatementHistory?.incomeStatementHistory 
        : result.incomeStatementHistoryQuarterly?.incomeStatementHistory;
      
      return formatToolResult(data || [], [`https://finance.yahoo.com/quote/${ticker}/financials`]);
    } catch (error) {
      logger.error(`[Indian Fundamentals API] Income statement failed for ${ticker}: ${error.message}`);
      return formatToolResult({ error: `Failed to fetch income statement for ${ticker}.` });
    }
  },
});

export const getIndianBalanceSheet = new DynamicStructuredTool({
  name: 'get_indian_balance_sheet',
  description: `Retrieves an Indian company's balance sheets, providing a snapshot of its assets, liabilities, and shareholders' equity.`,
  schema: IndianFinancialStatementsInputSchema,
  func: async (input) => {
    const ticker = formatTicker(input.ticker);
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: [input.period === 'annual' ? 'balanceSheetHistory' : 'balanceSheetHistoryQuarterly'],
      });
      const data = input.period === 'annual' 
        ? result.balanceSheetHistory?.balanceSheetStatements 
        : result.balanceSheetHistoryQuarterly?.balanceSheetStatements;
      
      return formatToolResult(data || [], [`https://finance.yahoo.com/quote/${ticker}/balance-sheet`]);
    } catch (error) {
      logger.error(`[Indian Fundamentals API] Balance sheet failed for ${ticker}: ${error.message}`);
      return formatToolResult({ error: `Failed to fetch balance sheet for ${ticker}.` });
    }
  },
});

export const getIndianCashFlowStatement = new DynamicStructuredTool({
  name: 'get_indian_cash_flow_statement',
  description: `Retrieves an Indian company's cash flow statements, showing cash movements across operating, investing, and financing activities.`,
  schema: IndianFinancialStatementsInputSchema,
  func: async (input) => {
    const ticker = formatTicker(input.ticker);
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: [input.period === 'annual' ? 'cashflowStatementHistory' : 'cashflowStatementHistoryQuarterly'],
      });
      const data = input.period === 'annual' 
        ? result.cashflowStatementHistory?.cashflowStatements 
        : result.cashflowStatementHistoryQuarterly?.cashflowStatements;
      
      return formatToolResult(data || [], [`https://finance.yahoo.com/quote/${ticker}/cash-flow`]);
    } catch (error) {
      logger.error(`[Indian Fundamentals API] Cash flow failed for ${ticker}: ${error.message}`);
      return formatToolResult({ error: `Failed to fetch cash flow statement for ${ticker}.` });
    }
  },
});

export const getIndianKeyRatios = new DynamicStructuredTool({
  name: 'get_indian_key_ratios',
  description: `Retrieves key financial ratios and metrics for Indian companies including margins, return on equity, and valuation indicators.`,
  schema: z.object({
    ticker: z
      .string()
      .describe(
        "The Indian stock ticker symbol to fetch key ratios for. Use .NS for NSE or .BS for BSE suffix. For example, 'RELIANCE.NS' for Reliance Industries on NSE."
      ),
  }),
  func: async (input) => {
    const ticker = formatTicker(input.ticker);
    try {
      const result: any = await yahooFinance.quoteSummary(ticker, {
        modules: ['financialData', 'defaultKeyStatistics'],
      });
      
      const combined = {
        ...(result.financialData || {}),
        ...(result.defaultKeyStatistics || {}),
      };
      
      return formatToolResult(combined, [`https://finance.yahoo.com/quote/${ticker}/key-statistics`]);
    } catch (error) {
      logger.error(`[Indian Fundamentals API] Key ratios failed for ${ticker}: ${error.message}`);
      return formatToolResult({ error: `Failed to fetch key ratios for ${ticker}.` });
    }
  },
});