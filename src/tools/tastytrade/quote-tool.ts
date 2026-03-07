import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getQuotes } from './api.js';

export const tastytradeQuoteTool = new DynamicStructuredTool({
  name: 'tastytrade_quote',
  description: 'Fetch live quote (bid, ask, mark, last, volume) for one or more symbols.',
  schema: z.object({
    symbols: z
      .string()
      .describe('Comma-separated symbols, e.g. SPY,AAPL,NVDA. For options use OCC-style symbols.'),
    instrument_type: z
      .enum(['Equity', 'Index', 'Equity Option'])
      .optional()
      .default('Equity')
      .describe('Instrument type: Equity (stocks/ETFs), Index (SPX, VIX), or Equity Option.'),
  }),
  func: async (input) => {
    const list = input.symbols
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (list.length === 0) {
      return JSON.stringify({ error: 'At least one symbol is required.' });
    }
    const res = await getQuotes(list, input.instrument_type ?? 'Equity');
    return JSON.stringify({ symbols: list, instrument_type: input.instrument_type ?? 'Equity', quotes: res.data });
  },
});
