/**
 * Shariah finance tools powered by the Halal Terminal API.
 * https://api.halalterminal.com
 *
 * Provides Shariah compliance screening, zakat calculation,
 * dividend purification, ETF analysis, Islamic finance news,
 * and halal stock database search.
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
  queryParams: Record<string, string | number | boolean | undefined> = {},
): Promise<{ data: unknown; url: string }> {
  const apiKey = getApiKey();
  if (!apiKey) logger.warn('[Halal Terminal] call without API key');

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

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
// Tool: screen_stock_shariah
// POST /api/screen/{symbol}
// Full Shariah compliance analysis across AAOIFI, DJIM, FTSE, MSCI, S&P
// ---------------------------------------------------------------------------

export const screenStockShariah = new DynamicStructuredTool({
  name: 'screen_stock_shariah',
  description:
    'Screen a stock for Shariah compliance using the Halal Terminal API. Returns is_compliant, compliance verdicts for each methodology (AAOIFI, DJIM, FTSE, MSCI, S&P), financial ratios (debt/assets, interest income/revenue), business activity screen result, and purification_rate.',
  schema: z.object({
    symbol: z.string().describe("Stock ticker symbol to screen (e.g. 'AAPL', 'MSFT', 'TSLA')"),
  }),
  func: async (input) => {
    const symbol = input.symbol.trim().toUpperCase();
    try {
      const { data, url } = await halalPost(`/api/screen/${symbol}`, {});
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: scan_portfolio_shariah
// POST /api/portfolio/scan
// Screen a list of tickers and get aggregate compliance summary
// ---------------------------------------------------------------------------

export const scanPortfolioShariah = new DynamicStructuredTool({
  name: 'scan_portfolio_shariah',
  description:
    'Screen a portfolio of stocks for Shariah compliance. Accepts a list of tickers and returns per-symbol compliance verdicts plus an aggregate summary (compliant count, average purification rate). Ideal for checking a whole portfolio at once.',
  schema: z.object({
    symbols: z
      .array(z.string())
      .min(1)
      .describe("List of stock ticker symbols to screen (e.g. ['AAPL', 'MSFT', 'GOOGL'])"),
    force_refresh: z
      .boolean()
      .optional()
      .default(false)
      .describe('Re-screen from scratch, bypassing cached results. Default false.'),
  }),
  func: async (input) => {
    try {
      const { data, url } = await halalPost('/api/portfolio/scan', {
        symbols: input.symbols.map((s) => s.trim().toUpperCase()),
        force_refresh: input.force_refresh ?? false,
      });
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: compare_shariah
// POST /api/compare
// Side-by-side compliance + quote + database info for 2-5 stocks
// ---------------------------------------------------------------------------

export const compareShariah = new DynamicStructuredTool({
  name: 'compare_shariah',
  description:
    'Compare 2-5 stocks side-by-side for Shariah compliance. Returns screening result, live quote, and database record for each symbol. Use to compare halal alternatives or evaluate multiple holdings.',
  schema: z.object({
    symbols: z
      .array(z.string())
      .min(2)
      .max(5)
      .describe(
        "List of 2-5 stock ticker symbols to compare (e.g. ['AAPL', 'MSFT', 'GOOGL'])",
      ),
  }),
  func: async (input) => {
    try {
      const { data, url } = await halalPost('/api/compare', {
        symbols: input.symbols.map((s) => s.trim().toUpperCase()),
      });
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: screen_etf_shariah
// POST /api/etf/{symbol}/screen
// Per-holding compliance breakdown for an ETF
// ---------------------------------------------------------------------------

export const screenEtfShariah = new DynamicStructuredTool({
  name: 'screen_etf_shariah',
  description:
    'Screen an ETF for Shariah compliance by analysing each of its holdings. Returns compliance_status, compliant/non-compliant weight percentages, weighted-average purification_rate, and a per-holding breakdown.',
  schema: z.object({
    symbol: z.string().describe("ETF ticker symbol (e.g. 'QQQ', 'SPY', 'VTI', 'HLAL', 'SPUS')"),
    force_refresh: z
      .boolean()
      .optional()
      .default(false)
      .describe('Re-screen bypassing cache. Default false.'),
  }),
  func: async (input) => {
    const symbol = input.symbol.trim().toUpperCase();
    try {
      const { data, url } = await halalPost(
        `/api/etf/${symbol}/screen`,
        {},
        { force_refresh: input.force_refresh ?? false },
      );
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: compare_etf_shariah
// POST /api/etf/compare
// Side-by-side ETF comparison with overlap analysis
// ---------------------------------------------------------------------------

export const compareEtfShariah = new DynamicStructuredTool({
  name: 'compare_etf_shariah',
  description:
    'Compare 2-5 ETFs side-by-side for Shariah compliance. Returns per-ETF compliance status, compliant/non-compliant weight, expense ratio, and overlap holdings that appear in multiple ETFs.',
  schema: z.object({
    symbols: z
      .array(z.string())
      .min(2)
      .max(5)
      .describe("List of 2-5 ETF ticker symbols (e.g. ['QQQ', 'HLAL', 'SPUS', 'VTI'])"),
  }),
  func: async (input) => {
    try {
      const { data, url } = await halalPost('/api/etf/compare', {
        symbols: input.symbols.map((s) => s.trim().toUpperCase()),
      });
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: calculate_zakat
// POST /api/zakat/calculate
// Zakat obligation on portfolio (2.5% of market value above nisab)
// ---------------------------------------------------------------------------

export const calculateZakat = new DynamicStructuredTool({
  name: 'calculate_zakat',
  description:
    "Calculate zakat owed on a stock portfolio. Provide each holding's symbol and current market value in USD. The API checks whether total holdings exceed the nisab threshold (85g gold) and returns 2.5% zakat per holding and total. Also returns nisab_threshold and is_above_nisab.",
  schema: z.object({
    holdings: z
      .array(
        z.object({
          symbol: z.string().describe('Stock ticker symbol'),
          market_value: z.number().positive().describe('Current market value of the holding in USD'),
        }),
      )
      .min(1)
      .describe("Portfolio holdings with market values (e.g. [{symbol:'AAPL', market_value:25000}])"),
    gold_price_per_gram: z
      .number()
      .positive()
      .optional()
      .describe('Gold price per gram in USD for nisab calculation. Defaults to ~65 USD.'),
  }),
  func: async (input) => {
    const body: Record<string, unknown> = {
      holdings: input.holdings.map((h) => ({
        symbol: h.symbol.trim().toUpperCase(),
        market_value: h.market_value,
      })),
    };
    if (input.gold_price_per_gram !== undefined) {
      body.gold_price_per_gram = input.gold_price_per_gram;
    }
    try {
      const { data, url } = await halalPost('/api/zakat/calculate', body);
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: calculate_purification
// POST /api/purification/calculate
// Dividend purification (cleansing) amounts for multiple holdings
// ---------------------------------------------------------------------------

export const calculatePurification = new DynamicStructuredTool({
  name: 'calculate_purification',
  description:
    "Calculate dividend purification (cleansing) amounts for stock holdings. For each holding, provide the symbol and the dividend_income received in USD. Returns per-holding purification_amount (to donate), halal_amount (to keep), and purification_rate. Also returns total_purification and total_halal.",
  schema: z.object({
    holdings: z
      .array(
        z.object({
          symbol: z.string().describe('Stock ticker symbol'),
          dividend_income: z
            .number()
            .nonnegative()
            .describe('Dividend income received from this holding in USD'),
        }),
      )
      .min(1)
      .describe("Holdings with dividend income (e.g. [{symbol:'MSFT', dividend_income:320}])"),
  }),
  func: async (input) => {
    try {
      const { data, url } = await halalPost('/api/purification/calculate', {
        holdings: input.holdings.map((h) => ({
          symbol: h.symbol.trim().toUpperCase(),
          dividend_income: h.dividend_income,
        })),
      });
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: get_dividend_purification
// GET /api/dividends/{symbol}/purification
// Historical dividend payments with per-dividend purification amounts
// ---------------------------------------------------------------------------

export const getDividendPurification = new DynamicStructuredTool({
  name: 'get_dividend_purification',
  description:
    'Retrieve the full dividend history for a stock with per-dividend purification amounts. Shows purification_rate, per-dividend purification_amount and halal_amount, and aggregate totals (total_dividends, total_purification, total_halal). Use for halal investors who receive dividends from partially-compliant companies.',
  schema: z.object({
    symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL', 'MSFT')"),
  }),
  func: async (input) => {
    const symbol = input.symbol.trim().toUpperCase();
    try {
      const { data, url } = await halalGet(`/api/dividends/${symbol}/purification`);
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: get_islamic_news
// GET /api/news (market-wide) or GET /api/news/{symbol} (company-specific)
// Islamic finance and halal investing news with sentiment scores
// ---------------------------------------------------------------------------

export const getIslamicNews = new DynamicStructuredTool({
  name: 'get_islamic_news',
  description:
    "Fetch Islamic finance and halal investing news. Provide a stock symbol for company-specific news, or omit for market-wide Islamic finance news. Supports filtering by category (e.g. 'islamic_finance', 'market') and keyword search. Returns articles with sentiment scores.",
  schema: z.object({
    symbol: z
      .string()
      .optional()
      .describe("Stock ticker symbol for company-specific news (e.g. 'AAPL'). Omit for market news."),
    category: z
      .string()
      .optional()
      .describe("Filter by category: 'islamic_finance', 'market', 'regulation', etc."),
    q: z
      .string()
      .optional()
      .describe('Keyword search query (e.g. "sukuk", "halal ETF", "AAOIFI")'),
    page_size: z
      .number()
      .int()
      .positive()
      .optional()
      .default(10)
      .describe('Number of articles to return (default 10, max 100)'),
  }),
  func: async (input) => {
    try {
      if (input.symbol) {
        const symbol = input.symbol.trim().toUpperCase();
        const { data, url } = await halalGet(`/api/news/${symbol}`, {
          limit: Math.min(input.page_size ?? 10, 50),
        });
        return formatToolResult(data, [url]);
      } else {
        const params: Record<string, string | number | boolean | undefined> = {
          page_size: Math.min(input.page_size ?? 10, 100),
          page: 1,
        };
        if (input.category) params.category = input.category;
        if (input.q) params.q = input.q;
        const { data, url } = await halalGet('/api/news', params);
        return formatToolResult(data, [url]);
      }
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: search_halal_database
// GET /api/database/search
// Search 50K+ stocks with filtering by sector, country, exchange, asset type
// ---------------------------------------------------------------------------

export const searchHalalDatabase = new DynamicStructuredTool({
  name: 'search_halal_database',
  description:
    "Search the Halal Terminal database of 50,000+ globally listed assets. Filter by company name, sector, country, exchange, or asset type ('equities', 'etfs', 'funds'). Use to find halal alternatives, browse stocks in a sector, or look up a company's reference data.",
  schema: z.object({
    q: z.string().optional().describe('Company name or partial ticker to search for'),
    asset_type: z
      .enum(['equities', 'etfs', 'funds'])
      .optional()
      .default('equities')
      .describe("Asset type filter: 'equities' (default), 'etfs', or 'funds'"),
    sector: z
      .string()
      .optional()
      .describe("Sector filter (e.g. 'Technology', 'Healthcare', 'Consumer Cyclical')"),
    country: z
      .string()
      .optional()
      .describe("Country filter (e.g. 'United States', 'United Kingdom', 'Saudi Arabia')"),
    exchange: z
      .string()
      .optional()
      .describe("Exchange filter (e.g. 'NASDAQ', 'NYSE', 'LSE', 'Tadawul')"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(20)
      .describe('Maximum results to return (default 20, max 100)'),
  }),
  func: async (input) => {
    const params: Record<string, string | number | boolean | undefined> = {
      asset_type: input.asset_type ?? 'equities',
      limit: Math.min(input.limit ?? 20, 100),
      offset: 0,
    };
    if (input.q) params.q = input.q;
    if (input.sector) params.sector = input.sector;
    if (input.country) params.country = input.country;
    if (input.exchange) params.exchange = input.exchange;

    try {
      const { data, url } = await halalGet('/api/database/search', params);
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult({ error: err instanceof Error ? err.message : String(err) }, []);
    }
  },
});
