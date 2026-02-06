/**
 * Local file cache for financial API responses.
 *
 * Sits between callApi() and the network to avoid redundant fetches.
 * Historical / static data is cached indefinitely; real-time data
 * (snapshots, news) is always fetched live.
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

/**
 * Cache policy for an API endpoint.
 * - 'always': Cache indefinitely (historical / static data)
 * - 'never':  Never cache (real-time / frequently changing data)
 * - number:   Cache with a TTL in milliseconds
 */
type CachePolicy = 'always' | 'never' | number;

// ============================================================================
// Cache Policy Configuration
// ============================================================================

/**
 * Endpoints that must NEVER be cached because they return real-time
 * or frequently changing data. Matched by prefix.
 *
 * Everything else that goes through callApi() is considered historical
 * / static and is cached indefinitely by default. This means new
 * endpoints are automatically cached unless explicitly excluded here.
 *
 * When adding a new real-time endpoint, add it to this list.
 */
const NEVER_CACHE_ENDPOINTS: string[] = [
  '/prices/snapshot/',
  '/crypto/prices/snapshot/',
  '/financial-metrics/snapshot/',
  '/news/',
  '/analyst-estimates/',
];

const CACHE_DIR = '.dexter/cache';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a human-readable label for log messages.
 * Example: "/financials/income-statements/ (AAPL)"
 */
function describeRequest(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>
): string {
  const ticker = typeof params.ticker === 'string' ? params.ticker.toUpperCase() : null;
  return ticker ? `${endpoint} (${ticker})` : endpoint;
}

/**
 * Get the cache policy for a given endpoint.
 * Real-time endpoints listed in NEVER_CACHE_ENDPOINTS are skipped;
 * everything else is cached indefinitely (historical financial data).
 */
function getCachePolicy(endpoint: string): CachePolicy {
  for (const prefix of NEVER_CACHE_ENDPOINTS) {
    if (endpoint.startsWith(prefix)) {
      return 'never';
    }
  }
  return 'always';
}

/**
 * Generate a deterministic cache key from endpoint + params.
 * Params are sorted alphabetically so insertion order doesn't matter.
 *
 * Resulting path:  {clean_endpoint}/{TICKER_}{hash}.json
 * Example:         financials_income-statements/AAPL_a1b2c3d4e5f6.json
 */
function buildCacheKey(
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

  // Turn "/financials/income-statements/" → "financials_income-statements"
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
 * Returns null on cache miss, expired entry, or any read/parse error.
 */
export function readCache(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>
): { data: Record<string, unknown>; url: string } | null {
  const policy = getCachePolicy(endpoint);
  if (policy === 'never') return null;

  const cacheKey = buildCacheKey(endpoint, params);
  const filepath = join(CACHE_DIR, cacheKey);
  const label = describeRequest(endpoint, params);

  if (!existsSync(filepath)) {
    logger.debug(`Cache miss: ${label}`);
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

    // Check TTL for time-based policies
    if (typeof policy === 'number') {
      const age = Date.now() - new Date(parsed.cachedAt).getTime();
      if (age > policy) {
        logger.debug(`Cache expired: ${label} (age: ${Math.round(age / 1000)}s)`);
        removeCacheFile(filepath);
        return null;
      }
    }

    logger.debug(`Cache hit: ${label}`);
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
 * Skips if the endpoint's policy is 'never'. Logs on I/O errors
 * but never throws — cache writes must not break the application.
 */
export function writeCache(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
  data: Record<string, unknown>,
  url: string
): void {
  const policy = getCachePolicy(endpoint);
  if (policy === 'never') return;

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
    logger.debug(`Cache write: ${label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Cache write error: ${label} — ${message}`, { filepath });
  }
}
