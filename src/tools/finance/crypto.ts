import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import YahooFinance from 'yahoo-finance2';
import { formatToolResult } from '../types.js';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const CryptoPriceSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The crypto ticker symbol in Yahoo Finance format. For example, 'BTC-USD' for Bitcoin in USD, 'ETH-USD' for Ethereum."
    ),
});

export const getCryptoPriceSnapshot = new DynamicStructuredTool({
  name: 'get_crypto_price_snapshot',
  description: `Fetches the most recent price snapshot for a cryptocurrency from Yahoo Finance. Ticker format: 'CRYPTO-USD' (e.g., 'BTC-USD' for Bitcoin, 'ETH-USD' for Ethereum, 'SOL-USD' for Solana).`,
  schema: CryptoPriceSnapshotInputSchema,
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
      currency: quote.currency,
    };

    return formatToolResult(snapshot, []);
  },
});

const CryptoPricesInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The crypto ticker symbol in Yahoo Finance format. For example, 'BTC-USD' for Bitcoin."
    ),
  interval: z
    .enum(['1d', '1wk', '1mo'])
    .default('1d')
    .describe("The time interval for price data. '1d' for daily, '1wk' for weekly, '1mo' for monthly."),
  start_date: z.string().describe('Start date in YYYY-MM-DD format. Required.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format. Required.'),
});

export const getCryptoPrices = new DynamicStructuredTool({
  name: 'get_crypto_prices',
  description: `Retrieves historical price data for a cryptocurrency from Yahoo Finance. Ticker format: 'CRYPTO-USD' (e.g., 'BTC-USD', 'ETH-USD').`,
  schema: CryptoPricesInputSchema,
  func: async (input) => {
    const result = await yahooFinance.chart(input.ticker.toUpperCase(), {
      period1: input.start_date,
      period2: input.end_date,
      interval: input.interval as '1d' | '1wk' | '1mo',
    });

    const prices = result.quotes.map((quote) => ({
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
