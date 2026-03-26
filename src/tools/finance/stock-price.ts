import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';

export const STOCK_PRICE_DESCRIPTION = `
Fetches current stock price snapshots for equities, including open, high, low, close prices, volume, and market cap. Powered by Polygon.io.
`.trim();

const StockPriceInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch current price for. For example, 'AAPL' for Apple."),
});

export const getStockPrice = new DynamicStructuredTool({
  name: 'get_stock_price',
  description:
    'Fetches the current stock price snapshot for an equity ticker, including open, high, low, close prices, volume, and market cap.',
  schema: StockPriceInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const { data, url } = await api.get(
      `/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`,
    );
    const snapshot = (data.ticker as Record<string, unknown>) || {};
    return formatToolResult(snapshot, [url]);
  },
});

const StockPricesInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch historical prices for. For example, 'AAPL' for Apple."),
  interval: z
    .enum(['day', 'week', 'month', 'year'])
    .default('day')
    .describe("The time interval for price data. Defaults to 'day'."),
  start_date: z.string().describe('Start date in YYYY-MM-DD format. Required.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format. Required.'),
});

export const getStockPrices = new DynamicStructuredTool({
  name: 'get_stock_prices',
  description:
    'Retrieves historical price data for a stock over a specified date range, including open, high, low, close prices and volume.',
  schema: StockPricesInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const endpoint = `/v2/aggs/ticker/${ticker}/range/1/${input.interval}/${input.start_date}/${input.end_date}`;
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

export const getStockTickers = new DynamicStructuredTool({
  name: 'get_available_stock_tickers',
  description: 'Searches for stock tickers by name or symbol. Use to look up ticker symbols.',
  schema: z.object({
    search: z.string().optional().describe('Search term to filter tickers (e.g., "Apple" or "AAPL").'),
  }),
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {
      market: 'stocks',
      active: 'true',
      limit: 20,
      search: input.search,
    };
    const { data, url } = await api.get('/v3/reference/tickers', params);
    return formatToolResult(data.results || [], [url]);
  },
});
