import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { symbolSearch } from './api.js';

export const tastytradeSymbolSearchTool = new DynamicStructuredTool({
  name: 'tastytrade_symbol_search',
  description: 'Search tastytrade symbols by prefix or phrase. Returns symbol and description.',
  schema: z.object({
    query: z.string().describe('Search prefix or phrase, e.g. AAPL, SPY, or company name.'),
  }),
  func: async (input) => {
    const query = input.query.trim();
    if (!query) {
      return JSON.stringify({ error: 'query is required.' });
    }
    const res = await symbolSearch(query);
    return JSON.stringify({ query, results: res.data });
  },
});
