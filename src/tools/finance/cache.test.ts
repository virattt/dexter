import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { isCacheable, buildCacheKey, readCache, writeCache } from './cache.js';

const TEST_CACHE_DIR = '.dexter/cache';

/** Helper: yesterday's date as YYYY-MM-DD */
function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Helper: today's date as YYYY-MM-DD */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Helper: tomorrow's date as YYYY-MM-DD */
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// isCacheable
// ---------------------------------------------------------------------------

describe('isCacheable', () => {
  test('returns true for /prices/ with end_date in the past', () => {
    expect(isCacheable('/prices/', { ticker: 'AAPL', start_date: '2024-01-01', end_date: yesterday() })).toBe(true);
  });

  test('returns true for /crypto/prices/ with end_date in the past', () => {
    expect(isCacheable('/crypto/prices/', { ticker: 'BTC-USD', start_date: '2024-01-01', end_date: '2024-12-31' })).toBe(true);
  });

  test('returns false for /prices/ with end_date = today', () => {
    expect(isCacheable('/prices/', { ticker: 'AAPL', start_date: '2024-01-01', end_date: today() })).toBe(false);
  });

  test('returns false for /prices/ with end_date in the future', () => {
    expect(isCacheable('/prices/', { ticker: 'AAPL', start_date: '2024-01-01', end_date: tomorrow() })).toBe(false);
  });

  test('returns false for /prices/ without end_date', () => {
    expect(isCacheable('/prices/', { ticker: 'AAPL', start_date: '2024-01-01' })).toBe(false);
  });

  test('returns false for non-price endpoints', () => {
    expect(isCacheable('/financials/income-statements/', { ticker: 'AAPL', period: 'annual', limit: 4 })).toBe(false);
    expect(isCacheable('/prices/snapshot/', { ticker: 'AAPL' })).toBe(false);
    expect(isCacheable('/news/', { ticker: 'AAPL' })).toBe(false);
    expect(isCacheable('/financial-metrics/', { ticker: 'AAPL', period: 'annual' })).toBe(false);
    expect(isCacheable('/insider-trades/', { ticker: 'AAPL' })).toBe(false);
    expect(isCacheable('/filings/', { ticker: 'AAPL' })).toBe(false);
    expect(isCacheable('/analyst-estimates/', { ticker: 'AAPL' })).toBe(false);
    expect(isCacheable('/company/facts', { ticker: 'AAPL' })).toBe(false);
  });

  test('returns false for /crypto/prices/snapshot/ (not an exact match)', () => {
    expect(isCacheable('/crypto/prices/snapshot/', { ticker: 'BTC-USD' })).toBe(false);
  });
});

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
    // Clean up test cache dir before each test
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true });
    }
  });

  test('round-trips data for a cacheable request', () => {
    const endpoint = '/prices/';
    const params = { ticker: 'AAPL', start_date: '2024-01-01', end_date: yesterday(), interval: 'day', interval_multiplier: 1 };
    const data = { prices: [{ open: 100, close: 105, high: 106, low: 99 }] };
    const url = 'https://api.financialdatasets.ai/prices/?ticker=AAPL&start_date=2024-01-01&end_date=2024-12-31';

    writeCache(endpoint, params, data, url);
    const cached = readCache(endpoint, params);

    expect(cached).not.toBeNull();
    expect(cached!.data).toEqual(data);
    expect(cached!.url).toBe(url);
  });

  test('returns null for non-cacheable endpoint even after writeCache', () => {
    const endpoint = '/financials/income-statements/';
    const params = { ticker: 'AAPL', period: 'annual', limit: 4 };
    const data = { income_statements: [] };
    const url = 'https://api.financialdatasets.ai/financials/income-statements/?ticker=AAPL';

    writeCache(endpoint, params, data, url);
    const cached = readCache(endpoint, params);

    expect(cached).toBeNull();
  });

  test('returns null for prices with end_date = today', () => {
    const endpoint = '/prices/';
    const params = { ticker: 'AAPL', start_date: '2024-01-01', end_date: today() };
    const data = { prices: [] };
    const url = 'https://example.com';

    writeCache(endpoint, params, data, url);
    const cached = readCache(endpoint, params);

    expect(cached).toBeNull();
  });

  test('returns null on cache miss (no file)', () => {
    const cached = readCache('/prices/', { ticker: 'AAPL', start_date: '2024-01-01', end_date: yesterday() });
    expect(cached).toBeNull();
  });

  test('returns null and removes file when cache entry is corrupted JSON', () => {
    const endpoint = '/prices/';
    const params = { ticker: 'AAPL', start_date: '2024-01-01', end_date: yesterday(), interval: 'day', interval_multiplier: 1 };

    // Write a corrupted file directly
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
    const params = { ticker: 'AAPL', start_date: '2024-01-01', end_date: yesterday(), interval: 'day', interval_multiplier: 1 };

    // Write a valid JSON file with wrong shape
    const key = buildCacheKey(endpoint, params);
    const filepath = join(TEST_CACHE_DIR, key);
    const dir = join(TEST_CACHE_DIR, key.split('/')[0]!);
    mkdirSync(dir, { recursive: true });
    writeFileSync(filepath, JSON.stringify({ wrong: 'shape' }));

    const cached = readCache(endpoint, params);
    expect(cached).toBeNull();
    expect(existsSync(filepath)).toBe(false);
  });
});
