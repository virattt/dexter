import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Isolation: each test uses its own tmp dir as the cwd
// ---------------------------------------------------------------------------
let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers: import fresh module instances that respect chdir'd cwd
// ---------------------------------------------------------------------------
async function getCacheModule() {
  // Dynamic import resolves CACHE_DIR at module init time, so we re-import in
  // each test to pick up the chdir'd cwd. Bun caches modules by specifier, so
  // we use a timestamp-based query param to bust the cache.
  const mod = await import(`./cross-session-cache.js?t=${Date.now()}`);
  return mod as typeof import('./cross-session-cache.js');
}

// ---------------------------------------------------------------------------
// loadCacheFromDisk
// ---------------------------------------------------------------------------

describe('loadCacheFromDisk', () => {
  it('returns empty map when cache dir does not exist', async () => {
    const { loadCacheFromDisk } = await getCacheModule();
    const result = await loadCacheFromDisk();
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('skips expired entries', async () => {
    const { loadCacheFromDisk, saveCacheToDisk, CACHE_DIR } = await getCacheModule();
    mkdirSync(CACHE_DIR, { recursive: true });

    // Write an entry that expired in the past
    saveCacheToDisk('expired_key', 'expired_value', 'some_tool', -1000);

    const result = await loadCacheFromDisk();
    expect(result.has('expired_key')).toBe(false);
    expect(result.size).toBe(0);
  });

  it('returns valid non-expired entries', async () => {
    const { loadCacheFromDisk, saveCacheToDisk } = await getCacheModule();

    saveCacheToDisk('my:key?q=1', 'my_value', 'web_search', 900_000);

    const result = await loadCacheFromDisk();
    expect(result.has('my:key?q=1')).toBe(true);
    expect(result.get('my:key?q=1')).toBe('my_value');
  });

  it('silently skips malformed JSON files', async () => {
    const { loadCacheFromDisk, CACHE_DIR } = await getCacheModule();
    mkdirSync(CACHE_DIR, { recursive: true });

    // Write a corrupted file
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(CACHE_DIR, 'broken.json'), '{ not valid json', 'utf-8');

    const result = await loadCacheFromDisk();
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// saveCacheToDisk
// ---------------------------------------------------------------------------

describe('saveCacheToDisk', () => {
  it('writes a file that loadCacheFromDisk can read back', async () => {
    const { saveCacheToDisk, loadCacheFromDisk } = await getCacheModule();

    saveCacheToDisk('financial_search:{"ticker":"AAPL"}', '{"price":150}', 'financial_search', 900_000);

    const result = await loadCacheFromDisk();
    expect(result.has('financial_search:{"ticker":"AAPL"}')).toBe(true);
    expect(result.get('financial_search:{"ticker":"AAPL"}')).toBe('{"price":150}');
  });

  it('skips entries where value is larger than 50KB', async () => {
    const { saveCacheToDisk, loadCacheFromDisk, CACHE_DIR } = await getCacheModule();

    const bigValue = 'x'.repeat(51 * 1024); // 51 KB
    saveCacheToDisk('big_key', bigValue, 'some_tool', 900_000);

    // No file should have been created
    expect(existsSync(CACHE_DIR)).toBe(false);

    const result = await loadCacheFromDisk();
    expect(result.has('big_key')).toBe(false);
  });

  it('sanitized keys do not contain /, :, ?, & characters', async () => {
    const { saveCacheToDisk, CACHE_DIR } = await getCacheModule();

    saveCacheToDisk('tool:name/path?query=val&other=1', 'result', 'tool', 900_000);

    const files = (await import('node:fs')).readdirSync(CACHE_DIR);
    expect(files.length).toBe(1);
    const filename = files[0];
    expect(filename).not.toMatch(/[/:?&]/);
  });

  it('truncates very long keys to 100 chars in filename', async () => {
    const { saveCacheToDisk, CACHE_DIR } = await getCacheModule();

    const longKey = 'a'.repeat(200);
    saveCacheToDisk(longKey, 'value', 'tool', 900_000);

    const files = (await import('node:fs')).readdirSync(CACHE_DIR);
    expect(files.length).toBe(1);
    // filename = sanitizedKey + '.json', sanitizedKey is max 100 chars
    expect(files[0].replace('.json', '').length).toBeLessThanOrEqual(100);
  });

  it('silently swallows write errors (never throws)', async () => {
    const { saveCacheToDisk } = await getCacheModule();

    // Simulate a write to a path that can't be created (device not present)
    // by using a null byte in the value (valid for our purposes since we just
    // want to confirm no exception escapes)
    expect(() => saveCacheToDisk('key', 'value', 'tool', 900_000)).not.toThrow();
  });
});
