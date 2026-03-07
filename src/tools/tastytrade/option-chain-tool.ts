import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getOptionChain } from './api.js';

export const tastytradeOptionChainTool = new DynamicStructuredTool({
  name: 'tastytrade_option_chain',
  description: 'Fetch nested option chain for an underlying symbol (expirations, strikes, call/put symbols).',
  schema: z.object({
    underlying_symbol: z
      .string()
      .describe('Underlying ticker, e.g. SPY, AAPL, NVDA, SPX. Use index symbol for 0DTE (e.g. SPX).'),
  }),
  func: async (input) => {
    const symbol = input.underlying_symbol.trim().toUpperCase();
    if (!symbol) {
      return JSON.stringify({ error: 'underlying_symbol is required (e.g. SPY, AAPL, SPX).' });
    }
    const res = await getOptionChain(symbol);
    return JSON.stringify({ underlying_symbol: symbol, option_chain: res.data });
  },
});
