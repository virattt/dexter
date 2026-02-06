/**
 * Local file cache for financial API responses.
 *
 * Sits between callApi() and the network to avoid redundant fetches.
 * Only provably immutable data is cached:
 *   - Historical prices with a fully-elapsed date window
 *   - SEC filing items identified by accession number
 *
 * Cache files live in .dexter/cache/ (already gitignored via .dexter/*).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A persisted cache entry.
 * Stores enough context to validate freshness and aid debugging.
 */
interface CacheEntry {
  endpoint: string;
  params: Record<string, unknown>;
  data: Record<string, unknown>;
  url: string;
  cachedAt: string;
}

// ============================================================================
// Cache Policy
// ============================================================================

/**
 * Price endpoints eligible for caching. Uses an include-list so new
 * endpoints are uncached by default (fail-open, not fail-closed).
 */
const CACHEABLE_PRICE_ENDPOINTS = ['/prices/', '/crypto/prices/'];

const CACHE_DIR = '.dexter/cache';

/**
 * Determine whether a request is safe to cache.
 *
 * A request is cacheable when its data is provably immutable:
 *   1. Historical prices — cache when `end_date` is strictly before today.
 *      Once a trading day closes its OHLCV data is final.
 *   2. SEC filing items — cache when `accession_number` is present.
 *      Filed SEC documents are legally immutable.
 */
export function isCacheable(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>
): boolean {
  // Historical prices: cache when the date window is fully closed
  if (CACHEABLE_PRICE_ENDPOINTS.includes(endpoint)) {
    const endDate = params.end_date;
    if (typeof endDate !== 'string') return false;

    const end = new Date(endDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return end < today;
  }

  // SEC filing items: cache when accession_number identifies a specific filing
  if (endpoint === '/filings/items/') {
    return typeof params.accession_number === 'string';
  }

  return false;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a human-readable label for log messages.
 * Example: "/prices/ (AAPL)"
 */
export function describeRequest(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>
): string {
  const ticker = typeof params.ticker === 'string' ? params.ticker.toUpperCase() : null;
  return ticker ? `${endpoint} (${ticker})` : endpoint;
}

/**
 * Generate a deterministic cache key from endpoint + params.
 * Params are sorted alphabetically so insertion order doesn't matter.
 *
 * Resulting path:  {clean_endpoint}/{TICKER_}{hash}.json
 * Example:         prices/AAPL_a1b2c3d4e5f6.json
 */
export function buildCacheKey(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>
): string {
  // Build a canonical string from sorted, non-empty params
  const sortedParams = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? [...v].sort().join(',') : v}`)
    .join('&');

  const raw = `${endpoint}?${sortedParams}`;
  const hash = createHash('md5').update(raw).digest('hex').slice(0, 12);

  // Turn "/prices/" → "prices"
  const cleanEndpoint = endpoint
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\//g, '_');

  // Prefix with ticker when available for human-readable filenames
  const ticker = typeof params.ticker === 'string' ? params.ticker.toUpperCase() : null;
  const prefix = ticker ? `${ticker}_` : '';

  return `${cleanEndpoint}/${prefix}${hash}.json`;
}

/**
 * Validate that a parsed object has the shape of a CacheEntry.
 * Guards against truncated writes, schema changes, or manual edits.
 */
function isValidCacheEntry(value: unknown): value is CacheEntry {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.endpoint === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.cachedAt === 'string' &&
    typeof obj.data === 'object' &&
    obj.data !== null
  );
}

/**
 * Safely remove a cache file (e.g. when it's corrupted).
 * Logs on failure but never throws.
 */
function removeCacheFile(filepath: string): void {
  try {
    unlinkSync(filepath);
  } catch {
    // Best-effort cleanup — not critical
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Read a cached API response if it exists and is still valid.
 * Returns null on cache miss or any read/parse error.
 */
export function readCache(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>
): { data: Record<string, unknown>; url: string } | null {
  if (!isCacheable(endpoint, params)) return null;

  const cacheKey = buildCacheKey(endpoint, params);
  const filepath = join(CACHE_DIR, cacheKey);
  const label = describeRequest(endpoint, params);

  if (!existsSync(filepath)) {
    return null;
  }

  try {
    const content = readFileSync(filepath, 'utf-8');
    const parsed: unknown = JSON.parse(content);

    // Validate entry structure
    if (!isValidCacheEntry(parsed)) {
      logger.warn(`Cache corrupted (invalid structure): ${label}`, { filepath });
      removeCacheFile(filepath);
      return null;
    }

    return { data: parsed.data, url: parsed.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Cache read error: ${label} — ${message}`, { filepath });
    // Remove corrupted file so subsequent calls don't hit the same error
    removeCacheFile(filepath);
    return null;
  }
}

/**
 * Write an API response to the cache.
 * Skips if the request is not cacheable. Logs on I/O errors
 * but never throws — cache writes must not break the application.
 */
export function writeCache(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
  data: Record<string, unknown>,
  url: string
): void {
  if (!isCacheable(endpoint, params)) return;

  const cacheKey = buildCacheKey(endpoint, params);
  const filepath = join(CACHE_DIR, cacheKey);
  const label = describeRequest(endpoint, params);

  const entry: CacheEntry = {
    endpoint,
    params,
    data,
    url,
    cachedAt: new Date().toISOString(),
  };

  try {
    const dir = dirname(filepath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filepath, JSON.stringify(entry, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Cache write error: ${label} — ${message}`, { filepath });
  }
}
