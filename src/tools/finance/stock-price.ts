import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api, shouldUseFreeUsData } from './api.js';
import { getFreeUsPriceHistory, getFreeUsPriceSnapshot, getFreeUsTickers } from './free-us-poc.js';
import { formatToolResult } from '../types.js';

export const STOCK_PRICE_DESCRIPTION = `
Fetches current stock price snapshots for equities, including open, high, low, close prices, volume, and market cap. Powered by Financial Datasets.
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
    if (shouldUseFreeUsData()) {
      const snapshot = await getFreeUsPriceSnapshot(ticker);
      const latest = snapshot.latestBar;
      return formatToolResult({
        ticker,
        price: snapshot.regularMarketPrice ?? latest?.close,
        close: latest?.close,
        open: latest?.open,
        high: latest?.high,
        low: latest?.low,
        volume: latest?.volume,
        previous_close: snapshot.previousClose,
        exchange: snapshot.exchange,
        currency: snapshot.currency,
      }, [snapshot.sourceUrl]);
    }
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
    if (shouldUseFreeUsData()) {
      const { prices, sourceUrl } = await getFreeUsPriceHistory(
        input.ticker.trim().toUpperCase(),
        input.interval,
        input.start_date,
        input.end_date,
      );
      return formatToolResult(prices, [sourceUrl]);
    }
    const params = {
      ticker: input.ticker.trim().toUpperCase(),
      interval: input.interval,
      start_date: input.start_date,
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
    if (shouldUseFreeUsData()) {
      const tickers = await getFreeUsTickers();
      return formatToolResult(tickers, ['https://www.sec.gov/files/company_tickers.json']);
    }
    const { data, url } = await api.get('/prices/snapshot/tickers/', {}, { cacheable: true, ttlMs: 24 * 60 * 60 * 1000 });
    return formatToolResult(data.tickers || [], [url]);
  },
});
