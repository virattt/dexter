/**
 * EDINET DB API client.
 *
 * REST API wrapper for https://edinetdb.jp/v1/ with:
 * - X-API-Key header authentication
 * - In-memory + file-based cache (24h TTL)
 * - Rate limit handling (100 req/day on free plan)
 * - Error handling (429, 404, etc.)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { logger } from './logger.js';
import { dexterPath } from './paths.js';

const BASE_URL = 'https://edinetdb.jp/v1';
const CACHE_DIR = dexterPath('cache', 'edinetdb');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache for hot data within a single session
const memoryCache = new Map<string, { data: unknown; cachedAt: number }>();

// ============================================================================
// Helpers
// ============================================================================

function getApiKey(): string {
  return process.env.EDINETDB_API_KEY || '';
}

function buildCacheKey(endpoint: string, params: Record<string, string | number | undefined>): string {
  const sortedParams = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const raw = `${endpoint}?${sortedParams}`;
  const hash = createHash('md5').update(raw).digest('hex').slice(0, 12);
  const cleanEndpoint = endpoint.replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '_');
  return `${cleanEndpoint}_${hash}.json`;
}

function describeRequest(
  endpoint: string,
  params: Record<string, string | number | undefined>,
): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`);
  return entries.length > 0 ? `${endpoint} ${entries.join(' ')}` : endpoint;
}

// ============================================================================
// Cache Layer (file-based with TTL)
// ============================================================================

interface FileCacheEntry {
  endpoint: string;
  params: Record<string, unknown>;
  data: unknown;
  url: string;
  cachedAt: string;
}

function readFileCache(key: string): { data: unknown; url: string } | null {
  // Check memory cache first
  const memEntry = memoryCache.get(key);
  if (memEntry && Date.now() - memEntry.cachedAt < CACHE_TTL_MS) {
    return { data: memEntry.data, url: '' };
  }

  const filepath = join(CACHE_DIR, key);
  if (!existsSync(filepath)) return null;

  try {
    const content = readFileSync(filepath, 'utf-8');
    const parsed = JSON.parse(content) as FileCacheEntry;

    // Check TTL
    const cachedAt = new Date(parsed.cachedAt).getTime();
    if (Date.now() - cachedAt > CACHE_TTL_MS) {
      return null; // Expired
    }

    // Warm memory cache
    memoryCache.set(key, { data: parsed.data, cachedAt });
    return { data: parsed.data, url: parsed.url };
  } catch {
    return null;
  }
}

function writeFileCache(
  key: string,
  endpoint: string,
  params: Record<string, unknown>,
  data: unknown,
  url: string,
): void {
  // Always update memory cache
  memoryCache.set(key, { data, cachedAt: Date.now() });

  const filepath = join(CACHE_DIR, key);
  const entry: FileCacheEntry = {
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
    logger.warn(`[EDINET DB] cache write error: ${message}`);
  }
}

// ============================================================================
// Rate Limit Tracker
// ============================================================================

let dailyRequestCount = 0;
let dailyResetDate = new Date().toDateString();

function checkAndIncrementRateLimit(): void {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) {
    dailyRequestCount = 0;
    dailyResetDate = today;
  }
  dailyRequestCount++;

  if (dailyRequestCount > 90) {
    logger.warn(`[EDINET DB] approaching daily limit: ${dailyRequestCount}/100 requests used`);
  }
}

export function getRemainingRequests(): number {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) return 100;
  return Math.max(0, 100 - dailyRequestCount);
}

// ============================================================================
// Public API
// ============================================================================

export interface EdinetDbResponse {
  data: unknown;
  url: string;
  fromCache: boolean;
}

export const edinetDb = {
  async get(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
    options?: { skipCache?: boolean },
  ): Promise<EdinetDbResponse> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('[EDINET DB] EDINETDB_API_KEY is not set');
    }

    const cacheKey = buildCacheKey(endpoint, params);
    const label = describeRequest(endpoint, params);

    // Check cache first (unless explicitly skipped)
    if (!options?.skipCache) {
      const cached = readFileCache(cacheKey);
      if (cached) {
        logger.info(`[EDINET DB] cache hit: ${label}`);
        return { data: cached.data, url: cached.url, fromCache: true };
      }
    }

    // Build URL
    const url = new URL(`${BASE_URL}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }

    checkAndIncrementRateLimit();

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { 'X-API-Key': apiKey },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[EDINET DB] network error: ${label} — ${message}`);
      throw new Error(`[EDINET DB] request failed for ${label}: ${message}`);
    }

    // Handle specific error codes
    if (response.status === 429) {
      throw new Error('[EDINET DB] rate limit exceeded (100 requests/day on free plan). Try again tomorrow.');
    }

    if (response.status === 404) {
      throw new Error(`[EDINET DB] not found: ${label}. Check the EDINET code or company name.`);
    }

    if (!response.ok) {
      const detail = `${response.status} ${response.statusText}`;
      logger.error(`[EDINET DB] error: ${label} — ${detail}`);
      throw new Error(`[EDINET DB] request failed: ${detail}`);
    }

    const data = await response.json().catch(() => {
      throw new Error(`[EDINET DB] invalid JSON response for ${label}`);
    });

    // Cache the response
    writeFileCache(cacheKey, endpoint, params, data, url.toString());

    return { data, url: url.toString(), fromCache: false };
  },
};
