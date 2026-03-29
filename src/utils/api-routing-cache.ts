/**
 * Lightweight on-disk cache that remembers which API backend works for each
 * ticker. Persisted at .dexter/api-routing.json.
 *
 * This eliminates repeated fallback probing across sessions: once we discover
 * that VWS.CO is FMP-premium and needs Yahoo/web, that decision is saved and
 * used immediately on the next session without re-attempting the failing API.
 *
 * TTL: 30 days — stale enough to catch coverage changes but fresh enough to
 * notice when a broker gains or loses data.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { dexterPath } from './paths.js';

export type ApiPreference = 'fmp' | 'yahoo' | 'web' | 'financial-datasets';

interface RoutingEntry {
  preferred: ApiPreference;
  /** ISO date string when the preference was last confirmed. */
  updatedAt: string;
}

interface RoutingCacheFile {
  version: 1;
  routes: Record<string, RoutingEntry>;
}

const CACHE_PATH = dexterPath('api-routing.json');
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let inMemoryCache: Map<string, RoutingEntry> | null = null;
let dirty = false;

function normalizeKey(ticker: string): string {
  return ticker.toUpperCase().trim();
}

function isStale(entry: RoutingEntry): boolean {
  return Date.now() - new Date(entry.updatedAt).getTime() > TTL_MS;
}

async function load(): Promise<Map<string, RoutingEntry>> {
  if (inMemoryCache) return inMemoryCache;
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8');
    const data = JSON.parse(raw) as RoutingCacheFile;
    inMemoryCache = new Map(Object.entries(data.routes ?? {}));
  } catch {
    inMemoryCache = new Map();
  }
  return inMemoryCache;
}

async function persist(): Promise<void> {
  if (!dirty || !inMemoryCache) return;
  const data: RoutingCacheFile = {
    version: 1,
    routes: Object.fromEntries(inMemoryCache),
  };
  try {
    await mkdir(dirname(CACHE_PATH), { recursive: true });
    await writeFile(CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    dirty = false;
  } catch {
    // Non-fatal — routing cache is best-effort
  }
}

/**
 * Returns the preferred API for the given ticker, or null if unknown / stale.
 */
export async function getPreferredApi(ticker: string): Promise<ApiPreference | null> {
  const cache = await load();
  const key = normalizeKey(ticker);
  const entry = cache.get(key);
  if (!entry || isStale(entry)) return null;
  return entry.preferred;
}

/**
 * Saves or updates the preferred API for the given ticker.
 * Call this after a successful API response or after a confirmed fallback.
 */
export async function setPreferredApi(ticker: string, preferred: ApiPreference): Promise<void> {
  const cache = await load();
  const key = normalizeKey(ticker);
  const existing = cache.get(key);
  if (existing?.preferred === preferred) return; // no change — skip write
  cache.set(key, { preferred, updatedAt: new Date().toISOString() });
  dirty = true;
  void persist();
}

/**
 * Removes a ticker's routing entry (e.g. after a previously preferred API
 * starts returning errors — force rediscovery on the next call).
 */
export async function clearRoutingEntry(ticker: string): Promise<void> {
  const cache = await load();
  const key = normalizeKey(ticker);
  if (cache.has(key)) {
    cache.delete(key);
    dirty = true;
    void persist();
  }
}

/**
 * Returns all cached routing entries as a plain object — useful for debugging.
 */
export async function dumpRoutingCache(): Promise<Record<string, RoutingEntry>> {
  const cache = await load();
  return Object.fromEntries(cache);
}
