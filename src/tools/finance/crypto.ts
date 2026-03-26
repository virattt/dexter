import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';

const CryptoPriceSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The crypto ticker symbol in Polygon format. Use 'X:BTCUSD' for Bitcoin in USD, 'X:ETHUSD' for Ethereum in USD."
    ),
});

export const getCryptoPriceSnapshot = new DynamicStructuredTool({
  name: 'get_crypto_price_snapshot',
  description: `Fetches the most recent price snapshot for a cryptocurrency. Ticker format: 'X:BTCUSD' for Bitcoin/USD, 'X:ETHUSD' for Ethereum/USD.`,
  schema: CryptoPriceSnapshotInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const { data, url } = await api.get(
      `/v2/snapshot/locale/global/markets/crypto/tickers/${ticker}`,
    );
    const snapshot = (data.ticker as Record<string, unknown>) || {};
    return formatToolResult(snapshot, [url]);
  },
});

const CryptoPricesInputSchema = z.object({
  ticker: z
    .string()
    .describe("The crypto ticker symbol in Polygon format. For example, 'X:BTCUSD' for Bitcoin in USD."),
  interval: z
    .enum(['minute', 'hour', 'day', 'week', 'month'])
    .default('day')
    .describe("The time interval for price data. Defaults to 'day'."),
  interval_multiplier: z
    .number()
    .default(1)
    .describe('Multiplier for the interval. Defaults to 1.'),
  start_date: z.string().describe('Start date in YYYY-MM-DD format. Required.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format. Required.'),
});

export const getCryptoPrices = new DynamicStructuredTool({
  name: 'get_crypto_prices',
  description: `Retrieves historical price data for a cryptocurrency over a specified date range. Ticker format: 'X:BTCUSD' for Bitcoin/USD.`,
  schema: CryptoPricesInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const endpoint = `/v2/aggs/ticker/${ticker}/range/${input.interval_multiplier}/${input.interval}/${input.start_date}/${input.end_date}`;
    const endDate = new Date(input.end_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data, url } = await api.get(
      endpoint,
      { adjusted: 'true', sort: 'asc' },
      { cacheable: endDate < today },
    );
    return formatToolResult(data.results || [], [url]);
  },
});

export const getCryptoTickers = new DynamicStructuredTool({
  name: 'get_available_crypto_tickers',
  description: `Searches for available cryptocurrency tickers.`,
  schema: z.object({
    search: z.string().optional().describe('Search term to filter crypto tickers (e.g., "Bitcoin").'),
  }),
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {
      market: 'crypto',
      active: 'true',
      limit: 20,
      search: input.search,
    };
    const { data, url } = await api.get('/v3/reference/tickers', params);
    return formatToolResult(data.results || [], [url]);
  },
});
