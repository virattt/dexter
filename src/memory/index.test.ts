/**
 * Tests for financial context auto-load at startup.
 *
 * Covers:
 *  - MemoryStore.loadSessionContext includes FINANCE.md as a candidate
 *  - MemoryManager.loadSessionContext appends Recent Financial Context section
 *    from SQL insights and respects the token budget
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MemoryStore } from './store.js';
import { MemoryDatabase } from './database.js';

// ---------------------------------------------------------------------------
// MemoryStore — FINANCE.md auto-load
// ---------------------------------------------------------------------------

describe('MemoryStore.loadSessionContext — FINANCE.md', () => {
  let baseDir: string;
  let memDir: string;
  let store: MemoryStore;

  beforeEach(async () => {
    baseDir = join(tmpdir(), `dexter-store-test-${Date.now()}`);
    memDir = join(baseDir, 'memory');
    await mkdir(memDir, { recursive: true });
    store = new MemoryStore(baseDir);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('loads FINANCE.md when present', async () => {
    await writeFile(join(memDir, 'FINANCE.md'), '## Ticker Routing\n- VWS.CO: FMP premium-only, use web_search');
    const ctx = await store.loadSessionContext(10_000);
    expect(ctx.filesLoaded).toContain('FINANCE.md');
    expect(ctx.text).toContain('VWS.CO');
  });

  it('loads FINANCE.md alongside MEMORY.md when both exist', async () => {
    await writeFile(join(memDir, 'MEMORY.md'), 'User prefers low-risk investments.');
    await writeFile(join(memDir, 'FINANCE.md'), '## Routing\n- AAPL: FMP ok');
    const ctx = await store.loadSessionContext(10_000);
    expect(ctx.filesLoaded).toContain('MEMORY.md');
    expect(ctx.filesLoaded).toContain('FINANCE.md');
    expect(ctx.text).toContain('low-risk');
    expect(ctx.text).toContain('AAPL');
  });

  it('does not throw when FINANCE.md is absent', async () => {
    // No FINANCE.md written — just ensure no error and file not in list
    const ctx = await store.loadSessionContext(10_000);
    expect(ctx.filesLoaded).not.toContain('FINANCE.md');
  });

  it('skips FINANCE.md when budget is too tight for any file', async () => {
    // Both files are larger than the minimal budget
    const bigContent = 'x'.repeat(3000); // ~750 tokens
    await writeFile(join(memDir, 'MEMORY.md'), bigContent);
    await writeFile(join(memDir, 'FINANCE.md'), bigContent);
    // Budget too small for either file
    const ctx = await store.loadSessionContext(10);
    expect(ctx.filesLoaded).not.toContain('MEMORY.md');
    expect(ctx.filesLoaded).not.toContain('FINANCE.md');
    expect(ctx.tokenEstimate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MemoryDatabase.loadRecentInsights — used by MemoryManager for auto-load
// ---------------------------------------------------------------------------

describe('MemoryDatabase.loadRecentInsights', () => {
  let dbPath: string;
  let db: MemoryDatabase;

  beforeEach(async () => {
    dbPath = join(tmpdir(), `dexter-db-test-${Date.now()}.sqlite`);
    db = await MemoryDatabase.create(dbPath);
  });

  afterEach(async () => {
    db.close();
    await rm(dbPath, { force: true });
  });

  it('returns an empty array when no insights exist', () => {
    const rows = db.loadRecentInsights(10);
    expect(rows).toEqual([]);
  });

  it('returns inserted insights ordered by updated_at desc', () => {
    db.upsertInsight({ ticker: 'AAPL', tags: '[]', content: 'Apple insight', contentHash: 'h1' });
    db.upsertInsight({ ticker: 'MSFT', tags: '[]', content: 'Microsoft insight', contentHash: 'h2' });
    const rows = db.loadRecentInsights(10);
    expect(rows.length).toBe(2);
    // Newest upsert (MSFT) should come first
    expect(rows[0].ticker).toBe('MSFT');
    expect(rows[1].ticker).toBe('AAPL');
  });

  it('respects the limit parameter', () => {
    for (let i = 0; i < 15; i++) {
      db.upsertInsight({ ticker: `T${i}`, tags: '[]', content: `insight ${i}`, contentHash: `h${i}` });
    }
    const rows = db.loadRecentInsights(5);
    expect(rows.length).toBe(5);
  });

  it('exposes ticker and content fields', () => {
    db.upsertInsight({ ticker: 'VWS.CO', tags: '["routing:fmp-premium"]', content: 'Vestas premium-only', contentHash: 'vh1', routing: 'fmp-premium' });
    const rows = db.loadRecentInsights(1);
    expect(rows[0].ticker).toBe('VWS.CO');
    expect(rows[0].content).toBe('Vestas premium-only');
    expect(rows[0].routing).toBe('fmp-premium');
  });
});
