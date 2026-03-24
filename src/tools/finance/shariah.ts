/**
 * Shariah finance tools powered by the Halal Terminal API.
 * https://api.halalterminal.com
 *
 * Provides Shariah compliance screening for stocks and ETFs, zakat calculation,
 * dividend purification, and halal stock database search.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

const HALAL_TERMINAL_BASE_URL = 'https://api.halalterminal.com';

function getApiKey(): string {
  return process.env.HALAL_TERMINAL_API_KEY || '';
}

// ---------------------------------------------------------------------------
// Shared HTTP helpers
// ---------------------------------------------------------------------------

async function halalGet(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<{ data: unknown; url: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn('[Halal Terminal] call without API key');
  }

  const url = new URL(`${HALAL_TERMINAL_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { 'X-API-Key': apiKey },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[Halal Terminal] network error: ${msg}`);
  }

  if (!response.ok) {
    throw new Error(`[Halal Terminal] ${response.status} ${response.statusText} — ${path}`);
  }

  const data = await response.json();
  return { data, url: url.toString() };
}

async function halalPost(
  path: string,
  body: Record<string, unknown>,
): Promise<{ data: unknown; url: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn('[Halal Terminal] call without API key');
  }

  const url = `${HALAL_TERMINAL_BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[Halal Terminal] network error: ${msg}`);
  }

  if (!response.ok) {
    throw new Error(`[Halal Terminal] ${response.status} ${response.statusText} — ${path}`);
  }

  const data = await response.json();
  return { data, url };
}

// ---------------------------------------------------------------------------
// Tool: screen_stock_shariah
// Screen a single stock against Shariah compliance methodologies
// ---------------------------------------------------------------------------

const ScreenStockShariahSchema = z.object({
  symbol: z.string().describe("Stock ticker symbol to screen (e.g. 'AAPL', 'MSFT')"),
  methodology: z
    .enum(['AAOIFI', 'MSCI', 'DOW_JONES', 'SP', 'DEFAULT'])
    .optional()
    .describe(
      'Shariah screening methodology to apply. Options: AAOIFI, MSCI, DOW_JONES, SP, DEFAULT. Defaults to DEFAULT.',
    ),
});

export const screenStockShariah = new DynamicStructuredTool({
  name: 'screen_stock_shariah',
  description:
    'Screen a stock for Shariah compliance using the Halal Terminal API. Returns compliance status (COMPLIANT, NON_COMPLIANT, or DOUBTFUL) with detailed breakdown across financial ratios and business activity analysis. Supports multiple methodologies: AAOIFI, MSCI, Dow Jones, S&P.',
  schema: ScreenStockShariahSchema,
  func: async (input) => {
    const symbol = input.symbol.trim().toUpperCase();
    const path = `/api/screen/${symbol}`;
    const body: Record<string, unknown> = {};
    if (input.methodology && input.methodology !== 'DEFAULT') {
      body.methodology = input.methodology;
    }

    try {
      const { data, url } =
        Object.keys(body).length > 0
          ? await halalPost(path, body)
          : await halalGet(path);
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult(
        { error: err instanceof Error ? err.message : String(err) },
        [],
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: screen_etf_shariah
// Screen an ETF's holdings for Shariah compliance
// ---------------------------------------------------------------------------

const ScreenEtfShariahSchema = z.object({
  symbol: z.string().describe("ETF ticker symbol to screen (e.g. 'QQQ', 'SPY', 'HLAL')"),
});

export const screenEtfShariah = new DynamicStructuredTool({
  name: 'screen_etf_shariah',
  description:
    'Screen an ETF for Shariah compliance by analysing each of its holdings. Returns per-holding compliance breakdown, overall compliant percentage, and a summary verdict for the ETF.',
  schema: ScreenEtfShariahSchema,
  func: async (input) => {
    const symbol = input.symbol.trim().toUpperCase();
    const path = `/api/etf/${symbol}/screen`;
    try {
      const { data, url } = await halalPost(path, {});
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult(
        { error: err instanceof Error ? err.message : String(err) },
        [],
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: compare_etf_shariah
// Side-by-side Shariah compliance comparison of multiple ETFs
// ---------------------------------------------------------------------------

const CompareEtfShariahSchema = z.object({
  symbols: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("List of 2–5 ETF ticker symbols to compare (e.g. ['QQQ', 'HLAL', 'SPUS'])"),
});

export const compareEtfShariah = new DynamicStructuredTool({
  name: 'compare_etf_shariah',
  description:
    'Compare 2–5 ETFs side-by-side for Shariah compliance. Returns compliant holding percentages, non-compliant holdings, and overall rankings so investors can choose the most Shariah-compliant ETF option.',
  schema: CompareEtfShariahSchema,
  func: async (input) => {
    const symbols = input.symbols.map((s) => s.trim().toUpperCase());
    const path = '/api/etf/compare';
    try {
      const { data, url } = await halalPost(path, { symbols });
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult(
        { error: err instanceof Error ? err.message : String(err) },
        [],
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: calculate_zakat
// Calculate zakat obligation on a stock portfolio
// ---------------------------------------------------------------------------

const HoldingSchema = z.object({
  symbol: z.string().describe('Stock ticker symbol'),
  shares: z.number().positive().describe('Number of shares held'),
  price: z.number().positive().describe('Current price per share in USD'),
});

const CalculateZakatSchema = z.object({
  holdings: z
    .array(HoldingSchema)
    .min(1)
    .describe('List of stock holdings to calculate zakat on'),
  nisab_usd: z
    .number()
    .optional()
    .describe(
      'Optional nisab threshold in USD. If not provided, the API uses the current gold/silver nisab.',
    ),
});

export const calculateZakat = new DynamicStructuredTool({
  name: 'calculate_zakat',
  description:
    'Calculate the zakat obligation for a stock portfolio. Provide holdings (ticker, shares, price) and the API returns total zakat due, per-holding breakdown, and nisab comparison. Zakat rate is 2.5% on zakatable assets above the nisab threshold.',
  schema: CalculateZakatSchema,
  func: async (input) => {
    const path = '/api/zakat/calculate';
    const body: Record<string, unknown> = { holdings: input.holdings };
    if (input.nisab_usd !== undefined) {
      body.nisab_usd = input.nisab_usd;
    }
    try {
      const { data, url } = await halalPost(path, body);
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult(
        { error: err instanceof Error ? err.message : String(err) },
        [],
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: calculate_purification
// Calculate dividend purification amount for a stock holding
// ---------------------------------------------------------------------------

const CalculatePurificationSchema = z.object({
  symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
  shares: z.number().positive().describe('Number of shares held'),
  period: z
    .string()
    .optional()
    .describe(
      "Dividend period to purify, e.g. '2024' or '2024-Q1'. Defaults to the most recent available period.",
    ),
});

export const calculatePurification = new DynamicStructuredTool({
  name: 'calculate_purification',
  description:
    'Calculate the dividend purification (cleansing) amount for a stock holding. When a compliant stock earns income from non-permissible sources, a portion of dividends must be donated to charity. Returns the exact purification amount in USD.',
  schema: CalculatePurificationSchema,
  func: async (input) => {
    const path = '/api/purification/calculate';
    const body: Record<string, unknown> = {
      symbol: input.symbol.trim().toUpperCase(),
      shares: input.shares,
    };
    if (input.period) {
      body.period = input.period;
    }
    try {
      const { data, url } = await halalPost(path, body);
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult(
        { error: err instanceof Error ? err.message : String(err) },
        [],
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: get_dividends_shariah
// Dividend history with purification amounts
// ---------------------------------------------------------------------------

const GetDividendsShariahSchema = z.object({
  symbol: z.string().describe("Stock ticker symbol (e.g. 'AAPL')"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(8)
    .describe('Maximum number of dividend records to return (default 8)'),
});

export const getDividendsShariah = new DynamicStructuredTool({
  name: 'get_dividends_shariah',
  description:
    'Fetch dividend history for a stock along with per-dividend purification amounts (the amount to donate to charity for each dividend received). Useful for halal investors who receive dividends from partially-compliant companies.',
  schema: GetDividendsShariahSchema,
  func: async (input) => {
    const symbol = input.symbol.trim().toUpperCase();
    const path = `/api/dividends/${symbol}`;
    try {
      const { data, url } = await halalGet(path, { limit: input.limit });
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult(
        { error: err instanceof Error ? err.message : String(err) },
        [],
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Tool: search_halal_database
// Search 50K+ stocks in the halal database
// ---------------------------------------------------------------------------

const SearchHalalDatabaseSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('Company name or partial ticker to search for'),
  status: z
    .enum(['COMPLIANT', 'NON_COMPLIANT', 'DOUBTFUL'])
    .optional()
    .describe('Filter by Shariah compliance status'),
  exchange: z
    .string()
    .optional()
    .describe("Filter by exchange (e.g. 'NASDAQ', 'NYSE', 'LSE')"),
  sector: z
    .string()
    .optional()
    .describe("Filter by sector (e.g. 'Technology', 'Healthcare', 'Consumer')"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(20)
    .describe('Maximum number of results to return (default 20)'),
});

export const searchHalalDatabase = new DynamicStructuredTool({
  name: 'search_halal_database',
  description:
    'Search the Halal Terminal database of 50,000+ globally screened stocks. Filter by Shariah compliance status (COMPLIANT, NON_COMPLIANT, DOUBTFUL), exchange, or sector. Use to find halal alternatives, browse compliant stocks in a sector, or bulk-check multiple companies.',
  schema: SearchHalalDatabaseSchema,
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {
      limit: input.limit,
    };
    if (input.query) params.q = input.query;
    if (input.status) params.status = input.status;
    if (input.exchange) params.exchange = input.exchange;
    if (input.sector) params.sector = input.sector;

    try {
      const { data, url } = await halalGet('/api/database/search', params);
      return formatToolResult(data, [url]);
    } catch (err) {
      return formatToolResult(
        { error: err instanceof Error ? err.message : String(err) },
        [],
      );
    }
  },
});
