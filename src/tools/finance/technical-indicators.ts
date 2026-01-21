import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

/**
 * Common schema for technical indicator time period parameters
 */
const BaseIndicatorInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  interval: z
    .enum(['1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly'])
    .default('daily')
    .describe("Time interval between data points. Defaults to 'daily'."),
  timePeriod: z
    .number()
    .int()
    .positive()
    .default(20)
    .describe('Number of data points used to calculate each indicator value. Defaults to 20.'),
  seriesType: z
    .enum(['close', 'open', 'high', 'low'])
    .default('close')
    .describe("Price type to use for calculation. Defaults to 'close'."),
});

/**
 * Transform time series technical indicator response
 */
function transformIndicatorData(
  data: Record<string, unknown>,
  indicatorKey: string
): Record<string, unknown>[] {
  const analysis = data[indicatorKey] as Record<string, Record<string, string>> | undefined;
  if (!analysis) return [];

  return Object.entries(analysis).map(([date, values]) => ({
    date,
    ...Object.fromEntries(
      Object.entries(values).map(([key, val]) => [key, parseFloat(val)])
    ),
  }));
}

export const getSMA = new DynamicStructuredTool({
  name: 'get_sma',
  description: `Calculates Simple Moving Average (SMA) for a stock. SMA smooths price data by averaging over a specified period. Useful for identifying trends and support/resistance levels.`,
  schema: BaseIndicatorInputSchema,
  func: async (input) => {
    const params = {
      symbol: input.ticker,
      interval: input.interval,
      time_period: String(input.timePeriod),
      series_type: input.seriesType,
    };
    const { data, url } = await callApi('SMA', params);
    return formatToolResult(transformIndicatorData(data, 'Technical Analysis: SMA'), [url]);
  },
});

export const getEMA = new DynamicStructuredTool({
  name: 'get_ema',
  description: `Calculates Exponential Moving Average (EMA) for a stock. EMA gives more weight to recent prices, making it more responsive to new information than SMA. Commonly used for trend identification and crossover strategies.`,
  schema: BaseIndicatorInputSchema,
  func: async (input) => {
    const params = {
      symbol: input.ticker,
      interval: input.interval,
      time_period: String(input.timePeriod),
      series_type: input.seriesType,
    };
    const { data, url } = await callApi('EMA', params);
    return formatToolResult(transformIndicatorData(data, 'Technical Analysis: EMA'), [url]);
  },
});

const RSIInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  interval: z
    .enum(['1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly'])
    .default('daily')
    .describe("Time interval between data points. Defaults to 'daily'."),
  timePeriod: z
    .number()
    .int()
    .positive()
    .default(14)
    .describe('Number of data points used to calculate RSI. Standard is 14.'),
  seriesType: z
    .enum(['close', 'open', 'high', 'low'])
    .default('close')
    .describe("Price type to use for calculation. Defaults to 'close'."),
});

export const getRSI = new DynamicStructuredTool({
  name: 'get_rsi',
  description: `Calculates Relative Strength Index (RSI) for a stock. RSI measures momentum on a 0-100 scale. Values above 70 suggest overbought conditions, below 30 suggest oversold. Standard period is 14 days.`,
  schema: RSIInputSchema,
  func: async (input) => {
    const params = {
      symbol: input.ticker,
      interval: input.interval,
      time_period: String(input.timePeriod),
      series_type: input.seriesType,
    };
    const { data, url } = await callApi('RSI', params);
    return formatToolResult(transformIndicatorData(data, 'Technical Analysis: RSI'), [url]);
  },
});

const MACDInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  interval: z
    .enum(['1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly'])
    .default('daily')
    .describe("Time interval between data points. Defaults to 'daily'."),
  seriesType: z
    .enum(['close', 'open', 'high', 'low'])
    .default('close')
    .describe("Price type to use for calculation. Defaults to 'close'."),
  fastPeriod: z
    .number()
    .int()
    .positive()
    .default(12)
    .describe('Fast EMA period. Standard is 12.'),
  slowPeriod: z
    .number()
    .int()
    .positive()
    .default(26)
    .describe('Slow EMA period. Standard is 26.'),
  signalPeriod: z
    .number()
    .int()
    .positive()
    .default(9)
    .describe('Signal line EMA period. Standard is 9.'),
});

