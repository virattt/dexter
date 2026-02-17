import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { buildCacheKey, readCache, writeCache, CACHE_TTL_WEEKLY, CACHE_TTL_MONTHLY, CACHE_TTL_QUARTERLY } from './cache.js';

const TEST_CACHE_DIR = '.dexter/cache';

// ---------------------------------------------------------------------------
// buildCacheKey
// ---------------------------------------------------------------------------

describe('buildCacheKey', () => {
  test('produces the same key regardless of param insertion order', () => {
    const paramsA = { ticker: 'AAPL', start_date: '2024-01-01', end_date: '2024-12-31', interval: 'day', interval_multiplier: 1 };
    const paramsB = { interval_multiplier: 1, end_date: '2024-12-31', ticker: 'AAPL', interval: 'day', start_date: '2024-01-01' };
    expect(buildCacheKey('/prices/', paramsA)).toBe(buildCacheKey('/prices/', paramsB));
  });

  test('sorts array values without mutating the original', () => {
    const items = ['Item-7', 'Item-1', 'Item-1A'];
    const original = [...items];
    buildCacheKey('/filings/items/', { ticker: 'AAPL', item: items });
    expect(items).toEqual(original); // not mutated
  });

  test('produces different keys for different params', () => {
    const keyA = buildCacheKey('/prices/', { ticker: 'AAPL', start_date: '2024-01-01', end_date: '2024-06-30' });
    const keyB = buildCacheKey('/prices/', { ticker: 'AAPL', start_date: '2024-01-01', end_date: '2024-12-31' });
    expect(keyA).not.toBe(keyB);
  });

  test('includes ticker prefix for readable filenames', () => {
    const key = buildCacheKey('/prices/', { ticker: 'AAPL', start_date: '2024-01-01', end_date: '2024-12-31' });
    expect(key).toMatch(/^prices\/AAPL_/);
    expect(key).toMatch(/\.json$/);
  });

  test('omits undefined and null params', () => {
    const keyA = buildCacheKey('/prices/', { ticker: 'AAPL', start_date: '2024-01-01', end_date: '2024-12-31', limit: undefined });
    const keyB = buildCacheKey('/prices/', { ticker: 'AAPL', start_date: '2024-01-01', end_date: '2024-12-31' });
    expect(keyA).toBe(keyB);
  });
});

// ---------------------------------------------------------------------------
// readCache / writeCache round-trip
// ---------------------------------------------------------------------------

