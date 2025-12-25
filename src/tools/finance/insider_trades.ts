import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

const InsiderTradesInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch insider trades for. For example, 'AAPL' for Apple."),
  limit: z
    .number()
    .default(100)
    .describe('Maximum number of insider trades to return (default: 100, max: 1000).'),
  filing_date: z
    .string()
    .optional()
    .describe('Exact filing date to filter by (YYYY-MM-DD).'),
  filing_date_gte: z
    .string()
    .optional()
    .describe('Filter for trades with filing date greater than or equal to this date (YYYY-MM-DD).'),
  filing_date_lte: z
    .string()
    .optional()
    .describe('Filter for trades with filing date less than or equal to this date (YYYY-MM-DD).'),
  filing_date_gt: z
    .string()
    .optional()
    .describe('Filter for trades with filing date greater than this date (YYYY-MM-DD).'),
  filing_date_lt: z
    .string()
    .optional()
    .describe('Filter for trades with filing date less than this date (YYYY-MM-DD).'),
});

export const getInsiderTrades = new DynamicStructuredTool({
  name: 'get_insider_trades',
  description: `Retrieves insider trading transactions for a given company ticker. Insider trades include purchases and sales of company stock by executives, directors, and other insiders. This data is sourced from SEC Form 4 filings. Use filing_date filters to narrow down results by date range.`,
  schema: InsiderTradesInputSchema,
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker.toUpperCase(),
      limit: input.limit,
      filing_date: input.filing_date,
      filing_date_gte: input.filing_date_gte,
      filing_date_lte: input.filing_date_lte,
      filing_date_gt: input.filing_date_gt,
      filing_date_lt: input.filing_date_lt,
    };
    const { data, url } = await callApi('/insider-trades/', params);
    return formatToolResult(data.insider_trades || [], [url]);
  },
});
