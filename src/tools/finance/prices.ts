import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { runFinanceProviderChain } from './providers/fallback.js';
import { fdPriceSnapshot, fdPrices } from './providers/financialdatasets.js';
import { fmpPriceSnapshot, fmpPrices } from './providers/fmp.js';
import { avPriceSnapshot, avPrices } from './providers/alphavantage.js';

const PriceSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch the price snapshot for. For example, 'AAPL' for Apple."
    ),
});

export const getPriceSnapshot = new DynamicStructuredTool({
  name: 'get_price_snapshot',
  description: `Fetches the most recent price snapshot for a specific stock ticker, including the latest price, trading volume, and other open, high, low, and close price data.`,
  schema: PriceSnapshotInputSchema,
  func: async (input) => {
    const result = await runFinanceProviderChain('get_price_snapshot', [
      {
        provider: 'financialdatasets',
        run: async () => {
          const { data, url } = await fdPriceSnapshot(input.ticker);
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'fmp',
        run: async () => {
          const { data, url } = await fmpPriceSnapshot(input.ticker);
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'alphavantage',
        run: async () => {
          const { data, url } = await avPriceSnapshot(input.ticker);
          return { data, sourceUrls: [url] };
        },
      },
    ]);

    return formatToolResult(result.data, result.sourceUrls);
  },
});

const PricesInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch aggregated prices for. For example, 'AAPL' for Apple."
    ),
  interval: z
    .enum(['minute', 'day', 'week', 'month', 'year'])
    .default('day')
    .describe("The time interval for price data. Defaults to 'day'."),
  interval_multiplier: z
    .number()
    .default(1)
    .describe('Multiplier for the interval. Defaults to 1.'),
  start_date: z.string().describe('Start date in YYYY-MM-DD format. Must be in past. Required.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format. Must be today or in the past. Required.'),
});

export const getPrices = new DynamicStructuredTool({
  name: 'get_prices',
  description: `Retrieves historical price data for a stock over a specified date range, including open, high, low, close prices, and volume.`,
  schema: PricesInputSchema,
  func: async (input) => {
    // Cache when the date window is fully closed (OHLCV data is final)
    const endDate = new Date(input.end_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await runFinanceProviderChain('get_prices', [
      {
        provider: 'financialdatasets',
        run: async () => {
          const { data, url } = await fdPrices(
            {
              ticker: input.ticker,
              interval: input.interval,
              interval_multiplier: input.interval_multiplier,
              start_date: input.start_date,
              end_date: input.end_date,
            },
            { cacheable: endDate < today }
          );
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'fmp',
        run: async () => {
          const { data, url } = await fmpPrices({
            ticker: input.ticker,
            interval: input.interval,
            interval_multiplier: input.interval_multiplier,
            start_date: input.start_date,
            end_date: input.end_date,
          });
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'alphavantage',
        run: async () => {
          const { data, url } = await avPrices({
            ticker: input.ticker,
            interval: input.interval,
            interval_multiplier: input.interval_multiplier,
            start_date: input.start_date,
            end_date: input.end_date,
          });
          return { data, sourceUrls: [url] };
        },
      },
    ]);

    return formatToolResult(result.data, result.sourceUrls);
  },
});
