import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api, stripFieldsDeep } from './api.js';
import { formatToolResult } from '../types.js';
import { tavilySearch } from '../search/tavily.js';

const REDUNDANT_FINANCIAL_FIELDS = ['accession_number', 'currency', 'period'] as const;

const KeyRatiosInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch key ratios for. For example, 'AAPL' for Apple."),
});

export const getKeyRatios = new DynamicStructuredTool({
  name: 'get_key_ratios',
  description:
    'Fetches the latest financial metrics snapshot for a company, including valuation ratios (P/E, P/B, P/S, EV/EBITDA, PEG), profitability (margins, ROE, ROA, ROIC), liquidity (current/quick/cash ratios), leverage (debt/equity, debt/assets), per-share metrics (EPS, book value, FCF), and growth rates (revenue, earnings, EPS, FCF, EBITDA). Falls back to web search if the primary API is unavailable.',
  schema: KeyRatiosInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    try {
      const { data, url } = await api.get('/financial-metrics/snapshot/', { ticker });
      return formatToolResult(data.snapshot || {}, [url]);
    } catch {
      // Primary API failed (402 or network) — fall back to Tavily web search
      if (process.env.TAVILY_API_KEY) {
        try {
          return await tavilySearch.invoke({
            query: `${ticker} key financial ratios P/E EV/EBITDA profit margins ROE return on equity 2024 2025`,
          });
        } catch {
          // Tavily also failed — fall through to structured error
        }
      }
      return formatToolResult(
        { error: `Key ratios unavailable for ${ticker}. Use web_search to find current P/E, EV/EBITDA, and margin data.` },
        [],
      );
    }
  },
});

const HistoricalKeyRatiosInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch historical key ratios for. For example, 'AAPL' for Apple."
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

export const getHistoricalKeyRatios = new DynamicStructuredTool({
  name: 'get_historical_key_ratios',
  description: `Retrieves historical key ratios for a company, such as P/E ratio, revenue per share, and enterprise value, over a specified period. Useful for trend analysis and historical performance evaluation.`,
  schema: HistoricalKeyRatiosInputSchema,
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
    try {
      const { data, url } = await api.get('/financial-metrics/', params);
      return formatToolResult(
        stripFieldsDeep(data.financial_metrics || [], REDUNDANT_FINANCIAL_FIELDS),
        [url],
      );
    } catch {
      // Primary API failed — fall back to Tavily web search
      const ticker = input.ticker.trim().toUpperCase();
      if (process.env.TAVILY_API_KEY) {
        try {
          return await tavilySearch.invoke({
            query: `${ticker} historical P/E ratio EV/EBITDA margins valuation trend 2022 2023 2024`,
          });
        } catch {
          // Tavily also failed
        }
      }
      return formatToolResult(
        { error: `Historical key ratios unavailable for ${ticker}. Use web_search to find historical valuation trends.` },
        [],
      );
    }
  },
});