describe('readCache / writeCache', () => {
  beforeEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true });
    }
  });

  test('round-trips data through write then read', () => {
    const endpoint = '/prices/';
    const params = { ticker: 'AAPL', start_date: '2024-01-01', end_date: '2024-12-31', interval: 'day', interval_multiplier: 1 };
    const data = { prices: [{ open: 100, close: 105, high: 106, low: 99 }] };
    const url = 'https://api.financialdatasets.ai/prices/?ticker=AAPL&start_date=2024-01-01&end_date=2024-12-31';

    writeCache(endpoint, params, data, url);
    const cached = readCache(endpoint, params);

    expect(cached).not.toBeNull();
    expect(cached!.data).toEqual(data);
    expect(cached!.url).toBe(url);
  });

  test('returns null on cache miss (no file)', () => {
    const cached = readCache('/prices/', { ticker: 'AAPL', start_date: '2024-01-01', end_date: '2024-12-31' });
    expect(cached).toBeNull();
  });

  test('returns null and removes file when cache entry is corrupted JSON', () => {
    const endpoint = '/prices/';
    const params = { ticker: 'AAPL', start_date: '2024-01-01', end_date: '2024-12-31', interval: 'day', interval_multiplier: 1 };

    const key = buildCacheKey(endpoint, params);
    const filepath = join(TEST_CACHE_DIR, key);
    const dir = join(TEST_CACHE_DIR, key.split('/')[0]!);
    mkdirSync(dir, { recursive: true });
    writeFileSync(filepath, '{ broken json!!!');

    const cached = readCache(endpoint, params);
    expect(cached).toBeNull();
    expect(existsSync(filepath)).toBe(false);
  });

  test('returns null and removes file when cache entry has invalid structure', () => {
    const endpoint = '/prices/';
    const params = { ticker: 'AAPL', start_date: '2024-01-01', end_date: '2024-12-31', interval: 'day', interval_multiplier: 1 };

    const key = buildCacheKey(endpoint, params);
    const filepath = join(TEST_CACHE_DIR, key);
    const dir = join(TEST_CACHE_DIR, key.split('/')[0]!);
    mkdirSync(dir, { recursive: true });
    writeFileSync(filepath, JSON.stringify({ wrong: 'shape' }));

    const cached = readCache(endpoint, params);
    expect(cached).toBeNull();
    expect(existsSync(filepath)).toBe(false);
  });

  test('respects per-entry quarterly TTL — fresh entry is returned', () => {
    const endpoint = '/financials/income-statements/';
    const params = { ticker: 'AAPL', period: 'annual', limit: 5 };
    const data = { income_statements: [{ revenue: 400_000_000_000 }] };
    const url = 'https://api.financialdatasets.ai/financials/income-statements/?ticker=AAPL';

    writeCache(endpoint, params, data, url, CACHE_TTL_QUARTERLY);
    const cached = readCache(endpoint, params);

    expect(cached).not.toBeNull();
    expect(cached!.data).toEqual(data);
  });

  test('quarterly TTL entry survives past the default weekly window', () => {
    const endpoint = '/institutional-ownership/';
    const params = { ticker: 'AAPL', limit: 10 };
    const data = { 'institutional-ownership': [{ investor: 'Vanguard', shares: 1_000_000 }] };
    const url = 'https://api.financialdatasets.ai/institutional-ownership/?ticker=AAPL';

    // Write the entry, then manually backdate it to 30 days ago
    writeCache(endpoint, params, data, url, CACHE_TTL_QUARTERLY);

    const key = buildCacheKey(endpoint, params);
    const filepath = join(TEST_CACHE_DIR, key);
    const raw = JSON.parse(readFileSync(filepath, 'utf-8'));
    raw.cachedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    writeFileSync(filepath, JSON.stringify(raw, null, 2));

    // Should still be valid — 30 days < 90 day TTL
    const cached = readCache(endpoint, params);
    expect(cached).not.toBeNull();
    expect(cached!.data).toEqual(data);
  });

  test('quarterly TTL entry expires after 90 days', () => {
    const endpoint = '/institutional-ownership/';
    const params = { ticker: 'MSFT', limit: 10 };
    const data = { 'institutional-ownership': [{ investor: 'BlackRock', shares: 500_000 }] };
    const url = 'https://api.financialdatasets.ai/institutional-ownership/?ticker=MSFT';

    writeCache(endpoint, params, data, url, CACHE_TTL_QUARTERLY);

    const key = buildCacheKey(endpoint, params);
    const filepath = join(TEST_CACHE_DIR, key);
    const raw = JSON.parse(readFileSync(filepath, 'utf-8'));
    raw.cachedAt = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    writeFileSync(filepath, JSON.stringify(raw, null, 2));

    // Should be expired — 91 days > 90 day TTL
    const cached = readCache(endpoint, params);
    expect(cached).toBeNull();
    expect(existsSync(filepath)).toBe(false);
  });

  test('entry without ttlMs falls back to default weekly TTL', () => {
    const endpoint = '/prices/snapshot/';
    const params = { ticker: 'AAPL' };
    const data = { snapshot: { price: 195.5 } };
    const url = 'https://api.financialdatasets.ai/prices/snapshot/?ticker=AAPL';

    // Write without ttlMs (legacy behavior)
    writeCache(endpoint, params, data, url);

    const key = buildCacheKey(endpoint, params);
    const filepath = join(TEST_CACHE_DIR, key);
    const raw = JSON.parse(readFileSync(filepath, 'utf-8'));
    // Backdate to 8 days ago — past the weekly default
    raw.cachedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    writeFileSync(filepath, JSON.stringify(raw, null, 2));

    const cached = readCache(endpoint, params);
    expect(cached).toBeNull();
  });

  test('TTL constants have correct values', () => {
    expect(CACHE_TTL_WEEKLY).toBe(7 * 24 * 60 * 60 * 1000);
    expect(CACHE_TTL_MONTHLY).toBe(30 * 24 * 60 * 60 * 1000);
    expect(CACHE_TTL_QUARTERLY).toBe(90 * 24 * 60 * 60 * 1000);
  });
});
