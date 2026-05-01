/**
 * Yahoo Finance LangChain tools — real-time quotes and historical prices.
 * No API key required.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { yahooQuote as yahooQuoteApi, yahooHistorical as yahooHistoricalApi } from './yahoo-api.js';

export const YAHOO_QUOTE_DESCRIPTION = `
Fetches real-time stock/ETF quote data from Yahoo Finance. Returns current price, market cap, P/E ratio, EPS, 52-week range, volume, dividend yield, company name, sector, and industry. No API key required.
`.trim();

const yahooQuoteSchema = z.object({
  ticker: z.string().describe('Stock ticker symbol (e.g., AAPL, TSLA, MSFT).'),
});

export const yahooQuoteTool = new DynamicStructuredTool({
  name: 'yahoo_quote',
  description: 'Fetches real-time stock quote data including price, fundamentals, and company info from Yahoo Finance.',
  schema: yahooQuoteSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    try {
      const result = await yahooQuoteApi(ticker);
      return formatToolResult(result);
    } catch (error) {
      return formatToolResult({
        error: `Yahoo Finance lookup failed for ${ticker}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  },
});

export const YAHOO_HISTORICAL_DESCRIPTION = `
Fetches historical OHLCV (Open/High/Low/Close/Volume) price data from Yahoo Finance for a ticker over a time period. No API key required.
`.trim();

const yahooHistoricalSchema = z.object({
  ticker: z.string().describe('Stock ticker symbol (e.g., AAPL, TSLA, MSFT).'),
  period: z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', 'ytd']).default('1mo')
    .describe('Time period for historical data. 1d: last day (5min intervals), 5d: 5 days, 1mo: 1 month, 3mo: 3 months, 6mo: 6 months, 1y: 1 year.'),
  start_date: z.string().optional().describe('Optional start date in YYYY-MM-DD format. Overrides period if provided.'),
  end_date: z.string().optional().describe('Optional end date in YYYY-MM-DD format. Must be used with start_date.'),
});

export const yahooHistoricalTool = new DynamicStructuredTool({
  name: 'yahoo_historical',
  description: 'Fetches historical OHLCV price data from Yahoo Finance for a ticker over a time period.',
  schema: yahooHistoricalSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    try {
      const result = await yahooHistoricalApi(ticker, input.period, input.start_date, input.end_date);
      return formatToolResult({
        ticker: result.ticker,
        period: result.period,
        count: result.prices.length,
        prices: result.prices,
      });
    } catch (error) {
      return formatToolResult({
        error: `Yahoo Finance historical data failed for ${ticker}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  },
});
