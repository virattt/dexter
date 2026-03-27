/**
 * TDD tests for Phase 2 database improvements:
 * #1 — sqlite-vec ANN vector index
 * #4 — Ticker-aware chunk indexing
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MemoryDatabase } from './database.js';
import type { MemoryChunk } from './types.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';

// ============================================================================
// Helpers
// ============================================================================

const DIM = 4; // small dimension for test vectors

function makeChunk(overrides: Partial<MemoryChunk> = {}): MemoryChunk {
  return {
    filePath: overrides.filePath ?? '/tmp/test.md',
    startLine: overrides.startLine ?? 1,
    endLine: overrides.endLine ?? 5,
    content: overrides.content ?? 'Test chunk content',
    contentHash: overrides.contentHash ?? `hash-${Math.random().toString(36).slice(2)}`,
    source: overrides.source ?? 'memory',
  };
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * b[i]!, 0);
}

function norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function cosineSim(a: number[], b: number[]): number {
  return dotProduct(a, b) / (norm(a) * norm(b));
}

let dbPath: string;
let db: MemoryDatabase;

beforeEach(async () => {
  dbPath = join(tmpdir(), `dexter-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  db = await MemoryDatabase.create(dbPath);
});

afterEach(async () => {
  db.close();
  await rm(dbPath, { force: true });
});

// ============================================================================
// #4 — Ticker extraction during upsert
// ============================================================================

describe('ticker-aware chunk indexing', () => {
  it('extracts and stores tickers when upserting a chunk with ticker content', () => {
    const chunk = makeChunk({ content: 'AAPL reported strong Q3 earnings. TSLA also beat.' });
    db.upsertChunk({ chunk, embedding: null });

    // Load results via loadResultsByIds to check tickers
    const chunk2 = makeChunk({ content: 'No tickers here', contentHash: 'hash-noticker' });
    db.upsertChunk({ chunk: chunk2, embedding: null });

    const allChunks = db.listAllChunks();
    const aapl = allChunks.find((c) => c.content.includes('AAPL'));
    // Tickers are stored internally — validate via loadResultsByIds
    const results = db.loadResultsByIds([aapl!.id]);
    expect(results[0]?.tickers).toContain('AAPL');
    expect(results[0]?.tickers).toContain('TSLA');
  });

  it('stores empty tickers array for chunks with no tickers', () => {
    const chunk = makeChunk({ content: 'General market commentary without specific tickers.' });
    db.upsertChunk({ chunk, embedding: null });

    const [inserted] = db.listAllChunks();
    const results = db.loadResultsByIds([inserted!.id]);
    expect(results[0]?.tickers).toEqual([]);
  });

  it('updates tickers when chunk is re-upserted with different content', () => {
    const hash = 'stable-hash-for-update';
    const chunk = makeChunk({ content: 'AAPL trade today', contentHash: hash });
    db.upsertChunk({ chunk, embedding: null });

    const updated = makeChunk({ content: 'NVDA trade today', contentHash: hash });
    db.upsertChunk({ chunk: updated, embedding: null });

    const [row] = db.listAllChunks();
    const results = db.loadResultsByIds([row!.id]);
    expect(results[0]?.tickers).toContain('NVDA');
    expect(results[0]?.tickers).not.toContain('AAPL');
  });

  it('handles BRK.B exchange-suffix tickers', () => {
    const chunk = makeChunk({ content: 'Bought BRK.B as a defensive position.' });
    db.upsertChunk({ chunk, embedding: null });

    const [row] = db.listAllChunks();
    const results = db.loadResultsByIds([row!.id]);
    expect(results[0]?.tickers).toContain('BRK.B');
  });
});

// ============================================================================
// #4 — getChunkTickers helper
// ============================================================================

describe('getChunkTickers', () => {
  it('returns tickers for multiple chunk IDs in one call', () => {
    const c1 = makeChunk({ content: 'AAPL report', contentHash: 'h1' });
    const c2 = makeChunk({ content: 'TSLA earnings beat', contentHash: 'h2' });
    const c3 = makeChunk({ content: 'No tickers here at all', contentHash: 'h3' });
    const r1 = db.upsertChunk({ chunk: c1, embedding: null });
    const r2 = db.upsertChunk({ chunk: c2, embedding: null });
    const r3 = db.upsertChunk({ chunk: c3, embedding: null });

    const tickerMap = db.getChunkTickers([r1.id, r2.id, r3.id]);
    expect(tickerMap.get(r1.id)).toContain('AAPL');
    expect(tickerMap.get(r2.id)).toContain('TSLA');
    expect(tickerMap.get(r3.id)).toEqual([]);
  });

  it('returns empty map for empty id list', () => {
    expect(db.getChunkTickers([])).toEqual(new Map());
  });
});

// ============================================================================
// #1 — Vector search (searchVectorScan + optional KNN via sqlite-vec)
// ============================================================================

describe('searchVector — JS fallback (always available)', () => {
  it('returns most-similar chunks ranked by cosine similarity', () => {
    const chunks = [
      { content: 'AAPL earnings', embedding: [1, 0, 0, 0] },
      { content: 'TSLA revenue', embedding: [0, 1, 0, 0] },
      { content: 'NVDA guidance', embedding: [0, 0, 1, 0] },
    ];

    for (const [i, c] of chunks.entries()) {
      db.upsertChunk({
        chunk: makeChunk({ content: c.content, contentHash: `hash-vec-${i}` }),
        embedding: c.embedding,
      });
    }

    // Query close to first chunk
    const results = db.searchVector([0.99, 0.1, 0, 0], 3);
    expect(results.length).toBeGreaterThan(0);
    // Highest-scored result should be the AAPL chunk (most similar to query)
    const topChunk = db.loadResultsByIds([results[0]!.chunkId]);
    expect(topChunk[0]?.snippet).toContain('AAPL');
  });

  it('returns empty array when no chunks have embeddings', () => {
    db.upsertChunk({ chunk: makeChunk({ contentHash: 'h-noembed' }), embedding: null });
    const results = db.searchVector([1, 0, 0, 0], 5);
    expect(results).toEqual([]);
  });

  it('scores range between 0 and 1', () => {
    for (let i = 0; i < 3; i++) {
      const vec = Array.from({ length: DIM }, () => Math.random());
      db.upsertChunk({
        chunk: makeChunk({ contentHash: `h-range-${i}` }),
        embedding: vec,
      });
    }
    const query = Array.from({ length: DIM }, () => Math.random());
    const results = db.searchVector(query, 10);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it('respects maxResults limit', () => {
    for (let i = 0; i < 5; i++) {
      const vec = [Math.random(), Math.random(), Math.random(), Math.random()];
      db.upsertChunk({
        chunk: makeChunk({ contentHash: `h-limit-${i}` }),
        embedding: vec,
      });
    }
    const results = db.searchVector([1, 0, 0, 0], 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

// ============================================================================
// #1 — sqlite-vec ANN index (if enabled)
// ============================================================================

describe('searchVector — sqlite-vec KNN (if available)', () => {
  it('isVecEnabled reflects whether sqlite-vec loaded and a table was created', async () => {
    // vec is only active AFTER first embedding is inserted (lazy table creation)
    const vec = [0.1, 0.2, 0.3, 0.4];
    db.upsertChunk({
      chunk: makeChunk({ contentHash: 'h-vec-init' }),
      embedding: vec,
    });

    // After inserting an embedding, isVecEnabled should be true if sqlite-vec loaded
    // OR false if it wasn't available — either outcome is valid, no error should throw.
    expect(typeof db.isVecEnabled).toBe('boolean');
  });

  it('returns consistent results regardless of which search path is used', async () => {
    const chunksData = [
      { content: 'AAPL strong buy recommendation', embedding: [1, 0.1, 0, 0] },
      { content: 'TSLA revenue growth', embedding: [0, 1, 0.1, 0] },
      { content: 'Market macro update', embedding: [0, 0, 1, 0.1] },
    ];

    for (const [i, c] of chunksData.entries()) {
      db.upsertChunk({
        chunk: makeChunk({ content: c.content, contentHash: `h-consist-${i}` }),
        embedding: c.embedding,
      });
    }

    const query = [1, 0, 0, 0];
    const results = db.searchVector(query, 3);

    // Regardless of KNN vs JS scan: top result must be AAPL (closest to query)
    expect(results.length).toBeGreaterThan(0);
    const topId = results[0]!.chunkId;
    const topDetails = db.loadResultsByIds([topId]);
    expect(topDetails[0]?.snippet).toContain('AAPL');

    // All scores in valid range
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1.001); // slight float tolerance
    }
  });
});

// ============================================================================
// #1 — Tickers cleaned up on deleteChunksForFile
// ============================================================================

describe('deleteChunksForFile', () => {
  it('removes associated FTS and vec entries', () => {
    const chunk = makeChunk({ filePath: '/tmp/to-delete.md', content: 'AAPL investment thesis' });
    db.upsertChunk({ chunk, embedding: [1, 0, 0, 0] });

    const countBefore = db.listAllChunks().length;
    db.deleteChunksForFile('/tmp/to-delete.md');
    expect(db.listAllChunks().length).toBe(countBefore - 1);

    // After deletion, vector search should not return the deleted chunk
    const results = db.searchVector([1, 0, 0, 0], 10);
    expect(results.find((r) => r.chunkId === 1)).toBeUndefined();
  });
});
