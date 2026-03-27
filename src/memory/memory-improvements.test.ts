/**
 * Phase 1 memory improvement tests:
 *  - #2  BM25 keyword scoring — scores in [0,1], best match wins
 *  - #3  Financial synonym expansion (see financial-synonyms.test.ts)
 *  - #9  Search explanation field populated on results
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { MemoryDatabase } from './database.js';
import { hybridSearch } from './search.js';

function h(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// ---------------------------------------------------------------------------
// #2 — BM25 keyword scoring: normalised to [0, 1]
// ---------------------------------------------------------------------------

describe('searchKeyword — BM25 normalised scoring', () => {
  let db: MemoryDatabase;
  let tmpPath: string;

  beforeEach(async () => {
    tmpPath = join(tmpdir(), `dexter-bm25-test-${Date.now()}.sqlite`);
    db = await MemoryDatabase.create(tmpPath);

    const chunks = [
      // Highly relevant: contains both query terms multiple times → highest BM25
      'AAPL stock price analysis: AAPL P/E ratio is 28, AAPL price target raised to $220',
      // Moderately relevant: one mention each
      'AAPL price chart shows strong resistance at the 50-day moving average',
      // Irrelevant: no query terms
      'Interest rates and Federal Reserve monetary policy decisions for 2024',
    ];

    for (const [i, content] of chunks.entries()) {
      db.upsertChunk({
        chunk: { filePath: 'test.md', startLine: i + 1, endLine: i + 1, content, contentHash: h(content) },
        embedding: null,
        source: 'memory',
      });
    }
  });

  afterEach(async () => {
    db.close();
    await rm(tmpPath, { force: true });
  });

  it('all scores are in [0, 1]', () => {
    const results = db.searchKeyword('AAPL price', 10);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it('results are ordered best-first (highest score first)', () => {
    const results = db.searchKeyword('AAPL price', 10);
    expect(results.length).toBeGreaterThan(1);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });

  it('best match (most term occurrences) gets highest score', () => {
    const results = db.searchKeyword('AAPL', 10);
    // First chunk mentions AAPL three times — should score highest
    const best = results[0];
    expect(best).toBeDefined();
    expect(best!.score).toBeCloseTo(1, 2);
  });

  it('returns empty array for empty query', () => {
    expect(db.searchKeyword('', 10)).toHaveLength(0);
  });

  it('single result gets score 1', () => {
    // Only the third chunk contains "Federal Reserve" — unique match
    const results = db.searchKeyword('Federal Reserve monetary', 10);
    expect(results).toHaveLength(1);
    expect(results[0]!.score).toBeCloseTo(1, 2);
  });
});

// ---------------------------------------------------------------------------
// #3 — Synonym expansion via searchKeyword
// ---------------------------------------------------------------------------

describe('searchKeyword — financial synonym expansion', () => {
  let db: MemoryDatabase;
  let tmpPath: string;

  beforeEach(async () => {
    tmpPath = join(tmpdir(), `dexter-syn-test-${Date.now()}.sqlite`);
    db = await MemoryDatabase.create(tmpPath);

    const chunks = [
      // Uses full phrase instead of abbreviation
      'AAPL price to earnings ratio is compelling at current levels',
      // Uses abbreviation — synonym expansion should bridge the gap
      'TSLA free cash flow improved dramatically in Q3',
      // Irrelevant
      'Weather forecast for tomorrow is sunny with light clouds',
    ];

    for (const [i, content] of chunks.entries()) {
      db.upsertChunk({
        chunk: { filePath: 'test.md', startLine: i + 1, endLine: i + 1, content, contentHash: h(content) },
        embedding: null,
        source: 'memory',
      });
    }
  });

  afterEach(async () => {
    db.close();
    await rm(tmpPath, { force: true });
  });

  it('query "P/E" finds document containing "price to earnings"', () => {
    const results = db.searchKeyword('P/E', 10);
    expect(results.length).toBeGreaterThan(0);
    // Should find AAPL chunk via synonym expansion
    const ids = results.map((r) => r.chunkId);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('query "FCF" finds document containing "free cash flow"', () => {
    const results = db.searchKeyword('FCF', 10);
    expect(results.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// #9 — Search explanation field
// ---------------------------------------------------------------------------

describe('hybridSearch — explanation field', () => {
  let db: MemoryDatabase;
  let tmpPath: string;

  beforeEach(async () => {
    tmpPath = join(tmpdir(), `dexter-explain-test-${Date.now()}.sqlite`);
    db = await MemoryDatabase.create(tmpPath);

    const content = 'NVDA GPU sales revenue record earnings growth semiconductor';
    db.upsertChunk({
      chunk: { filePath: 'memory.md', startLine: 1, endLine: 1, content, contentHash: h(content) },
      embedding: null,
      source: 'memory',
    });
  });

  afterEach(async () => {
    db.close();
    await rm(tmpPath, { force: true });
  });

  it('every search result has an explanation string', async () => {
    const results = await hybridSearch({
      db,
      embeddingClient: null,
      query: 'NVDA earnings',
      defaults: { maxResults: 5, minScore: 0, vectorWeight: 0.7, textWeight: 0.3 },
    });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.explanation).toBeDefined();
      expect(typeof r.explanation).toBe('string');
      expect(r.explanation!.length).toBeGreaterThan(0);
    }
  });

  it('explanation contains vector and keyword score components', async () => {
    const results = await hybridSearch({
      db,
      embeddingClient: null,
      query: 'NVDA earnings',
      defaults: { maxResults: 5, minScore: 0, vectorWeight: 0.7, textWeight: 0.3 },
    });
    expect(results.length).toBeGreaterThan(0);
    const explanation = results[0]!.explanation!;
    expect(explanation).toMatch(/v=[\d.]+/);
    expect(explanation).toMatch(/k=[\d.]+/);
  });

  it('explanation includes source label', async () => {
    const results = await hybridSearch({
      db,
      embeddingClient: null,
      query: 'NVDA earnings',
      defaults: { maxResults: 5, minScore: 0, vectorWeight: 0.7, textWeight: 0.3 },
    });
    const explanation = results[0]!.explanation!;
    // keyword-only result (no embedding client) should say "keyword"
    expect(explanation).toMatch(/keyword|vector|both/);
  });
});
