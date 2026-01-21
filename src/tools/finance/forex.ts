import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

/**
 * Transform Alpha Vantage FX time series response
 */
function transformFXTimeSeries(
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
  }));
}

/**
 * Transform currency exchange rate response
 */
function transformExchangeRate(data: Record<string, unknown>): Record<string, unknown> {
  const rate = data['Realtime Currency Exchange Rate'] as Record<string, string> | undefined;
  if (!rate) {
    return {};
  }

  return {
    fromCurrencyCode: rate['1. From_Currency Code'],
    fromCurrencyName: rate['2. From_Currency Name'],
    toCurrencyCode: rate['3. To_Currency Code'],
    toCurrencyName: rate['4. To_Currency Name'],
    exchangeRate: parseFloat(rate['5. Exchange Rate']),
    lastRefreshed: rate['6. Last Refreshed'],
    timezone: rate['7. Time Zone'],
    bidPrice: parseFloat(rate['8. Bid Price']),
    askPrice: parseFloat(rate['9. Ask Price']),
  };
}

const CurrencyExchangeRateInputSchema = z.object({
  fromCurrency: z
    .string()
    .describe("The currency code to convert from. For example, 'USD' for US Dollar, 'EUR' for Euro."),
  toCurrency: z
    .string()
    .describe("The currency code to convert to. For example, 'JPY' for Japanese Yen."),
});

export const getCurrencyExchangeRate = new DynamicStructuredTool({
  name: 'get_currency_exchange_rate',
  description: `Retrieves real-time exchange rate between two currencies (physical or digital). Returns current exchange rate, bid/ask prices, and last refresh time. Supports major currencies like USD, EUR, GBP, JPY, and cryptocurrencies like BTC, ETH.`,
  schema: CurrencyExchangeRateInputSchema,
  func: async (input) => {
    const params = {
      from_currency: input.fromCurrency,
      to_currency: input.toCurrency,
    };
    const { data, url } = await callApi('CURRENCY_EXCHANGE_RATE', params);
    return formatToolResult(transformExchangeRate(data), [url]);
  },
});

const FXDailyInputSchema = z.object({
  fromSymbol: z
    .string()
    .describe("The currency code to convert from. For example, 'EUR'."),
  toSymbol: z
    .string()
    .describe("The currency code to convert to. For example, 'USD'."),
  outputsize: z
    .enum(['compact', 'full'])
    .default('compact')
    .describe(
      "'compact' returns latest 100 data points, 'full' returns full history. Defaults to 'compact'."
    ),
});

export const getFXDaily = new DynamicStructuredTool({
  name: 'get_fx_daily',
  description: `Retrieves daily forex (FX) time series data for a currency pair. Returns OHLC (open, high, low, close) prices for each trading day. Useful for analyzing currency trends over time.`,
  schema: FXDailyInputSchema,
  func: async (input) => {
    const params = {
      from_symbol: input.fromSymbol,
      to_symbol: input.toSymbol,
      outputsize: input.outputsize,
    };
    const { data, url } = await callApi('FX_DAILY', params);
    return formatToolResult(transformFXTimeSeries(data, 'Time Series FX (Daily)'), [url]);
  },
});

const FXWeeklyInputSchema = z.object({
  fromSymbol: z
    .string()
    .describe("The currency code to convert from. For example, 'EUR'."),
  toSymbol: z
    .string()
    .describe("The currency code to convert to. For example, 'USD'."),
});

export const getFXWeekly = new DynamicStructuredTool({
  name: 'get_fx_weekly',
  description: `Retrieves weekly forex (FX) time series data for a currency pair. Returns OHLC prices aggregated by week. Useful for longer-term currency trend analysis.`,
  schema: FXWeeklyInputSchema,
  func: async (input) => {
    const params = {
      from_symbol: input.fromSymbol,
      to_symbol: input.toSymbol,
    };
    const { data, url } = await callApi('FX_WEEKLY', params);
    return formatToolResult(transformFXTimeSeries(data, 'Time Series FX (Weekly)'), [url]);
  },
});

const FXMonthlyInputSchema = z.object({
  fromSymbol: z
    .string()
    .describe("The currency code to convert from. For example, 'EUR'."),
  toSymbol: z
    .string()
    .describe("The currency code to convert to. For example, 'USD'."),
});

export const getFXMonthly = new DynamicStructuredTool({
  name: 'get_fx_monthly',
  description: `Retrieves monthly forex (FX) time series data for a currency pair. Returns OHLC prices aggregated by month. Useful for long-term currency trend analysis and historical comparison.`,
  schema: FXMonthlyInputSchema,
  func: async (input) => {
    const params = {
      from_symbol: input.fromSymbol,
      to_symbol: input.toSymbol,
    };
    const { data, url } = await callApi('FX_MONTHLY', params);
    return formatToolResult(transformFXTimeSeries(data, 'Time Series FX (Monthly)'), [url]);
  },
});

const FXIntradayInputSchema = z.object({
  fromSymbol: z
    .string()
    .describe("The currency code to convert from. For example, 'EUR'."),
  toSymbol: z
    .string()
    .describe("The currency code to convert to. For example, 'USD'."),
  interval: z
    .enum(['1min', '5min', '15min', '30min', '60min'])
    .default('5min')
    .describe("Time interval between data points. Defaults to '5min'."),
  outputsize: z
    .enum(['compact', 'full'])
    .default('compact')
    .describe(
      "'compact' returns latest 100 data points, 'full' returns full intraday history. Defaults to 'compact'."
    ),
});

export const getFXIntraday = new DynamicStructuredTool({
  name: 'get_fx_intraday',
  description: `Retrieves intraday forex (FX) time series data for a currency pair at specified intervals (1min to 60min). Returns OHLC prices for real-time forex trading analysis.`,
  schema: FXIntradayInputSchema,
  func: async (input) => {
    const params = {
      from_symbol: input.fromSymbol,
      to_symbol: input.toSymbol,
      interval: input.interval,
      outputsize: input.outputsize,
    };
    const { data, url } = await callApi('FX_INTRADAY', params);
    const timeSeriesKey = `Time Series FX (Intraday)`;
    // Alpha Vantage uses different key format for intraday
    const timeSeries = data[timeSeriesKey] || data[`Time Series FX (${input.interval})`];
    if (!timeSeries) {
      return formatToolResult([], [url]);
    }
    return formatToolResult(
      Object.entries(timeSeries as Record<string, Record<string, string>>).map(
        ([timestamp, values]) => ({
          timestamp,
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
        })
      ),
      [url]
    );
  },
});
