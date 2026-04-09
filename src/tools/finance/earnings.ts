import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';
import { TTL_24H } from './utils.js';

const EarningsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch the latest earnings for. For example, 'AAPL' for Apple."),
});

export const getEarnings = new DynamicStructuredTool({
  name: 'get_earnings',
  description:
    'Fetches the most recent earnings snapshot for a company, including key income statement, balance sheet, and cash flow figures from the 8-K earnings release, plus analyst estimate comparisons (revenue and EPS surprise) when available.',
  schema: EarningsInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const { data, url } = await api.get('/earnings', { ticker }, { cacheable: true, ttlMs: TTL_24H });
    return formatToolResult(data.earnings || {}, [url]);
  },
});
