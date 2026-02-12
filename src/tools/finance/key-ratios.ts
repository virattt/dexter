import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { runFinanceProviderChain } from './providers/fallback.js';
import { fdKeyRatiosSnapshot, fdKeyRatios } from './providers/financialdatasets.js';
import { fmpKeyMetricsSnapshot, fmpKeyMetrics } from './providers/fmp.js';
import { avKeyRatiosSnapshot } from './providers/alphavantage.js';

const KeyRatiosSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch key ratios snapshot for. For example, 'AAPL' for Apple."
    ),
});

export const getKeyRatiosSnapshot = new DynamicStructuredTool({
  name: 'get_key_ratios_snapshot',
  description: `Fetches a snapshot of the most current key ratios for a company, including key indicators like market capitalization, P/E ratio, and dividend yield. Useful for a quick overview of a company's financial health.`,
  schema: KeyRatiosSnapshotInputSchema,
  func: async (input) => {
    const result = await runFinanceProviderChain('get_key_ratios_snapshot', [
      {
        provider: 'financialdatasets',
        run: async () => {
          const { data, url } = await fdKeyRatiosSnapshot(input.ticker);
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'fmp',
        run: async () => {
          const { data, url } = await fmpKeyMetricsSnapshot(input.ticker);
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'alphavantage',
        run: async () => {
          const { data, url } = await avKeyRatiosSnapshot(input.ticker);
          return { data, sourceUrls: [url] };
        },
      },
    ]);

    return formatToolResult(result.data, result.sourceUrls);
  },
});

const KeyRatiosInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch key ratios for. For example, 'AAPL' for Apple."
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
    .describe('Filter for key ratios with an exact report period date (YYYY-MM-DD).'),
  report_period_gt: z
    .string()
    .optional()
    .describe('Filter for key ratios with report periods after this date (YYYY-MM-DD).'),
  report_period_gte: z
    .string()
    .optional()
    .describe(
      'Filter for key ratios with report periods on or after this date (YYYY-MM-DD).'
    ),
  report_period_lt: z
    .string()
    .optional()
    .describe('Filter for key ratios with report periods before this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe(
      'Filter for key ratios with report periods on or before this date (YYYY-MM-DD).'
    ),
});

export const getKeyRatios = new DynamicStructuredTool({
  name: 'get_key_ratios',
  description: `Retrieves historical key ratios for a company, such as P/E ratio, revenue per share, and enterprise value, over a specified period. Useful for trend analysis and historical performance evaluation.`,
  schema: KeyRatiosInputSchema,
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

    const reportPeriodGte = input.report_period ?? input.report_period_gte;
    const reportPeriodLte = input.report_period ?? input.report_period_lte;

    const result = await runFinanceProviderChain('get_key_ratios', [
      {
        provider: 'financialdatasets',
        run: async () => {
          const { data, url } = await fdKeyRatios(params);
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'fmp',
        run: async () => {
          const { data, url } = await fmpKeyMetrics({
            ticker: input.ticker,
            period: input.period,
            limit: input.limit,
            report_period_gt: input.report_period_gt,
            report_period_gte: reportPeriodGte,
            report_period_lt: input.report_period_lt,
            report_period_lte: reportPeriodLte,
          });
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'alphavantage',
        run: async () => {
          throw new Error(
            'Alpha Vantage provider does not support historical key metrics in this tool; use FINANCIAL_DATASETS_API_KEY or FMP_API_KEY'
          );
        },
      },
    ]);

    return formatToolResult(result.data, result.sourceUrls);
  },
});
