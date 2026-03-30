import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { api, resolveSymbol, FINTOKEI_INSTRUMENTS } from './api.js';
import { formatToolResult } from '../types.js';

export const TECHNICAL_ANALYSIS_DESCRIPTION = `
Calculates technical indicators for FX pairs, indices, gold, and other Fintokei instruments. Returns indicator values for trade analysis and signal detection.

## When to Use

- Moving averages (SMA, EMA) for trend identification
- RSI for overbought/oversold conditions
- MACD for momentum and trend changes
- Bollinger Bands for volatility analysis
- Stochastic for entry/exit timing
- ATR for volatility-based stop loss sizing
- ADX for trend strength measurement
- Ichimoku Cloud for comprehensive trend analysis
- Pivot Points for support/resistance levels
- Multiple indicators at once for confluence analysis

## When NOT to Use

- Just need current price (use get_market_data)
- Economic event analysis (use economic_calendar)
- Fintokei challenge rules (use fintokei_rules)

## Usage Notes

- All standard timeframes supported: 1min to 1month
- Returns the most recent indicator values by default
- Combine multiple indicators for confluence-based trade decisions
- ATR is particularly useful for Fintokei position sizing (volatility-adjusted stops)
`.trim();

const INDICATORS = [
  'sma', 'ema', 'rsi', 'macd', 'bbands', 'stoch', 'atr', 'adx',
  'ichimoku', 'pivot_points', 'cci', 'willr', 'obv', 'vwap',
] as const;

const TechnicalIndicatorInputSchema = z.object({
  symbol: z.string().describe('Instrument symbol (e.g., EUR/USD, XAUUSD, US30)'),
  indicator: z.enum(INDICATORS).describe('Technical indicator to calculate'),
  interval: z
    .enum(['1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week', '1month'])
    .describe('Candle timeframe interval'),
  time_period: z
    .number()
    .optional()
    .describe('Lookback period for the indicator (e.g., 14 for RSI-14, 20 for SMA-20). Defaults vary by indicator.'),
  outputsize: z
    .number()
    .default(10)
    .describe('Number of data points to return (default 10)'),
});

export const getTechnicalIndicator = new DynamicStructuredTool({
  name: 'get_technical_indicator',
  description:
    'Calculates a single technical indicator for a Fintokei instrument. Returns recent indicator values with timestamps.',
  schema: TechnicalIndicatorInputSchema,
  func: async (input) => {
    const resolved = resolveSymbol(input.symbol);
    if (!resolved) {
      return formatToolResult({
        error: `Unknown instrument: ${input.symbol}`,
        hint: 'Supported: ' + Object.keys(FINTOKEI_INSTRUMENTS).join(', '),
      }, []);
    }

    const params: Record<string, string | number | undefined> = {
      symbol: resolved.apiSymbol,
      interval: input.interval,
      outputsize: input.outputsize,
      time_period: input.time_period,
    };

    const { data, url } = await api.get(`/${input.indicator}`, params);

    return formatToolResult({
      instrument: input.symbol.toUpperCase(),
      indicator: input.indicator.toUpperCase(),
      interval: input.interval,
      timePeriod: input.time_period,
      values: data.values || [],
      meta: data.meta || {},
    }, [url]);
  },
});

const MultiIndicatorInputSchema = z.object({
  symbol: z.string().describe('Instrument symbol (e.g., EUR/USD, XAUUSD, US30)'),
  interval: z
    .enum(['1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week', '1month'])
    .describe('Candle timeframe interval'),
  indicators: z
    .array(z.object({
      name: z.enum(INDICATORS).describe('Indicator name'),
      time_period: z.number().optional().describe('Lookback period'),
    }))
    .min(1)
    .max(8)
    .describe('Array of indicators to calculate (max 8)'),
});

export const getMultiIndicators = new DynamicStructuredTool({
  name: 'get_multi_indicators',
  description:
    'Calculates multiple technical indicators at once for confluence analysis. Returns the latest values for each indicator. Use when analyzing a trade setup that requires multiple confirmations.',
  schema: MultiIndicatorInputSchema,
  func: async (input, _runManager, config?: RunnableConfig) => {
    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

    const resolved = resolveSymbol(input.symbol);
    if (!resolved) {
      return formatToolResult({
        error: `Unknown instrument: ${input.symbol}`,
        hint: 'Supported: ' + Object.keys(FINTOKEI_INSTRUMENTS).join(', '),
      }, []);
    }

    onProgress?.(`Calculating ${input.indicators.length} indicators for ${input.symbol}...`);

    const results = await Promise.all(
      input.indicators.map(async (ind) => {
        try {
          const params: Record<string, string | number | undefined> = {
            symbol: resolved.apiSymbol,
            interval: input.interval,
            outputsize: 5,
            time_period: ind.time_period,
          };
          const { data, url } = await api.get(`/${ind.name}`, params);
          return {
            indicator: ind.name.toUpperCase(),
            timePeriod: ind.time_period,
            values: data.values || [],
            url,
            error: null,
          };
        } catch (error) {
          return {
            indicator: ind.name.toUpperCase(),
            timePeriod: ind.time_period,
            values: [],
            url: '',
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    const urls = results.filter(r => r.url).map(r => r.url);

    return formatToolResult({
      instrument: input.symbol.toUpperCase(),
      interval: input.interval,
      indicators: results,
    }, urls);
  },
});
