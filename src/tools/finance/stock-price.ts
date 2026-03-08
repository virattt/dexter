import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import {
  getQuote,
  hasFinnhubKey,
  isFdRetryableWithFallback,
} from './finnhub.js';
import { formatToolResult } from '../types.js';

export const STOCK_PRICE_DESCRIPTION = `
Fetches current stock price snapshots for equities, including open, high, low, close prices, volume, and market cap. Powered by Financial Datasets; Finnhub used as fallback when FD is unavailable.
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
    const params = { ticker };
    try {
      const { data, url } = await callApi('/prices/snapshot/', params);
      return formatToolResult(data.snapshot || {}, [url]);
    } catch (fdError) {
      if (isFdRetryableWithFallback(fdError) && hasFinnhubKey()) {
        const snapshot = await getQuote(ticker);
        return formatToolResult(snapshot, ['https://finnhub.io']);
      }
      throw fdError;
    }
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

const INTERVAL_TO_RESOLUTION = { day: 'D', week: 'W', month: 'M', year: 'M' } as const;

export const getStockPrices = new DynamicStructuredTool({
  name: 'get_stock_prices',
  description:
    'Retrieves historical price data for a stock over a specified date range, including open, high, low, close prices and volume.',
  schema: StockPricesInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const params = {
      ticker,
      interval: input.interval,
      start_date: input.start_date,
      end_date: input.end_date,
    };
    const endDate = new Date(input.end_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cacheable = endDate < today;
    try {
      const { data, url } = await callApi('/prices/', params, { cacheable });
      return formatToolResult(data.prices || [], [url]);
    } catch (fdError) {
      if (isFdRetryableWithFallback(fdError) && hasFinnhubKey()) {
        const { getCandles } = await import('./finnhub.js');
        const resolution = INTERVAL_TO_RESOLUTION[input.interval] ?? 'D';
        const prices = await getCandles(ticker, resolution, input.start_date, input.end_date);
        return formatToolResult(prices, ['https://finnhub.io']);
      }
      throw fdError;
    }
  },
});

export const getStockTickers = new DynamicStructuredTool({
  name: 'get_available_stock_tickers',
  description: 'Retrieves the list of available stock tickers that can be used with the stock price tools.',
  schema: z.object({}),
  func: async () => {
    const { data, url } = await callApi('/prices/snapshot/tickers/', {});
    return formatToolResult(data.tickers || [], [url]);
  },
});
