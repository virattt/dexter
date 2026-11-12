import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';
import { TTL_24H } from './utils.js';

const EarningsInputSchema = z.object({
  ticker: z
    .string()
    .optional()
    .describe("Optional stock ticker symbol to fetch company-specific earnings. Omit to fetch the latest earnings feed across all companies."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Optional number of earnings records to return. For the feed, defaults to 10 and maxes at 100. For a ticker, values above 40 are clamped by the API.'),
});

export const getEarnings = new DynamicStructuredTool({
  name: 'get_earnings',
  description:
    'Fetches earnings data from Financial Datasets. Pass a ticker for company-specific earnings, or omit ticker to fetch the latest earnings feed across all covered companies.',
  schema: EarningsInputSchema,
  func: async (input) => {
    const ticker = input.ticker?.trim().toUpperCase();
    const params = {
      ticker: ticker || undefined,
      limit: input.limit,
    };
    const { data, url } = await api.get('/earnings', params, { cacheable: true, ttlMs: TTL_24H });
    const records = Array.isArray(data?.earnings) ? data.earnings : [];

    if (!ticker || input.limit) {
      return formatToolResult(records, [url]);
    }

    return formatToolResult(records[0] || {}, [url]);
  },
});
