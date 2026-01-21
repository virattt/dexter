import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

/**
 * Transform Alpha Vantage crypto exchange rate response
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
    timeZone: rate['7. Time Zone'],
    bidPrice: parseFloat(rate['8. Bid Price']),
    askPrice: parseFloat(rate['9. Ask Price']),
  };
}

/**
 * Transform Alpha Vantage crypto time series response
 */
function transformCryptoTimeSeries(
  data: Record<string, unknown>,
  timeSeriesKey: string,
  market: string
): Record<string, unknown>[] {
  const timeSeries = data[timeSeriesKey] as Record<string, Record<string, string>> | undefined;
  if (!timeSeries) {
    return [];
  }

  return Object.entries(timeSeries).map(([date, values]) => ({
    date,
    open: parseFloat(values[`1a. open (${market})`] || values['1. open']),
    high: parseFloat(values[`2a. high (${market})`] || values['2. high']),
    low: parseFloat(values[`3a. low (${market})`] || values['3. low']),
    close: parseFloat(values[`4a. close (${market})`] || values['4. close']),
    volume: parseFloat(values['5. volume'] || '0'),
    marketCap: parseFloat(values['6. market cap (USD)'] || '0'),
  }));
}

const CryptoPriceSnapshotInputSchema = z.object({
  symbol: z
    .string()
    .describe(
      "The cryptocurrency symbol. For example, 'BTC' for Bitcoin, 'ETH' for Ethereum."
    ),
  market: z
    .string()
    .default('USD')
    .describe(
      "The market/currency to get the price in. For example, 'USD', 'EUR', 'JPY'. Defaults to 'USD'."
    ),
});

export const getCryptoPriceSnapshot = new DynamicStructuredTool({
  name: 'get_crypto_price_snapshot',
  description: `Fetches the current exchange rate for a cryptocurrency against a specified market currency. Returns real-time price, bid/ask prices, and currency information.`,
  schema: CryptoPriceSnapshotInputSchema,
  func: async (input) => {
    const params = {
      from_currency: input.symbol,
      to_currency: input.market,
    };
    const { data, url } = await callApi('CURRENCY_EXCHANGE_RATE', params);
    return formatToolResult(transformExchangeRate(data), [url]);
  },
});

const CryptoPricesInputSchema = z.object({
  symbol: z
    .string()
    .describe(
      "The cryptocurrency symbol. For example, 'BTC' for Bitcoin, 'ETH' for Ethereum."
    ),
  market: z
    .string()
    .default('USD')
    .describe(
      "The market/currency to get prices in. For example, 'USD', 'EUR'. Defaults to 'USD'."
    ),
  interval: z
    .enum(['daily', 'weekly', 'monthly'])
    .default('daily')
    .describe(
      "The time interval for price data. 'daily', 'weekly', or 'monthly'. Defaults to 'daily'."
    ),
});

export const getCryptoPrices = new DynamicStructuredTool({
  name: 'get_crypto_prices',
  description: `Retrieves historical price data for a cryptocurrency, including open, high, low, close prices, volume, and market cap. Provides full historical data for the specified interval.`,
  schema: CryptoPricesInputSchema,
  func: async (input) => {
    let functionName: string;
    let timeSeriesKey: string;

    switch (input.interval) {
      case 'weekly':
        functionName = 'DIGITAL_CURRENCY_WEEKLY';
        timeSeriesKey = 'Time Series (Digital Currency Weekly)';
        break;
      case 'monthly':
        functionName = 'DIGITAL_CURRENCY_MONTHLY';
        timeSeriesKey = 'Time Series (Digital Currency Monthly)';
        break;
      default:
        functionName = 'DIGITAL_CURRENCY_DAILY';
        timeSeriesKey = 'Time Series (Digital Currency Daily)';
    }

    const params = {
      symbol: input.symbol,
      market: input.market,
    };
    const { data, url } = await callApi(functionName, params);
    return formatToolResult(transformCryptoTimeSeries(data, timeSeriesKey, input.market), [url]);
  },
});
