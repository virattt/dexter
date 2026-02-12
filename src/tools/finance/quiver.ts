import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.quiverquant.com';

type QueryValue = string | number | string[] | undefined;

interface ApiResponse {
  data: unknown;
  url: string;
}

function getQuiverApiKey(): string {
  const apiKey = process.env.QUIVER_QUANT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'QUIVER_QUANT_API_KEY is not set. Add it to .env to enable Quiver Quantitative tools.'
    );
  }
  return apiKey;
}

function appendQuery(url: URL, params: Record<string, QueryValue>): void {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.append(key, String(value));
  }
}

async function callQuiverApi(
  path: string,
  params: Record<string, QueryValue>
): Promise<ApiResponse> {
  const apiKey = getQuiverApiKey();
  const url = new URL(path, BASE_URL);
  appendQuery(url, params);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Quiver API] network error: ${path} — ${message}`);
    throw new Error(`[Quiver API] request failed for ${path}: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[Quiver API] error: ${path} — ${detail}`);
    throw new Error(`[Quiver API] request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[Quiver API] parse error: ${path} — ${detail}`);
    throw new Error(`[Quiver API] request failed: ${detail}`);
  });

  return { data, url: url.toString() };
}

const QuiverCongressTradingInputSchema = z.object({
  ticker: z
    .string()
    .optional()
    .describe("Optional stock ticker filter, for example 'AAPL'."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe('Number of records to return (default: 50).'),
});

export const getQuiverCongressTrading = new DynamicStructuredTool({
  name: 'get_quiver_congress_trading',
  description:
    'Retrieves recent U.S. congressional trading disclosures from Quiver Quantitative. Optional ticker filter supported.',
  schema: QuiverCongressTradingInputSchema,
  func: async (input) => {
    const { data, url } = await callQuiverApi('/beta/bulk/congresstrading', {
      version: 'V2',
      page_size: input.page_size,
      ticker: input.ticker,
    });
    return formatToolResult(data, [url]);
  },
});

const QuiverLobbyingInputSchema = z.object({
  ticker: z
    .string()
    .optional()
    .describe("Optional company ticker filter, for example 'MSFT'."),
  query: z
    .string()
    .optional()
    .describe('Optional issue keyword filter, for example energy, healthcare, or AI.'),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(25)
    .describe('Number of records to return (default: 25).'),
});

export const getQuiverLobbying = new DynamicStructuredTool({
  name: 'get_quiver_lobbying',
  description:
    'Retrieves corporate lobbying disclosures from Quiver Quantitative with optional ticker and issue filters.',
  schema: QuiverLobbyingInputSchema,
  func: async (input) => {
    const { data, url } = await callQuiverApi('/beta/historical/lobbying/SEARCHALL', {
      page_size: input.page_size,
      queryTicker: input.ticker,
      query: input.query,
    });
    return formatToolResult(data, [url]);
  },
});

const QuiverInsidersInputSchema = z.object({
  ticker: z
    .string()
    .optional()
    .describe("Optional stock ticker filter, for example 'NVDA'."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe('Number of records to return (default: 50).'),
  limit_codes: z
    .boolean()
    .default(true)
    .describe('Whether to limit insider transaction code types (default: true).'),
});

export const getQuiverInsiders = new DynamicStructuredTool({
  name: 'get_quiver_insiders',
  description:
    'Retrieves recent insider transactions from Quiver Quantitative, optionally filtered by ticker.',
  schema: QuiverInsidersInputSchema,
  func: async (input) => {
    const { data, url } = await callQuiverApi('/beta/live/insiders', {
      page_size: input.page_size,
      limit_codes: input.limit_codes ? 'True' : 'False',
      ticker: input.ticker,
    });
    return formatToolResult(data, [url]);
  },
});

const QuiverBillSummariesInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('Optional keyword filter for bill title/summary, for example energy, tariffs, or semiconductors.'),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(25)
    .describe('Number of records to return (default: 25).'),
  summary_limit: z
    .number()
    .int()
    .min(100)
    .max(10000)
    .default(5000)
    .describe('Maximum characters to include from each bill summary (default: 5000).'),
});

export const getQuiverBillSummaries = new DynamicStructuredTool({
  name: 'get_quiver_bill_summaries',
  description:
    'Retrieves recently active U.S. congressional bill summaries from Quiver Quantitative with optional keyword filter.',
  schema: QuiverBillSummariesInputSchema,
  func: async (input) => {
    const { data, url } = await callQuiverApi('/beta/live/billSummaries', {
      page_size: input.page_size,
      summary_limit: input.summary_limit,
      query: input.query,
    });
    return formatToolResult(data, [url]);
  },
});

