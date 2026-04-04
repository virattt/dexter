/**
 * J-Quants API v2 client for Japanese stock market data.
 * Docs: https://jpx-jquants.com/spec/
 *
 * Authentication: x-api-key header with static API key (no token rotation needed).
 * Get your API key at https://jpx-jquants.com/ → Settings → API Key
 */
import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.jquants.com/v2';

export interface ApiResponse {
  data: Record<string, unknown>;
  url: string;
}

// ============================================================================
// stripFieldsDeep (re-exported for use in other tools)
// ============================================================================

export function stripFieldsDeep(value: unknown, fields: readonly string[]): unknown {
  const fieldsToStrip = new Set(fields);
  function walk(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const record = node as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
      if (!fieldsToStrip.has(key)) cleaned[key] = walk(child);
    }
    return cleaned;
  }
  return walk(value);
}

// ============================================================================
// HTTP helpers
// ============================================================================

async function executeRequest(url: string, label: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.JQUANTS_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[J-Quants] JQUANTS_API_KEY is not set. Get your API key at https://jpx-jquants.com/ → Settings → API Key',
    );
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'x-api-key': apiKey },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[J-Quants] network error: ${label} — ${msg}`);
    throw new Error(`[J-Quants] request failed for ${label}: ${msg}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[J-Quants] error: ${label} — ${detail} — ${body.slice(0, 200)}`);
    throw new Error(`[J-Quants] ${detail}: ${body.slice(0, 200)}`);
  }

  const json = await response.json().catch(() => {
    throw new Error(`[J-Quants] invalid JSON response for ${label}`);
  }) as Record<string, unknown>;

  // v2 wraps results in a "data" array
  return json;
}

// ============================================================================
// Public API
// ============================================================================

export const jquantsApi = {
  async get(
    endpoint: string,
    params: Record<string, string | number | undefined>,
    options?: { cacheable?: boolean },
  ): Promise<ApiResponse> {
    const label = describeRequest(endpoint, params as Record<string, string | number | string[] | undefined>);

    if (options?.cacheable) {
      const cached = readCache(endpoint, params as Record<string, string | number | string[] | undefined>);
      if (cached) return cached;
    }

    const url = new URL(`${BASE_URL}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }

    const json = await executeRequest(url.toString(), label);

    // v2 returns { data: [...] } — wrap as { data: json } for compatibility
    const result: ApiResponse = { data: json, url: url.toString() };

    if (options?.cacheable) {
      writeCache(endpoint, params as Record<string, string | number | string[] | undefined>, json, url.toString());
    }

    return result;
  },
};
