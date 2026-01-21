import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

/**
 * Transform Alpha Vantage GLOBAL_QUOTE response to a consistent format
 */
function transformQuote(data: Record<string, unknown>): Record<string, unknown> {
  const quote = data['Global Quote'] as Record<string, string> | undefined;
  if (!quote) {
    return {};
  }

  return {
    symbol: quote['01. symbol'],
    open: parseFloat(quote['02. open']),
    high: parseFloat(quote['03. high']),
    low: parseFloat(quote['04. low']),
    price: parseFloat(quote['05. price']),
    volume: parseInt(quote['06. volume'], 10),
    latestTradingDay: quote['07. latest trading day'],
    previousClose: parseFloat(quote['08. previous close']),
    change: parseFloat(quote['09. change']),
    changePercent: quote['10. change percent'],
  };
}

/**
 * Transform Alpha Vantage time series response to an array of price objects
 */
function transformTimeSeries(
  data: Record<string, unknown>,
  timeSeriesKey: string
): Record<string, unknown>[] {
  const timeSeries = data[timeSeriesKey] as Record<string, Record<string, string>> | undefined;
  if (!timeSeries) {
    return [];
  }

  return Object.entries(timeSeries).map(([date, values]) => ({
    date,
    open: parseFloat(values['1. open']),
    high: parseFloat(values['2. high']),
    low: parseFloat(values['3. low']),
    close: parseFloat(values['4. close']),
    volume: parseInt(values['5. volume'], 10),
  }));
}

/**
 * Transform Alpha Vantage intraday time series response
 */
function transformIntradayTimeSeries(
  data: Record<string, unknown>,
  interval: string
): Record<string, unknown>[] {
  const timeSeriesKey = `Time Series (${interval})`;
  const timeSeries = data[timeSeriesKey] as Record<string, Record<string, string>> | undefined;
  if (!timeSeries) {
    return [];
  }

  return Object.entries(timeSeries).map(([timestamp, values]) => ({
    timestamp,
    open: parseFloat(values['1. open']),
    high: parseFloat(values['2. high']),
    low: parseFloat(values['3. low']),
    close: parseFloat(values['4. close']),
    volume: parseInt(values['5. volume'], 10),
  }));
}

const PriceSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch the price snapshot for. For example, 'AAPL' for Apple."
    ),
});

export const getPriceSnapshot = new DynamicStructuredTool({
  name: 'get_price_snapshot',
  description: `Fetches the most recent price quote for a specific stock ticker, including the latest price, trading volume, open, high, low, previous close, and price change data.`,
  schema: PriceSnapshotInputSchema,
  func: async (input) => {
    const params = { symbol: input.ticker };
    const { data, url } = await callApi('GLOBAL_QUOTE', params);
    return formatToolResult(transformQuote(data), [url]);
  },
});

const PricesInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch historical prices for. For example, 'AAPL' for Apple."
    ),
  interval: z
    .enum(['1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly'])
    .default('daily')
    .describe(
      "The time interval for price data. Use '1min', '5min', '15min', '30min', '60min' for intraday data, or 'daily', 'weekly', 'monthly' for longer intervals. Defaults to 'daily'."
    ),
  outputsize: z
    .enum(['compact', 'full'])
    .default('compact')
    .describe(
      "The amount of data to return. 'compact' returns the latest 100 data points, 'full' returns up to 20+ years of data. Defaults to 'compact'."
    ),
  month: z
    .string()
    .optional()
    .describe(
      "For intraday data only: specific month to query in YYYY-MM format (e.g., '2024-01'). If not specified, returns most recent data."
    ),
});

export const getPrices = new DynamicStructuredTool({
  name: 'get_prices',
  description: `Retrieves historical price data for a stock over time, including open, high, low, close prices, and volume. Supports intraday intervals (1min to 60min) and daily/weekly/monthly intervals.`,
  schema: PricesInputSchema,
  func: async (input) => {
    const isIntraday = ['1min', '5min', '15min', '30min', '60min'].includes(input.interval);

    if (isIntraday) {
      // Use TIME_SERIES_INTRADAY for minute intervals
      const params: Record<string, string | undefined> = {
        symbol: input.ticker,
        interval: input.interval,
        outputsize: input.outputsize,
        month: input.month,
      };
      const { data, url } = await callApi('TIME_SERIES_INTRADAY', params);
      return formatToolResult(transformIntradayTimeSeries(data, input.interval), [url]);
    } else {
      // Use appropriate time series function for daily/weekly/monthly
      let functionName: string;
      let timeSeriesKey: string;

      switch (input.interval) {
        case 'weekly':
          functionName = 'TIME_SERIES_WEEKLY';
          timeSeriesKey = 'Weekly Time Series';
          break;
        case 'monthly':
          functionName = 'TIME_SERIES_MONTHLY';
          timeSeriesKey = 'Monthly Time Series';
          break;
        default:
          functionName = 'TIME_SERIES_DAILY';
          timeSeriesKey = 'Time Series (Daily)';
      }

      const params = {
        symbol: input.ticker,
        outputsize: input.outputsize,
      };
      const { data, url } = await callApi(functionName, params);
      return formatToolResult(transformTimeSeries(data, timeSeriesKey), [url]);
    }
  },
});

const SearchTickerInputSchema = z.object({
  keywords: z
    .string()
    .describe(
      "Search keywords - can be a company name, partial name, or ticker symbol. For example, 'microsoft' or 'MSFT'."
    ),
});

export const searchTicker = new DynamicStructuredTool({
  name: 'search_ticker',
  description: `Search for stock ticker symbols by company name or keywords. Returns matching symbols with company names, regions, and market information. Useful for finding the correct ticker symbol for a company.`,
  schema: SearchTickerInputSchema,
  func: async (input) => {
    const params = { keywords: input.keywords };
    const { data, url } = await callApi('SYMBOL_SEARCH', params);

    const matches = data['bestMatches'] as Array<Record<string, string>> | undefined;
    if (!matches) {
      return formatToolResult([], [url]);
    }

    const results = matches.map((match) => ({
      symbol: match['1. symbol'],
      name: match['2. name'],
      type: match['3. type'],
      region: match['4. region'],
      marketOpen: match['5. marketOpen'],
      marketClose: match['6. marketClose'],
      timezone: match['7. timezone'],
      currency: match['8. currency'],
      matchScore: match['9. matchScore'],
    }));

    return formatToolResult(results, [url]);
  },
});
