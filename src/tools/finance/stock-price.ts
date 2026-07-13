import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';

export const STOCK_PRICE_DESCRIPTION = `
Fetches the current stock price snapshot for an equity: latest price and the day's change. For open/high/low/close and volume over a range, use historical prices. Powered by Financial Datasets.
`.trim();

const StockPriceInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch current price for. For example, 'AAPL' for Apple."),
});

export const getStockPrice = new DynamicStructuredTool({
  name: 'get_stock_price',
  description:
    "Fetches the current stock price snapshot for an equity ticker: the latest price and the day's change. Does not include intraday OHLC or volume — use get_stock_prices for historical OHLCV.",
  schema: StockPriceInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const params = { ticker };
    const { data, url } = await api.get('/prices/snapshot/', params);
    return formatToolResult(data.snapshot || {}, [url]);
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
    // The API rejects a zero-width range (start_date == end_date) with a 400.
    // Widen a same-day request back a week so "price on date X" queries return
    // the row for X (or the nearest prior trading day) instead of erroring.
    let startDate = input.start_date;
    if (startDate >= input.end_date) {
      const widened = new Date(input.end_date + 'T00:00:00');
      widened.setDate(widened.getDate() - 7);
      startDate = widened.toISOString().slice(0, 10);
    }
    const params = {
      ticker: input.ticker.trim().toUpperCase(),
      interval: input.interval,
      start_date: startDate,
      end_date: input.end_date,
    };
    // Cache when the date window is fully closed (OHLCV data is final)
    const endDate = new Date(input.end_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data, url } = await api.get('/prices/', params, { cacheable: endDate < today });
    return formatToolResult(data.prices || [], [url]);
  },
});

export const getStockTickers = new DynamicStructuredTool({
  name: 'get_available_stock_tickers',
  description: 'Retrieves the list of available stock tickers that can be used with the stock price tools.',
  schema: z.object({}),
  func: async () => {
    const { data, url } = await api.get('/prices/snapshot/tickers/', {}, { cacheable: true, ttlMs: 24 * 60 * 60 * 1000 });
    return formatToolResult(data.tickers || [], [url]);
  },
});
