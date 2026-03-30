import { describe, test, expect } from 'bun:test';
import {
  tokenize,
  jaccardSimilarity,
  applyMMRToHybridResults,
  DEFAULT_MMR_CONFIG,
} from './mmr.js';
import type { MemorySearchResult } from './types.js';

function makeResult(overrides: Partial<MemorySearchResult> & { path: string }): MemorySearchResult {
  return {
    snippet: overrides.snippet ?? 'default snippet',
    path: overrides.path,
    startLine: overrides.startLine ?? 1,
    endLine: overrides.endLine ?? 5,
    score: overrides.score ?? 1.0,
    source: 'vector',
    ...overrides,
  };
}

describe('DEFAULT_MMR_CONFIG', () => {
  test('is enabled with lambda between 0 and 1', () => {
    expect(DEFAULT_MMR_CONFIG.enabled).toBe(true);
    expect(DEFAULT_MMR_CONFIG.lambda).toBeGreaterThan(0);
    expect(DEFAULT_MMR_CONFIG.lambda).toBeLessThan(1);
  });
});

describe('tokenize', () => {
  test('extracts lowercase alphanumeric tokens', () => {
    const tokens = tokenize('Hello World');
    expect(tokens.has('hello')).toBe(true);
    expect(tokens.has('world')).toBe(true);
  });

  test('returns empty set for empty string', () => {
    expect(tokenize('').size).toBe(0);
  });

  test('returns empty set for punctuation-only string', () => {
    expect(tokenize('... !!! ???').size).toBe(0);
  });

  test('handles underscores as word characters', () => {
    const tokens = tokenize('foo_bar');
    expect(tokens.has('foo_bar')).toBe(true);
  });

  test('deduplicates repeated tokens', () => {
    const tokens = tokenize('apple apple apple');
    expect(tokens.size).toBe(1);
  });

  test('handles numbers', () => {
    const tokens = tokenize('AAPL stock 2024');
    expect(tokens.has('aapl')).toBe(true);
    expect(tokens.has('stock')).toBe(true);
    expect(tokens.has('2024')).toBe(true);
  });
});

describe('jaccardSimilarity', () => {
  test('returns 1 for identical non-empty sets', () => {
    const a = new Set(['apple', 'banana']);
    const b = new Set(['apple', 'banana']);
    expect(jaccardSimilarity(a, b)).toBe(1);
  });

  test('returns 0 for completely disjoint sets', () => {
    const a = new Set(['apple']);
    const b = new Set(['banana']);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  test('returns 1 for two empty sets', () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
  });

  test('returns 0 when one set is empty and the other is not', () => {
    expect(jaccardSimilarity(new Set(['a']), new Set())).toBe(0);
    expect(jaccardSimilarity(new Set(), new Set(['a']))).toBe(0);
  });

  test('returns 0.5 for half-overlapping sets', () => {
    const a = new Set(['a', 'b']);
    const b = new Set(['b', 'c']);
    // intersection = {b}, union = {a,b,c} → 1/3 is wrong...
    // Actually: intersection={b}(1), union={a,b,c}(3) → 1/3
    expect(jaccardSimilarity(a, b)).toBeCloseTo(1 / 3, 5);
  });

  test('returns correct value for partially overlapping sets', () => {
    const a = new Set(['x', 'y', 'z']);
    const b = new Set(['y', 'z', 'w']);
    // intersection={y,z}(2), union={x,y,z,w}(4) → 0.5
    expect(jaccardSimilarity(a, b)).toBeCloseTo(0.5, 5);
  });
});

describe('applyMMRToHybridResults', () => {
  test('returns empty array for empty input', () => {
    expect(applyMMRToHybridResults([])).toEqual([]);
  });

  test('returns single result unchanged', () => {
    const result = makeResult({ path: 'a.md', score: 0.9, snippet: 'about AAPL revenue' });
    const out = applyMMRToHybridResults([result]);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe('a.md');
  });

  test('returns all results when disabled', () => {
    const results = [
      makeResult({ path: 'a.md', score: 0.9, snippet: 'apple stock' }),
      makeResult({ path: 'b.md', score: 0.8, snippet: 'apple earnings' }),
    ];
    const out = applyMMRToHybridResults(results, { enabled: false });
    expect(out).toHaveLength(2);
  });

  test('preserves all results when diversity improves ordering', () => {
    const results = [
      makeResult({ path: 'a.md', score: 0.9, snippet: 'AAPL revenue growth earnings' }),
      makeResult({ path: 'b.md', score: 0.85, snippet: 'AAPL revenue growth earnings' }), // near-duplicate
      makeResult({ path: 'c.md', score: 0.8, snippet: 'TSLA stock price bitcoin' }), // diverse
    ];
    const out = applyMMRToHybridResults(results, { enabled: true, lambda: 0.5 });
    expect(out).toHaveLength(3);
    // First result should still be highest relevance
    expect(out[0].path).toBe('a.md');
  });

  test('with lambda=1 behaves like pure relevance sort', () => {
    const results = [
      makeResult({ path: 'a.md', score: 0.5, snippet: 'low score' }),
      makeResult({ path: 'b.md', score: 0.9, snippet: 'high score' }),
      makeResult({ path: 'c.md', score: 0.7, snippet: 'medium score' }),
    ];
    const out = applyMMRToHybridResults(results, { enabled: true, lambda: 1 });
    expect(out[0].path).toBe('b.md');
    expect(out[1].path).toBe('c.md');
    expect(out[2].path).toBe('a.md');
  });

  test('promotes diverse results when lambda < 0.5', () => {
    // With very low lambda (diversity-heavy), duplicate content should be penalized
    const results = [
      makeResult({ path: 'dup1.md', score: 0.9, snippet: 'stock price earnings revenue quarterly annual' }),
      makeResult({ path: 'dup2.md', score: 0.88, snippet: 'stock price earnings revenue quarterly annual' }), // near-duplicate
      makeResult({ path: 'diff.md', score: 0.7, snippet: 'bitcoin ethereum crypto defi blockchain nft' }), // very different
    ];
    const out = applyMMRToHybridResults(results, { enabled: true, lambda: 0.1 });
    expect(out).toHaveLength(3);
    // 'diff.md' should be promoted above 'dup2.md'
    const diffIdx = out.findIndex((r) => r.path === 'diff.md');
    const dup2Idx = out.findIndex((r) => r.path === 'dup2.md');
    expect(diffIdx).toBeLessThan(dup2Idx);
  });

  test('does not mutate original result scores', () => {
    const results = [
      makeResult({ path: 'a.md', score: 0.9, snippet: 'apple' }),
      makeResult({ path: 'b.md', score: 0.8, snippet: 'apple' }),
    ];
    applyMMRToHybridResults(results);
    expect(results[0].score).toBe(0.9);
    expect(results[1].score).toBe(0.8);
  });
});
