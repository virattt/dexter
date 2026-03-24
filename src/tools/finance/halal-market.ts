/**
 * Market data tools powered by the Halal Terminal API.
 * https://api.halalterminal.com
 *
 * Provides real-time and historical stock quotes, OHLC price data,
 * batch quotes, trending stocks, and market news.
 *
 * Auth: X-API-Key header (set HALAL_TERMINAL_API_KEY in .env).
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.halalterminal.com';

// ---------------------------------------------------------------------------
// Shared HTTP helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  return process.env.HALAL_TERMINAL_API_KEY || '';
}

async function halalGet(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<{ data: unknown; url: string }> {
  const apiKey = getApiKey();
  if (!apiKey) logger.warn('[Halal Terminal] call without API key');

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), { headers: { 'X-API-Key': apiKey } });
  } catch (err) {
    throw new Error(`[Halal Terminal] network error: ${err instanceof Error ? err.message : err}`);
  }

  if (!response.ok) {
    throw new Error(`[Halal Terminal] ${response.status} ${response.statusText} — ${path}`);
  }
  return { data: await response.json(), url: url.toString() };
}

async function halalPost(
  path: string,
  body: Record<string, unknown>,
): Promise<{ data: unknown; url: string }> {
  const apiKey = getApiKey();
  if (!apiKey) logger.warn('[Halal Terminal] call without API key');

  const url = new URL(`${BASE_URL}${path}`);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`[Halal Terminal] network error: ${err instanceof Error ? err.message : err}`);
  }

  if (!response.ok) {
    throw new Error(`[Halal Terminal] ${response.status} ${response.statusText} — ${path}`);
  }
  return { data: await response.json(), url: url.toString() };
}

// ---------------------------------------------------------------------------
// Tool: get_stock_quote
// GET /api/quote/{symbol}
// Real-time stock price snapshot: price, change, volume, market cap, 52w range
// ---------------------------------------------------------------------------

export const getStockQuote = new DynamicStructuredTool({
  name: 'get_stock_quote',
  description:
    "Get a real-time stock price snapshot for a single ticker. Returns current price, day change and change_percent, volume, market cap, 52-week high/low, and bid/ask. Use for 'what is the current price of X?' or 'latest quote for AAPL'.",
  schema: z.object({
    symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL', 'MSFT', 'TSLA')"),
  }),
  func: async (input) => {
    const symbol = input.symbol.trim().toUpperCase();
    try {
      const { data, url } = await halalGet(`/api/quote/${symbol}`);
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: get_stock_ohlc
// GET /api/ohlc/{symbol}?period=&interval=
// Historical OHLC (open, high, low, close, volume) candlestick data
// ---------------------------------------------------------------------------

export const getStockOhlc = new DynamicStructuredTool({
  name: 'get_stock_ohlc',
  description:
    "Get historical OHLC (open, high, low, close, volume) price data for a stock. Use for price trends, chart data, or historical analysis. Period examples: '1d','5d','1mo','3mo','6mo','1y','2y','5y','ytd','max'. Interval examples: '1d','1wk','1mo'.",
  schema: z.object({
    symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL', 'MSFT', 'TSLA')"),
    period: z
      .string()
      .optional()
      .default('3mo')
      .describe(
        "Time period to retrieve: '1d','5d','1mo','3mo','6mo','1y','2y','5y','ytd','max'. Default '3mo'.",
      ),
    interval: z
      .string()
      .optional()
      .default('1d')
      .describe(
        "Data interval: '1m','5m','15m','30m','1h','1d','1wk','1mo'. Default '1d'.",
      ),
  }),
  func: async (input) => {
    const symbol = input.symbol.trim().toUpperCase();
    try {
      const { data, url } = await halalGet(`/api/ohlc/${symbol}`, {
        period: input.period ?? '3mo',
        interval: input.interval ?? '1d',
      });
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: get_stock_quotes_batch
// POST /api/quotes/batch
// Real-time quotes for multiple tickers in one request
// ---------------------------------------------------------------------------

export const getStockQuotesBatch = new DynamicStructuredTool({
  name: 'get_stock_quotes_batch',
  description:
    'Get real-time price quotes for multiple stocks in a single request. Returns current price, change, volume, and market cap for each symbol. Use when comparing prices of 2+ stocks simultaneously.',
  schema: z.object({
    symbols: z
      .array(z.string())
      .min(2)
      .describe("List of stock ticker symbols (e.g. ['AAPL', 'MSFT', 'GOOGL'])"),
  }),
  func: async (input) => {
    try {
      const { data, url } = await halalPost('/api/quotes/batch', {
        symbols: input.symbols.map((s) => s.trim().toUpperCase()),
      });
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: get_trending_stocks
// GET /api/trending
// Top trending stocks by volume, momentum, or sector
// ---------------------------------------------------------------------------

export const getTrendingStocks = new DynamicStructuredTool({
  name: 'get_trending_stocks',
  description:
    "Get the current list of trending or most-active stocks. Returns top movers by volume or momentum. Use for 'what stocks are trending today?' or 'top movers right now'.",
  schema: z.object({
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(20)
      .describe('Number of trending stocks to return (default 20)'),
  }),
  func: async (input) => {
    try {
      const { data, url } = await halalGet('/api/trending', {
        limit: input.limit ?? 20,
      });
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: get_market_news
// GET /api/news or GET /api/news/{symbol}
// Market and company news with sentiment scores
// ---------------------------------------------------------------------------

export const getMarketNews = new DynamicStructuredTool({
  name: 'get_market_news',
  description:
    "Fetch news articles for a specific stock or the overall market. Returns headlines, summaries, and sentiment scores. Use for 'latest news on AAPL', 'why did Tesla drop today', or 'recent market headlines'.",
  schema: z.object({
    symbol: z
      .string()
      .optional()
      .describe("Stock ticker for company-specific news (e.g. 'AAPL'). Omit for market-wide news."),
    q: z
      .string()
      .optional()
      .describe("Keyword search query (e.g. 'earnings', 'acquisition', 'FDA approval')"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(10)
      .describe('Number of articles to return (default 10)'),
  }),
  func: async (input) => {
    try {
      if (input.symbol) {
        const symbol = input.symbol.trim().toUpperCase();
        const { data, url } = await halalGet(`/api/news/${symbol}`, {
          limit: Math.min(input.limit ?? 10, 50),
        });
        return formatToolResult(data, [url]);
      } else {
        const params: Record<string, string | number | boolean | undefined> = {
          page_size: Math.min(input.limit ?? 10, 100),
          page: 1,
        };
        if (input.q) params.q = input.q;
        const { data, url } = await halalGet('/api/news', params);
        return formatToolResult(data, [url]);
      }
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});