export const getMACD = new DynamicStructuredTool({
  name: 'get_macd',
  description: `Calculates Moving Average Convergence/Divergence (MACD) for a stock. Returns MACD line, signal line, and histogram. Used for identifying trend changes and momentum. Standard settings are 12/26/9.`,
  schema: MACDInputSchema,
  func: async (input) => {
    const params = {
      symbol: input.ticker,
      interval: input.interval,
      series_type: input.seriesType,
      fastperiod: String(input.fastPeriod),
      slowperiod: String(input.slowPeriod),
      signalperiod: String(input.signalPeriod),
    };
    const { data, url } = await callApi('MACD', params);
    return formatToolResult(transformIndicatorData(data, 'Technical Analysis: MACD'), [url]);
  },
});

const BBANDSInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  interval: z
    .enum(['1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly'])
    .default('daily')
    .describe("Time interval between data points. Defaults to 'daily'."),
  timePeriod: z
    .number()
    .int()
    .positive()
    .default(20)
    .describe('Number of data points for the middle band SMA. Standard is 20.'),
  seriesType: z
    .enum(['close', 'open', 'high', 'low'])
    .default('close')
    .describe("Price type to use for calculation. Defaults to 'close'."),
  nbdevup: z
    .number()
    .default(2)
    .describe('Standard deviations for upper band. Standard is 2.'),
  nbdevdn: z
    .number()
    .default(2)
    .describe('Standard deviations for lower band. Standard is 2.'),
  matype: z
    .number()
    .int()
    .min(0)
    .max(8)
    .default(0)
    .describe('Moving average type. 0=SMA, 1=EMA, 2=WMA, 3=DEMA, 4=TEMA, 5=TRIMA, 6=KAMA, 7=MAMA, 8=T3'),
});

export const getBBANDS = new DynamicStructuredTool({
  name: 'get_bbands',
  description: `Calculates Bollinger Bands for a stock. Returns upper band, middle band (SMA), and lower band. Used to identify volatility and potential price breakouts. Prices near the upper band may be overbought, near lower band may be oversold.`,
  schema: BBANDSInputSchema,
  func: async (input) => {
    const params = {
      symbol: input.ticker,
      interval: input.interval,
      time_period: String(input.timePeriod),
      series_type: input.seriesType,
      nbdevup: String(input.nbdevup),
      nbdevdn: String(input.nbdevdn),
      matype: String(input.matype),
    };
    const { data, url } = await callApi('BBANDS', params);
    return formatToolResult(transformIndicatorData(data, 'Technical Analysis: BBANDS'), [url]);
  },
});

const ADXInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  interval: z
    .enum(['1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly'])
    .default('daily')
    .describe("Time interval between data points. Defaults to 'daily'."),
  timePeriod: z
    .number()
    .int()
    .positive()
    .default(14)
    .describe('Number of data points for ADX calculation. Standard is 14.'),
});

export const getADX = new DynamicStructuredTool({
  name: 'get_adx',
  description: `Calculates Average Directional Index (ADX) for a stock. ADX measures trend strength on a 0-100 scale. Values above 25 indicate a strong trend, below 20 indicate weak or no trend. Does not indicate trend direction.`,
  schema: ADXInputSchema,
  func: async (input) => {
    const params = {
      symbol: input.ticker,
      interval: input.interval,
      time_period: String(input.timePeriod),
    };
    const { data, url } = await callApi('ADX', params);
    return formatToolResult(transformIndicatorData(data, 'Technical Analysis: ADX'), [url]);
  },
});

const STOCHInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  interval: z
    .enum(['1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly'])
    .default('daily')
    .describe("Time interval between data points. Defaults to 'daily'."),
  fastkperiod: z
    .number()
    .int()
    .positive()
    .default(5)
    .describe('Fast %K period. Standard is 5.'),
  slowkperiod: z
    .number()
    .int()
    .positive()
    .default(3)
    .describe('Slow %K period. Standard is 3.'),
  slowdperiod: z
    .number()
    .int()
    .positive()
    .default(3)
    .describe('Slow %D period. Standard is 3.'),
});

export const getSTOCH = new DynamicStructuredTool({
  name: 'get_stoch',
  description: `Calculates Stochastic Oscillator for a stock. Returns SlowK and SlowD values on a 0-100 scale. Values above 80 suggest overbought, below 20 suggest oversold. Useful for identifying momentum reversals.`,
  schema: STOCHInputSchema,
  func: async (input) => {
    const params = {
      symbol: input.ticker,
      interval: input.interval,
      fastkperiod: String(input.fastkperiod),
      slowkperiod: String(input.slowkperiod),
      slowdperiod: String(input.slowdperiod),
    };
    const { data, url } = await callApi('STOCH', params);
    return formatToolResult(transformIndicatorData(data, 'Technical Analysis: STOCH'), [url]);
  },
});
