import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { finnhub } from './api.js';
import { formatToolResult } from '../types.js';

export const getInsiderTrades = new DynamicStructuredTool({
  name: 'get_insider_trades',
  description: `Retrieves insider trading transactions for a company via Finnhub. Includes purchases and sales by executives, directors, and other insiders sourced from SEC Form 4 filings. Returns insider name, share count, change amount, transaction price, and filing date.`,
  schema: z.object({
    ticker: z
      .string()
      .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  }),
  func: async (input) => {
    const symbol = input.ticker.trim().toUpperCase();
    const { data, url } = await finnhub.get('/stock/insider-transactions', { symbol });
    return formatToolResult(data.data || [], [url]);
  },
});
