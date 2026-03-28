import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';
import { withRetry, isRateLimitError } from '../../utils/retry.js';
import { trackFmpCall, getQuotaWarning } from '../../utils/fmp-quota.js';

const BASE_URL = 'https://api.financialdatasets.ai';

/**
 * Marker thrown when Financial Datasets API returns HTTP 402 (endpoint requires
 * a paid plan). Downstream callers check for this string to trigger fallback logic.
 */
export const FINANCIAL_DATASETS_PREMIUM = 'FINANCIAL_DATASETS_PREMIUM_REQUIRED';

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
  const key = process.env.FINANCIAL_DATASETS_API_KEY || '';
  if (!key) {
    throw new Error(
      '[Financial Datasets API] FINANCIAL_DATASETS_API_KEY is not set. ' +
      'Add it to your .env file to use financial data tools.',
    );
  }
  return key;
}

/**
 * Shared request execution: handles API key, error handling, logging, and response parsing.
 */
async function executeRequest(
  url: string,
  label: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();

  let response: Response;
  try {
    response = await withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);
        try {
          const res = await fetch(url, {
            ...init,
            headers: { 'x-api-key': apiKey, ...init.headers },
            signal: controller.signal,
          });
          // Throw so withRetry can catch and back off on 429
          if (res.status === 429) throw new Error(`429 rate limit`);
          return res;
        } finally {
          clearTimeout(timeout);
        }
      },
      { maxAttempts: 4, shouldRetry: isRateLimitError },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error(`[Financial Datasets API] timeout: ${label}`);
      throw new Error(`[Financial Datasets API] request timed out after 30s: ${label}`);
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Financial Datasets API] network error: ${label} — ${message}`);
    throw new Error(`[Financial Datasets API] request failed for ${label}: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[Financial Datasets API] error: ${label} — ${detail}`);
    if (response.status === 402) {
      throw new Error(
        `${FINANCIAL_DATASETS_PREMIUM}: This endpoint requires a paid Financial Datasets plan. ` +
          'Upgrade at https://financialdatasets.ai or use web_search as a fallback.',
      );
    }
    throw new Error(`[Financial Datasets API] request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[Financial Datasets API] parse error: ${label} — ${detail}`);
    throw new Error(`[Financial Datasets API] request failed: ${detail}`);
  });

  return data as Record<string, unknown>;
}

export const api = {
  async get(
    endpoint: string,
    params: Record<string, string | number | string[] | undefined>,
    options?: { cacheable?: boolean },
  ): Promise<ApiResponse> {
    const label = describeRequest(endpoint, params);

    // Check local cache first — avoids redundant network calls for immutable data
    if (options?.cacheable) {
      const cached = readCache(endpoint, params);
      if (cached) {
        return cached;
      }
    }

    const url = new URL(`${BASE_URL}${endpoint}`);

    // Add params to URL, handling arrays
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, v));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const data = await executeRequest(url.toString(), label, {});

    // Track quota usage and surface a warning in the result when approaching the limit.
    // Only real network calls are counted (cache hits above are returned early).
    const quotaStatus = trackFmpCall();
    const quotaWarning = getQuotaWarning();
    if (quotaWarning) {
      (data as Record<string, unknown>)['_fmpQuotaWarning'] = quotaWarning;
      logger.warn(`[FMP Quota] ${quotaStatus.used}/${quotaStatus.limit} calls used today`);
    }

    // Persist for future requests when the caller marked the response as cacheable
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
