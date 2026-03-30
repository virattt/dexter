import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api, resolveSymbol, FINTOKEI_INSTRUMENTS } from './api.js';
import { formatToolResult } from '../types.js';

export const GET_MARKET_DATA_DESCRIPTION = `
Fetches real-time and historical price data for FX pairs, stock indices, gold, and other CFD instruments available on Fintokei.

## When to Use

- Current price quotes for any Fintokei instrument (FX pairs, indices, gold, silver, oil)
- Historical OHLCV price data with configurable timeframes (1min to 1month)
- Price snapshots for multiple instruments
- Checking current market prices before trade analysis

## When NOT to Use

- Technical indicator calculations (use technical_analysis)
- Economic calendar events (use economic_calendar)
- Trade journaling or performance tracking (use trade_journal)
- Fintokei account/challenge rules (use fintokei_rules)
- General web searches (use web_search)

## Supported Instruments

**FX Majors:** EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD
**FX Minors:** EUR/GBP, EUR/JPY, GBP/JPY, EUR/AUD, AUD/JPY, and more
**Indices:** JP225, US30, US500, NAS100, GER40, UK100, FRA40, AUS200, HK50
**Commodities:** XAUUSD (Gold), XAGUSD (Silver), USOIL (WTI), UKOIL (Brent)

## Usage Notes

- Accepts common aliases: "gold" → XAUUSD, "DOW" → US30, "NIKKEI" → JP225
- For FX pairs, accepts both EURUSD and EUR/USD format
- Historical data intervals: 1min, 5min, 15min, 30min, 1h, 4h, 1day, 1week, 1month
`.trim();

const GetPriceInputSchema = z.object({
  symbol: z
    .string()
    .describe('Instrument symbol (e.g., EUR/USD, XAUUSD, US30, gold, NIKKEI)'),
});

export const getPrice = new DynamicStructuredTool({
  name: 'get_price',
  description:
    'Fetches the current real-time price quote for a Fintokei instrument. Returns bid, ask, open, high, low, close, and volume.',
  schema: GetPriceInputSchema,
  func: async (input) => {
    const resolved = resolveSymbol(input.symbol);
    if (!resolved) {
      return formatToolResult({
        error: `Unknown instrument: ${input.symbol}`,
        hint: 'Supported instruments: ' + Object.keys(FINTOKEI_INSTRUMENTS).join(', '),
      }, []);
    }

    const { data, url } = await api.get('/quote', {
      symbol: resolved.apiSymbol,
    });

    return formatToolResult({
      instrument: input.symbol.toUpperCase(),
      category: resolved.instrument.category,
      pipSize: resolved.instrument.pipSize,
      quote: data,
    }, [url]);
  },
});

const GetPriceHistoryInputSchema = z.object({
  symbol: z
    .string()
    .describe('Instrument symbol (e.g., EUR/USD, XAUUSD, US30)'),
  interval: z
    .enum(['1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week', '1month'])
    .describe('Candle timeframe interval'),
  outputsize: z
    .number()
    .default(30)
    .describe('Number of candles to return (default 30, max 5000)'),
  start_date: z
    .string()
    .optional()
    .describe('Start date in YYYY-MM-DD format (optional)'),
  end_date: z
    .string()
    .optional()
    .describe('End date in YYYY-MM-DD format (optional)'),
});

export const getPriceHistory = new DynamicStructuredTool({
  name: 'get_price_history',
  description:
    'Retrieves historical OHLCV candle data for a Fintokei instrument over a specified timeframe. Use for chart analysis and pattern recognition.',
  schema: GetPriceHistoryInputSchema,
  func: async (input) => {
    const resolved = resolveSymbol(input.symbol);
    if (!resolved) {
      return formatToolResult({
        error: `Unknown instrument: ${input.symbol}`,
        hint: 'Supported instruments: ' + Object.keys(FINTOKEI_INSTRUMENTS).join(', '),
      }, []);
    }

    const params: Record<string, string | number | undefined> = {
      symbol: resolved.apiSymbol,
      interval: input.interval,
      outputsize: input.outputsize,
      start_date: input.start_date,
      end_date: input.end_date,
    };

    // Cache closed date ranges
    const cacheable = Boolean(input.end_date && new Date(input.end_date) < new Date());
    const { data, url } = await api.get('/time_series', params, { cacheable });

    return formatToolResult({
      instrument: input.symbol.toUpperCase(),
      category: resolved.instrument.category,
      pipSize: resolved.instrument.pipSize,
      interval: input.interval,
      candles: data.values || [],
      meta: data.meta || {},
    }, [url]);
  },
});

const ListInstrumentsInputSchema = z.object({
  category: z
    .enum(['all', 'fx_major', 'fx_minor', 'index', 'commodity'])
    .default('all')
    .describe('Filter by instrument category'),
});

export const listInstruments = new DynamicStructuredTool({
  name: 'list_instruments',
  description:
    'Lists all available Fintokei instruments with their categories and pip sizes. Use to look up available symbols.',
  schema: ListInstrumentsInputSchema,
  func: async (input) => {
    const categoryMap: Record<string, string[]> = {
      fx_major: ['FX Major'],
      fx_minor: ['FX Minor'],
      index: ['Index'],
      commodity: ['Commodity'],
      all: ['FX Major', 'FX Minor', 'Index', 'Commodity'],
    };
    const categories = categoryMap[input.category] || categoryMap.all;

    const instruments = Object.entries(FINTOKEI_INSTRUMENTS)
      .filter(([, info]) => categories.includes(info.category))
      .map(([name, info]) => ({
        symbol: name,
        apiSymbol: info.symbol,
        type: info.type,
        category: info.category,
        pipSize: info.pipSize,
      }));

    return formatToolResult({ instruments, count: instruments.length }, []);
  },
});
