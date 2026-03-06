import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.financialdatasets.ai';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export interface ApiResponse {
  data: Record<string, unknown>;
  url: string;
}

/**
 * Simple concurrency-limited semaphore for API requests.
 * Prevents blowing through the Financial Datasets rate limit
 * when the LLM fans out to many tickers in parallel.
 */
class ApiSemaphore {
  private queue: (() => void)[] = [];
  private active = 0;
  constructor(private max: number) {}
  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => { this.active++; resolve(); });
    });
  }
  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

const apiSemaphore = new ApiSemaphore(5);

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

export async function callApi(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
  options?: { cacheable?: boolean }
): Promise<ApiResponse> {
  const label = describeRequest(endpoint, params);

  if (options?.cacheable) {
    const cached = readCache(endpoint, params);
    if (cached) {
      return cached;
    }
  }

  const FINANCIAL_DATASETS_API_KEY = process.env.FINANCIAL_DATASETS_API_KEY;

  if (!FINANCIAL_DATASETS_API_KEY) {
    logger.warn(`[Financial Datasets API] call without key: ${label}`);
  }

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

  await apiSemaphore.acquire();
  try {
    return await fetchWithRetry(url.toString(), FINANCIAL_DATASETS_API_KEY || '', label, endpoint, params, options);
  } finally {
    apiSemaphore.release();
  }
}

async function fetchWithRetry(
  url: string,
  apiKey: string,
  label: string,
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
  options?: { cacheable?: boolean },
): Promise<ApiResponse> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'x-api-key': apiKey },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        logger.warn(`[Financial Datasets API] network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${label} — retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      logger.error(`[Financial Datasets API] network error: ${label} — ${message}`);
      throw new Error(`[Financial Datasets API] request failed for ${label}: ${message}`);
    }

    if (response.status === 429) {
      if (attempt < MAX_RETRIES) {
        const retryAfter = response.headers.get('retry-after');
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        logger.warn(`[Financial Datasets API] rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${label} — retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      logger.error(`[Financial Datasets API] rate limited after ${MAX_RETRIES + 1} attempts: ${label}`);
      throw new Error(`[Financial Datasets API] request failed: 429 Too Many Requests`);
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

    if (options?.cacheable) {
      writeCache(endpoint, params, data, url);
    }

    return { data, url };
  }

  throw new Error(`[Financial Datasets API] exhausted retries for ${label}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

