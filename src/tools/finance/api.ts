import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.financialdatasets.ai';

export type Source = 'futu' | 'fmp' | 'secedgar' | 'financialdatasets';

/**
 * Per-category data-source routing. Each category falls back to the original
 * Financial Datasets API unless a free alternative is configured:
 *   - market data (/prices, /crypto)      -> Futu OpenD bridge (FUTU_BRIDGE_URL)
 *   - SEC filings (/filings)              -> SEC EDGAR (USE_SEC_EDGAR=true)
 *   - fundamentals (/financials, /financial-metrics, /earnings, /news,
 *     /institutional-holdings)            -> Financial Modeling Prep (FMP_API_KEY)
 * Anything not covered stays on Financial Datasets.
 */
const FUTU_BRIDGE_URL = (process.env.FUTU_BRIDGE_URL || '').replace(/\/$/, '');
const FMP_API_KEY = process.env.FMP_API_KEY || '';
const USE_SEC_EDGAR = (process.env.USE_SEC_EDGAR || '').toLowerCase() === 'true';

export function resolveSource(endpoint: string): Source {
  if (endpoint.startsWith('/prices') || endpoint.startsWith('/crypto')) {
    return FUTU_BRIDGE_URL ? 'futu' : 'financialdatasets';
  }
  if (endpoint.startsWith('/filings')) {
    return USE_SEC_EDGAR ? 'secedgar' : 'financialdatasets';
  }
  if (
    endpoint.startsWith('/financials') ||
    endpoint.startsWith('/financial-metrics') ||
    endpoint === '/earnings' ||
    endpoint === '/news' ||
    endpoint.startsWith('/institutional-holdings')
  ) {
    return FMP_API_KEY ? 'fmp' : 'financialdatasets';
  }
  return 'financialdatasets';
}

export interface ApiResponse {
  data: Record<string, unknown>;
  url: string;
}

/**
 * Remove redundant fields from API payloads before they are returned to the LLM.
 * This reduces token usage while preserving the financial metrics needed for analysis.
 */
export function stripFieldsDeep(value: unknown, fields: readonly string[]): unknown {
  const fieldsToStrip = new Set(fields);

  function walk(node: unknown): unknown {
    if (Array.isArray(node)) {
      return node.map(walk);
    }

    if (!node || typeof node !== 'object') {
      return node;
    }

    const record = node as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(record)) {
      if (fieldsToStrip.has(key)) {
        continue;
      }
      cleaned[key] = walk(child);
    }

    return cleaned;
  }

  return walk(value);
}

function getApiKey(): string {
  return process.env.FINANCIAL_DATASETS_API_KEY || '';
}

async function executeRequest(
  url: string,
  label: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();

  if (!apiKey) {
    logger.warn(`[Financial Datasets API] call without key: ${label}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'x-api-key': apiKey,
        ...init.headers,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Financial Datasets API] network error: ${label} — ${message}`);
    throw new Error(`[Financial Datasets API] request failed for ${label}: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[Financial Datasets API] error: ${label} — ${detail}`);
    throw new Error(`[Financial Datasets API] request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[Financial Datasets API] parse error: ${label} — ${detail}`);
    throw new Error(`[Financial Datasets API] request failed: ${detail}`);
  });

  return data as Record<string, unknown>;
}

async function fetchFinancialDatasets(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
): Promise<Record<string, unknown>> {
  const label = describeRequest(endpoint, params);
  const url = new URL(`${BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }

  return executeRequest(url.toString(), label, {});
}

export const api = {
  async get(
    endpoint: string,
    params: Record<string, string | number | string[] | undefined>,
    options?: { cacheable?: boolean; ttlMs?: number },
  ): Promise<ApiResponse> {
    const label = describeRequest(endpoint, params);

    if (options?.cacheable) {
      const cached = readCache(endpoint, params, options.ttlMs);
      if (cached) {
        return cached;
      }
    }

    const source = resolveSource(endpoint);
    let data: Record<string, unknown>;
    let srcUrl: string;

    if (source === 'futu') {
      const mod = await import('./futu.js');
      const r = await mod.futuRequest(endpoint, params);
      data = r.data;
      srcUrl = r.url;
    } else if (source === 'fmp') {
      const mod = await import('./fmp.js');
      data = await mod.fmpRequest(endpoint, params);
      srcUrl = `fmp:${endpoint}`;
    } else if (source === 'secedgar') {
      const mod = await import('./secedgar.js');
      data = await mod.secEdgarRequest(endpoint, params);
      srcUrl = `secedgar:${endpoint}`;
    } else {
      data = await fetchFinancialDatasets(endpoint, params);
      srcUrl = `${BASE_URL}${endpoint}`;
    }

    if (options?.cacheable) {
      writeCache(endpoint, params, data, srcUrl);
    }

    return { data, url: srcUrl };
  },

  async post(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<ApiResponse> {
    // Screener and other POST endpoints are only offered by Financial Datasets.
    const label = `POST ${endpoint}`;
    const url = `${BASE_URL}${endpoint}`;

    const data = await executeRequest(url, label, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return { data, url };
  },
};

/** @deprecated Use `api.get` instead */
export const callApi = api.get;
