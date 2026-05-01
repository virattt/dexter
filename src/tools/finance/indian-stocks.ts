import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';
import { yahooQuote, yahooHistorical } from './yahoo-api.js';

export const INDIAN_STOCK_PRICE_DESCRIPTION = `
Fetches current stock price snapshots for Indian equities (NSE/BSE) using Yahoo Finance.

## When to Use

- Getting real-time (slightly delayed) price for Indian stocks
- Checking market cap, P/E, and other basic fundamentals for an Indian stock
- Verifying if an Indian stock is listed on NSE or BSE

## When NOT to Use

- **For Mutual Funds**: Use indian_mutual_fund instead. Screener.in/Yahoo handles funds differently, and Dexter has a specialized tool for Indian MFs.
- For non-Indian stocks.

## Ticker Format

- Use .NS suffix for NSE (e.g., RELIANCE.NS)
- Use .BS suffix for BSE (e.g., RELIANCE.BS)
`.trim();

const IndianStockPriceInputSchema = z.object({
  ticker: z
    .string()
    .describe("The Indian stock ticker symbol to fetch current price for. Use .NS for NSE or .BS for BSE suffix. For example, 'RELIANCE.NS' for Reliance Industries on NSE."),
});

export const getIndianStockPrice = new DynamicStructuredTool({
  name: 'get_indian_stock_price',
  description:
    'Fetches the current stock price snapshot for an Indian equity ticker (NSE/BSE), including open, high, low, close prices, volume, and market cap.',
  schema: IndianStockPriceInputSchema,
  func: async (input) => {
    let ticker = input.ticker.trim().toUpperCase();

    // Ensure it has an Indian suffix if it looks like an Indian ticker but lacks one
    // Yahoo Finance uses .NS for NSE, .BO for BSE (Bombay Stock Exchange)
    if (!ticker.endsWith('.NS') && !ticker.endsWith('.BO') && !ticker.endsWith('.BSE')) {
      ticker = `${ticker}.NS`;
    }

    try {
      const data = await yahooQuote(ticker);
      return formatToolResult(data, [`https://finance.yahoo.com/quote/${ticker}`]);
    } catch (error) {
      logger.error(`[Indian Stock API] Yahoo Finance failed for ${ticker}: ${error.message}`);
      return formatToolResult({ error: `Failed to fetch data for ${ticker}. Ensure it is a valid NSE/BSE ticker.` });
    }
  },
});

const IndianStockPricesInputSchema = z.object({
  ticker: z
    .string()
    .describe("The Indian stock ticker symbol to fetch historical prices for. Use .NS for NSE or .BS for BSE suffix. For example, 'RELIANCE.NS' for Reliance Industries on NSE."),
  period: z
    .enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max'])
    .default('1mo')
    .describe("The time period for historical data. Defaults to '1mo'."),
});

export const getIndianStockPrices = new DynamicStructuredTool({
  name: 'get_indian_stock_prices',
  description:
    'Retrieves historical price data for an Indian stock over a specified period.',
  schema: IndianStockPricesInputSchema,
  func: async (input) => {
    let ticker = input.ticker.trim().toUpperCase();
    // Yahoo Finance uses .NS for NSE, .BO for BSE
    if (!ticker.endsWith('.NS') && !ticker.endsWith('.BO') && !ticker.endsWith('.BSE')) {
      ticker = `${ticker}.NS`;
    }

    try {
      const data = await yahooHistorical(ticker, input.period);
      return formatToolResult(data, [`https://finance.yahoo.com/quote/${ticker}/history`]);
    } catch (error) {
      logger.error(`[Indian Stock API] Yahoo Finance historical failed for ${ticker}: ${error.message}`);
      return formatToolResult({ error: `Failed to fetch historical data for ${ticker}.` });
    }
  },
});

export const getIndianMarketStatus = new DynamicStructuredTool({
  name: 'get_indian_market_status',
  description: 'Get current market status for Indian exchanges (NSE/BSE).',
  schema: z.object({}),
  func: async () => {
    // Current UTC time
    const now = new Date();
    // Indian Standard Time (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    
    const day = istDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const hours = istDate.getUTCHours();
    const minutes = istDate.getUTCMinutes();
    const timeInMinutes = hours * 60 + minutes;

    // Indian market timings: 9:15 AM to 3:30 PM IST (Monday-Friday)
    const marketOpenMinutes = 9 * 60 + 15;
    const marketCloseMinutes = 15 * 60 + 30;
    
    const isWeekday = day >= 1 && day <= 5;
    const isMarketHours = timeInMinutes >= marketOpenMinutes && timeInMinutes <= marketCloseMinutes;
    const isMarketOpen = isWeekday && isMarketHours;

    return formatToolResult({
      timestamp_ist: istDate.toISOString(),
      day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
      is_market_open: isMarketOpen,
      exchange: 'NSE/BSE',
      market_hours_ist: '9:15 AM - 3:30 PM',
      status: isMarketOpen ? 'OPEN' : isWeekday ? (timeInMinutes < marketOpenMinutes ? 'PRE_MARKET' : 'CLOSED') : 'WEEKEND/HOLIDAY',
    }, ['https://www.nseindia.com/']);
  },
});