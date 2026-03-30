import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

export const ECONOMIC_CALENDAR_DESCRIPTION = `
Fetches upcoming and recent economic events that impact FX, indices, and commodity markets. Essential for Fintokei trading to avoid unexpected volatility.

## When to Use

- Checking for upcoming high-impact news events before placing trades
- Finding economic releases that could affect specific currency pairs
- Identifying NFP, CPI, rate decisions, and other market-moving events
- Planning trade timing around economic releases
- Understanding why a pair moved significantly (check recent events)

## When NOT to Use

- Technical indicator calculations (use technical_analysis)
- Current price data (use get_market_data)
- Fintokei challenge rules (use fintokei_rules)

## Usage Notes

- Events are fetched from the Twelve Data economic calendar
- Impact levels: low, medium, high — focus on HIGH impact for Fintokei risk management
- Includes actual, forecast, and previous values when available
- Filter by country to focus on relevant currencies (e.g., US for USD pairs, JP for JPY pairs)
- Always check calendar before entering trades on news-sensitive pairs
`.trim();

const EconomicCalendarInputSchema = z.object({
  start_date: z
    .string()
    .optional()
    .describe('Start date in YYYY-MM-DD format (defaults to today)'),
  end_date: z
    .string()
    .optional()
    .describe('End date in YYYY-MM-DD format (defaults to 7 days from start)'),
  country: z
    .string()
    .optional()
    .describe('Country code filter (e.g., "US", "JP", "GB", "EU", "AU", "CA", "CH", "NZ"). Comma-separated for multiple.'),
  importance: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .describe('Minimum importance level filter. "high" for major events only.'),
});

function getApiKey(): string {
  return process.env.TWELVE_DATA_API_KEY || '';
}

export const getEconomicCalendar = new DynamicStructuredTool({
  name: 'get_economic_calendar',
  description:
    'Fetches economic calendar events. Returns upcoming releases with impact level, forecast, actual, and previous values. Essential for avoiding news-driven volatility in Fintokei trading.',
  schema: EconomicCalendarInputSchema,
  func: async (input) => {
    const today = new Date().toISOString().split('T')[0];
    const startDate = input.start_date || today;

    // Default end date: 7 days from start
    const endDate = input.end_date || (() => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    })();

    const url = new URL('https://api.twelvedata.com/economic_calendar');
    const apiKey = getApiKey();
    if (apiKey) {
      url.searchParams.append('apikey', apiKey);
    }
    url.searchParams.append('start_date', startDate);
    url.searchParams.append('end_date', endDate);
    if (input.country) {
      url.searchParams.append('country', input.country);
    }

    let data: Record<string, unknown>;
    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      data = await response.json() as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Economic Calendar] fetch error: ${message}`);
      return formatToolResult({
        error: 'Failed to fetch economic calendar',
        details: message,
      }, []);
    }

    let events = Array.isArray(data.events) ? data.events as Record<string, unknown>[] : [];

    // Filter by importance if specified
    if (input.importance) {
      const importanceOrder = { low: 1, medium: 2, high: 3 };
      const minImportance = importanceOrder[input.importance];
      events = events.filter(e => {
        const eventImportance = importanceOrder[(e.importance as string)?.toLowerCase() as keyof typeof importanceOrder] || 0;
        return eventImportance >= minImportance;
      });
    }

    // Map currency impact for Fintokei relevance
    const currencyImpactMap: Record<string, string[]> = {
      US: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'USD/CAD', 'AUD/USD', 'NZD/USD', 'XAUUSD', 'US30', 'US500', 'NAS100'],
      JP: ['USD/JPY', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY', 'CAD/JPY', 'CHF/JPY', 'JP225'],
      GB: ['GBP/USD', 'EUR/GBP', 'GBP/JPY', 'GBP/AUD', 'GBP/CAD', 'GBP/CHF', 'UK100'],
      EU: ['EUR/USD', 'EUR/GBP', 'EUR/JPY', 'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'GER40', 'FRA40'],
      AU: ['AUD/USD', 'AUD/JPY', 'EUR/AUD', 'GBP/AUD', 'AUD/CAD', 'AUD/CHF', 'AUD/NZD', 'AUS200'],
      CA: ['USD/CAD', 'EUR/CAD', 'GBP/CAD', 'AUD/CAD', 'NZD/CAD', 'CAD/JPY', 'CAD/CHF'],
      CH: ['USD/CHF', 'EUR/CHF', 'GBP/CHF', 'AUD/CHF', 'NZD/CHF', 'CAD/CHF', 'CHF/JPY'],
      NZ: ['NZD/USD', 'NZD/JPY', 'AUD/NZD', 'NZD/CAD', 'NZD/CHF'],
      CN: ['AUD/USD', 'NZD/USD', 'HK50'],
    };

    const enrichedEvents = events.map(e => {
      const country = (e.country as string)?.toUpperCase() || '';
      return {
        ...e,
        affectedInstruments: currencyImpactMap[country] || [],
      };
    });

    // Strip API key from URL
    const cleanUrl = new URL(url.toString());
    cleanUrl.searchParams.delete('apikey');

    return formatToolResult({
      period: { start: startDate, end: endDate },
      totalEvents: enrichedEvents.length,
      events: enrichedEvents,
    }, [cleanUrl.toString()]);
  },
});
