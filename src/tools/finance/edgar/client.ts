/**
 * SEC EDGAR HTTP client with token-bucket rate limiting.
 *
 * EDGAR fair-use policy: max 10 requests/second with an identifying User-Agent.
 * @see https://www.sec.gov/os/accessing-edgar-data
 */
import { readCache, writeCache, describeRequest } from '../../../utils/cache.js';
import { logger } from '../../../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EdgarResponse {
  data: Record<string, unknown>;
  url: string;
}

// ---------------------------------------------------------------------------
// Rate limiter — token bucket (10 req/sec)
// ---------------------------------------------------------------------------

const BUCKET_CAPACITY = 10;
const REFILL_INTERVAL_MS = 1_000; // 1 second

let tokenCount = BUCKET_CAPACITY;
let lastRefillTimestamp = Date.now();

function refillTokens(): void {
  const now = Date.now();
  const elapsedMs = now - lastRefillTimestamp;
  const tokensToAdd = Math.floor(elapsedMs / REFILL_INTERVAL_MS) * BUCKET_CAPACITY;
  if (tokensToAdd > 0) {
    tokenCount = Math.min(BUCKET_CAPACITY, tokenCount + tokensToAdd);
    lastRefillTimestamp = now;
  }
}

async function acquireToken(): Promise<void> {
  refillTokens();
  if (tokenCount > 0) {
    tokenCount--;
    return;
  }
  // Wait until next refill
  const waitMs = REFILL_INTERVAL_MS - (Date.now() - lastRefillTimestamp);
  await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 50)));
  return acquireToken();
}

// ---------------------------------------------------------------------------
// User-Agent
// ---------------------------------------------------------------------------

function getUserAgent(): string {
  const userAgent = process.env.SEC_EDGAR_USER_AGENT;
  if (!userAgent) {
    throw new Error(
      'SEC_EDGAR_USER_AGENT env var is required. ' +
      'Format: "AppName/Version (contact@email.com)" per SEC EDGAR policy.'
    );
  }
  return userAgent;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch JSON from SEC EDGAR with rate limiting and optional caching.
 *
 * @param url      Full URL to fetch (data.sec.gov, efts.sec.gov, or www.sec.gov)
 * @param options  Optional: { cacheable, cacheKey, cacheParams }
 */
export async function edgarFetch(
  url: string,
  options?: {
    cacheable?: boolean;
    cacheKey?: string;
    cacheParams?: Record<string, string | number | string[] | undefined>;
  }
): Promise<EdgarResponse> {
  const cacheEndpoint = options?.cacheKey ?? url;
  const cacheParams = options?.cacheParams ?? {};
  const label = describeRequest(cacheEndpoint, cacheParams);

  // Check local cache first
  if (options?.cacheable) {
    const cached = readCache(cacheEndpoint, cacheParams);
    if (cached) {
      return cached as EdgarResponse;
    }
  }

  await acquireToken();

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': getUserAgent(),
        Accept: 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`EDGAR network error: ${label} — ${message}`);
    throw new Error(`EDGAR request failed for ${label}: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`EDGAR error: ${label} — ${detail}`);
    throw new Error(`EDGAR request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`EDGAR parse error: ${label} — ${detail}`);
    throw new Error(`EDGAR request failed: ${detail}`);
  });

  if (options?.cacheable) {
    writeCache(cacheEndpoint, cacheParams, data, url);
  }

  return { data, url };
}
