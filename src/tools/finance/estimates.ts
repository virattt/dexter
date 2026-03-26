import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { fmp } from './api.js';
import { formatToolResult } from '../types.js';

export const getAnalystEstimates = new DynamicStructuredTool({
  name: 'get_analyst_estimates',
  description: `Retrieves analyst consensus estimates via FMP, including estimated revenue, EPS, EBITDA, SGA, and net income. Useful for understanding consensus expectations and future growth prospects.`,
  schema: z.object({
    ticker: z
      .string()
      .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
    period: z
      .enum(['annual', 'quarter'])
      .default('annual')
      .describe("Period for estimates: 'annual' or 'quarter'."),
    limit: z
      .number()
      .default(4)
      .describe('Number of estimate periods to return (default: 4).'),
  }),
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const { data, url } = await fmp.get(`/analyst-estimates/${ticker}`, {
      period: input.period,
      limit: input.limit,
    });
    return formatToolResult(Array.isArray(data) ? data : [], [url]);
  },
});
