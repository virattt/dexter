import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { fmp } from './api.js';
import { formatToolResult } from '../types.js';

export const getEarnings = new DynamicStructuredTool({
  name: 'get_earnings',
  description:
    'Fetches earnings surprises for a company via FMP, including actual vs estimated EPS and revenue, surprise percentages, and reporting dates. Useful for evaluating earnings performance and beat/miss history.',
  schema: z.object({
    ticker: z
      .string()
      .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  }),
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const { data, url } = await fmp.get(`/earnings-surprises/${ticker}`);
    return formatToolResult(Array.isArray(data) ? data : [], [url]);
  },
});
