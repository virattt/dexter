import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import yahooFinance from 'yahoo-finance2';
import { formatToolResult } from '../types.js';

const PriceSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch the price snapshot for. For example, 'AAPL' for Apple."
    ),
});

export const getPriceSnapshot = new DynamicStructuredTool({
  name: 'get_price_snapshot',
  description: `Fetches the most recent price snapshot for a stock from Yahoo Finance, including the latest price, trading volume, market cap, day range, and 52-week range.`,
  schema: PriceSnapshotInputSchema,
  func: async (input) => {
    const quote = await yahooFinance.quote(input.ticker.toUpperCase()) as Record<string, unknown>;

    const snapshot = {
      ticker: quote.symbol,
      price: quote.regularMarketPrice,
      previousClose: quote.regularMarketPreviousClose,
      open: quote.regularMarketOpen,
      dayHigh: quote.regularMarketDayHigh,
      dayLow: quote.regularMarketDayLow,
      volume: quote.regularMarketVolume,
      marketCap: quote.marketCap,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      currency: quote.currency,
      exchange: quote.fullExchangeName,
      marketState: quote.marketState,
    };

    return formatToolResult(snapshot, []);
  },
});

const PricesInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch historical prices for. For example, 'AAPL' for Apple."
    ),
  interval: z
    .enum(['1d', '1wk', '1mo'])
    .default('1d')
    .describe("The time interval for price data. '1d' for daily, '1wk' for weekly, '1mo' for monthly."),
  start_date: z.string().describe('Start date in YYYY-MM-DD format. Must be in past. Required.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format. Must be today or in the past. Required.'),
});

export const getPrices = new DynamicStructuredTool({
  name: 'get_prices',
  description: `Retrieves historical price data for a stock from Yahoo Finance over a specified date range, including open, high, low, close prices, and volume.`,
  schema: PricesInputSchema,
  func: async (input) => {
    const result = await yahooFinance.chart(input.ticker.toUpperCase(), {
      period1: input.start_date,
      period2: input.end_date,
      interval: input.interval as '1d' | '1wk' | '1mo',
    }) as Record<string, unknown>;

    const quotes = (result.quotes ?? []) as Array<Record<string, unknown>>;
    const prices = quotes.map((quote) => ({
      date: quote.date instanceof Date ? quote.date.toISOString().split('T')[0] : String(quote.date),
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume,
    }));

    return formatToolResult(prices, []);
  },
});
