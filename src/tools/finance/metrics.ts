import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

const FinancialMetricsSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch financial metrics snapshot for. For example, 'AAPL' for Apple."
    ),
});

export const getFinancialMetricsSnapshot = new DynamicStructuredTool({
  name: 'get_financial_metrics_snapshot',
  description: `Fetches a snapshot of the most current financial metrics for a company, including key indicators like market capitalization, P/E ratio, and dividend yield. Useful for a quick overview of a company's financial health.`,
  schema: FinancialMetricsSnapshotInputSchema,
  func: async (input) => {
    const params = { ticker: input.ticker };
    const { data, url } = await callApi('/financial-metrics/snapshot/', params);
    return formatToolResult(data.snapshot || {}, [url]);
  },
});

const FinancialMetricsInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch financial metrics for. For example, 'AAPL' for Apple."
    ),
  period: z
    .enum(['annual', 'quarterly', 'ttm'])
    .default('ttm')
    .describe(
      "The reporting period. 'annual' for yearly, 'quarterly' for quarterly, and 'ttm' for trailing twelve months."
    ),
  limit: z
    .number()
    .default(4)
    .describe('The number of past financial statements to retrieve.'),
  report_period: z
    .string()
    .optional()
    .describe('Filter for financial metrics with an exact report period date (YYYY-MM-DD).'),
  report_period_gt: z
    .string()
    .optional()
    .describe('Filter for financial metrics with report periods after this date (YYYY-MM-DD).'),
  report_period_gte: z
    .string()
    .optional()
    .describe(
      'Filter for financial metrics with report periods on or after this date (YYYY-MM-DD).'
    ),
  report_period_lt: z
    .string()
    .optional()
    .describe('Filter for financial metrics with report periods before this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe(
      'Filter for financial metrics with report periods on or before this date (YYYY-MM-DD).'
    ),
});

export const getFinancialMetrics = new DynamicStructuredTool({
  name: 'get_financial_metrics',
  description: `Retrieves historical financial metrics for a company, such as P/E ratio, revenue per share, and enterprise value, over a specified period. Useful for trend analysis and historical performance evaluation.`,
  schema: FinancialMetricsInputSchema,
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker,
      period: input.period,
      limit: input.limit,
      report_period: input.report_period,
      report_period_gt: input.report_period_gt,
      report_period_gte: input.report_period_gte,
      report_period_lt: input.report_period_lt,
      report_period_lte: input.report_period_lte,
    };
    const { data, url } = await callApi('/financial-metrics/', params);
    return formatToolResult(data.financial_metrics || [], [url]);
  },
});

