import { describeRequest, readCache, writeCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

// ── Provider base URLs ─────────────────────────────────────────────────────

const POLYGON_BASE = 'https://api.polygon.io';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const FMP_BASE = 'https://financialmodelingprep.com/api/v3';
const SEC_EDGAR_BASE = 'https://data.sec.gov';

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

// ── Shared request execution ───────────────────────────────────────────────

async function executeRequest(
  provider: string,
  url: string,
  label: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[${provider}] network error: ${label} — ${message}`);
    throw new Error(`[${provider}] request failed for ${label}: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[${provider}] error: ${label} — ${detail}`);
    throw new Error(`[${provider}] request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[${provider}] parse error: ${label} — ${detail}`);
    throw new Error(`[${provider}] request failed: ${detail}`);
  });

  return data as Record<string, unknown>;
}

// ── Polygon API (primary — prices, financials, news, filings, earnings) ────

function buildUrl(
  base: string,
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
  authParam?: { key: string; value: string },
): URL {
  const url = new URL(`${base}${endpoint}`);
  if (authParam) {
    url.searchParams.set(authParam.key, authParam.value);
  }
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        url.searchParams.set(key, value.join(','));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

export const api = {
  async get(
    endpoint: string,
    params: Record<string, string | number | string[] | undefined> = {},
    options?: { cacheable?: boolean },
  ): Promise<ApiResponse> {
    const label = describeRequest(endpoint, params);

    if (options?.cacheable) {
      const cached = readCache(endpoint, params);
      if (cached) {
        return cached;
      }
    }

    const apiKey = process.env.POLYGON_API_KEY || '';
    if (!apiKey) {
      throw new Error('POLYGON_API_KEY not set. Get a free key at https://polygon.io');
    }

    const url = buildUrl(POLYGON_BASE, endpoint, params, { key: 'apiKey', value: apiKey });
    const data = await executeRequest('Polygon', url.toString(), label);

    if (options?.cacheable) {
      writeCache(endpoint, params, data, url.toString());
    }

    return { data, url: url.toString() };
  },

  async post(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const label = `POST ${endpoint}`;
    const apiKey = process.env.POLYGON_API_KEY || '';
    if (!apiKey) {
      throw new Error('POLYGON_API_KEY not set. Get a free key at https://polygon.io');
    }
    const url = `${POLYGON_BASE}${endpoint}?apiKey=${apiKey}`;

    const data = await executeRequest('Polygon', url, label, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return { data, url };
  },
};

// ── Finnhub API (insider trades) ───────────────────────────────────────────

export const finnhub = {
  async get(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<ApiResponse> {
    const label = describeRequest(endpoint, params);
    const apiKey = process.env.FINNHUB_API_KEY || '';
    if (!apiKey) {
      throw new Error('FINNHUB_API_KEY not set. Get a free key at https://finnhub.io');
    }

    const url = buildUrl(FINNHUB_BASE, endpoint, params, { key: 'token', value: apiKey });
    const data = await executeRequest('Finnhub', url.toString(), label);
    return { data, url: url.toString() };
  },
};

// ── FMP API (stock screener) ───────────────────────────────────────────────

export const fmp = {
  async get(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<ApiResponse> {
    const label = describeRequest(endpoint, params);
    const apiKey = process.env.FMP_API_KEY || '';
    if (!apiKey) {
      throw new Error('FMP_API_KEY not set. Get a free key at https://financialmodelingprep.com');
    }

    const url = buildUrl(FMP_BASE, endpoint, params, { key: 'apikey', value: apiKey });
    const data = await executeRequest('FMP', url.toString(), label);
    return { data, url: url.toString() };
  },
};

// ── SEC EDGAR API (free, no key — segmented revenues via XBRL) ─────────────

export class EdgarHostBlockedError extends Error {
  constructor() {
    super(`[SEC EDGAR] host not reachable: ${SEC_EDGAR_BASE} is blocked by the network`);
    this.name = 'EdgarHostBlockedError';
  }
}

export const edgar = {
  async get(
    endpoint: string,
    label?: string,
  ): Promise<ApiResponse> {
    const url = `${SEC_EDGAR_BASE}${endpoint}`;
    const requestLabel = label || endpoint;
    const userAgent = process.env.SEC_EDGAR_USER_AGENT || 'Dexter support@dexter.ai';

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/json',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[SEC EDGAR] network error: ${requestLabel} — ${message}`);
      throw new Error(`[SEC EDGAR] request failed for ${requestLabel}: ${message}`);
    }

    if (!response.ok) {
      if (response.headers.get('x-deny-reason') === 'host_not_allowed') {
        throw new EdgarHostBlockedError();
      }
      const detail = `${response.status} ${response.statusText}`;
      logger.error(`[SEC EDGAR] error: ${requestLabel} — ${detail}`);
      throw new Error(`[SEC EDGAR] request failed: ${detail}`);
    }

    const data = await response.json().catch(() => {
      const detail = `invalid JSON (${response.status} ${response.statusText})`;
      logger.error(`[SEC EDGAR] parse error: ${requestLabel} — ${detail}`);
      throw new Error(`[SEC EDGAR] request failed: ${detail}`);
    });

    return { data: data as Record<string, unknown>, url };
  },
};

/** @deprecated Use `api.get` instead */
export const callApi = api.get;
