import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { fmp } from './api.js';
import { formatToolResult } from '../types.js';

export const getKeyRatios = new DynamicStructuredTool({
  name: 'get_financial_metrics_snapshot',
  description:
    'Fetches the latest financial metrics snapshot via FMP, including valuation ratios (P/E, P/B, P/S, EV/EBITDA, PEG), profitability (margins, ROE, ROA, ROIC), liquidity (current/quick ratios), leverage (debt/equity), per-share metrics (EPS, book value, FCF), and growth rates.',
  schema: z.object({
    ticker: z
      .string()
      .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  }),
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const { data, url } = await fmp.get(`/key-metrics-ttm/${ticker}`);
    const metrics = Array.isArray(data) ? data[0] : data;
    return formatToolResult(metrics || {}, [url]);
  },
});

export const getHistoricalKeyRatios = new DynamicStructuredTool({
  name: 'get_key_ratios',
  description: `Retrieves historical key financial ratios via FMP for trend analysis of P/E, margins, ROE, EPS, enterprise value, etc. over multiple periods.`,
  schema: z.object({
    ticker: z
      .string()
      .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
    period: z
      .enum(['annual', 'quarter'])
      .default('annual')
      .describe("Reporting period: 'annual' or 'quarter'."),
    limit: z
      .number()
      .default(4)
      .describe('Number of past periods to retrieve (default: 4).'),
  }),
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const { data, url } = await fmp.get(`/key-metrics/${ticker}`, {
      period: input.period,
      limit: input.limit,
    });
    return formatToolResult(Array.isArray(data) ? data : [], [url]);
  },
});
