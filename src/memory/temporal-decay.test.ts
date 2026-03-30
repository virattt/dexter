import { describe, test, expect } from 'bun:test';
import {
  toDecayLambda,
  calculateTemporalDecayMultiplier,
  applyTemporalDecay,
  DEFAULT_TEMPORAL_DECAY,
} from './temporal-decay.js';
import type { MemorySearchResult } from './types.js';

function makeResult(overrides: Partial<MemorySearchResult> = {}): MemorySearchResult {
  return {
    snippet: 'test snippet',
    path: 'sessions/2024-01-01-session.md',
    startLine: 1,
    endLine: 5,
    score: 1.0,
    source: 'vector',
    ...overrides,
  };
}

describe('DEFAULT_TEMPORAL_DECAY', () => {
  test('is enabled with positive halfLifeDays', () => {
    expect(DEFAULT_TEMPORAL_DECAY.enabled).toBe(true);
    expect(DEFAULT_TEMPORAL_DECAY.halfLifeDays).toBeGreaterThan(0);
  });
});

describe('toDecayLambda', () => {
  test('returns ln(2) / halfLifeDays for valid input', () => {
    const lambda = toDecayLambda(30);
    expect(lambda).toBeCloseTo(Math.LN2 / 30, 10);
  });

  test('returns 0 for halfLifeDays = 0', () => {
    expect(toDecayLambda(0)).toBe(0);
  });

  test('returns 0 for negative halfLifeDays', () => {
    expect(toDecayLambda(-5)).toBe(0);
  });

  test('returns 0 for Infinity', () => {
    expect(toDecayLambda(Infinity)).toBe(0);
  });

  test('returns 0 for NaN', () => {
    expect(toDecayLambda(NaN)).toBe(0);
  });
});

describe('calculateTemporalDecayMultiplier', () => {
  test('returns 1.0 for age = 0', () => {
    const m = calculateTemporalDecayMultiplier({ ageInDays: 0, halfLifeDays: 30 });
    expect(m).toBeCloseTo(1.0, 10);
  });

  test('returns ~0.5 after exactly one half-life', () => {
    const m = calculateTemporalDecayMultiplier({ ageInDays: 30, halfLifeDays: 30 });
    expect(m).toBeCloseTo(0.5, 5);
  });

  test('returns ~0.25 after two half-lives', () => {
    const m = calculateTemporalDecayMultiplier({ ageInDays: 60, halfLifeDays: 30 });
    expect(m).toBeCloseTo(0.25, 5);
  });

  test('returns 1 when lambda = 0 (invalid halfLifeDays)', () => {
    const m = calculateTemporalDecayMultiplier({ ageInDays: 100, halfLifeDays: 0 });
    expect(m).toBe(1);
  });

  test('clamps negative ages to 0', () => {
    const m = calculateTemporalDecayMultiplier({ ageInDays: -10, halfLifeDays: 30 });
    expect(m).toBeCloseTo(1.0, 10);
  });

  test('returns 1 for non-finite ageInDays', () => {
    const m = calculateTemporalDecayMultiplier({ ageInDays: Infinity, halfLifeDays: 30 });
    expect(m).toBe(1);
  });
});

describe('applyTemporalDecay', () => {
  const nowMs = new Date('2024-06-01T00:00:00Z').getTime();

  test('returns original results unchanged when disabled', () => {
    const results = [makeResult({ score: 0.9 })];
    const out = applyTemporalDecay({
      results,
      config: { enabled: false, halfLifeDays: 30 },
      nowMs,
    });
    expect(out).toEqual(results);
  });

  test('does not modify evergreen MEMORY.md files (no updatedAt, non-dated path)', () => {
    const result = makeResult({ path: 'MEMORY.md', score: 0.8 });
    const out = applyTemporalDecay({
      results: [result],
      config: { enabled: true, halfLifeDays: 30 },
      nowMs,
    });
    expect(out[0].score).toBe(0.8);
  });

  test('does not decay non-dated topic file paths', () => {
    const result = makeResult({ path: 'investing-strategy.md', score: 0.7 });
    const out = applyTemporalDecay({
      results: [result],
      config: { enabled: true, halfLifeDays: 30 },
      nowMs,
    });
    expect(out[0].score).toBe(0.7);
  });

  test('decays dated file paths (YYYY-MM-DD.md)', () => {
    // 30 days before nowMs → expect ~50% score
    const date = new Date('2024-05-02T00:00:00Z'); // ~30 days before June 1
    const result = makeResult({ path: `${date.toISOString().slice(0, 10)}.md`, score: 1.0 });
    const out = applyTemporalDecay({
      results: [result],
      config: { enabled: true, halfLifeDays: 30 },
      nowMs,
    });
    expect(out[0].score).toBeCloseTo(0.5, 1);
  });

  test('decays session chunks using updatedAt', () => {
    const thirtyDaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;
    const result = makeResult({
      path: 'sessions/abc.md',
      score: 1.0,
      updatedAt: thirtyDaysAgo,
    });
    const out = applyTemporalDecay({
      results: [result],
      config: { enabled: true, halfLifeDays: 30 },
      nowMs,
    });
    expect(out[0].score).toBeCloseTo(0.5, 1);
  });

  test('session chunk with no updatedAt is not decayed', () => {
    const result = makeResult({ path: 'sessions/nosession.md', score: 0.9, updatedAt: undefined });
    const out = applyTemporalDecay({
      results: [result],
      config: { enabled: true, halfLifeDays: 30 },
      nowMs,
    });
    expect(out[0].score).toBe(0.9);
  });

  test('uses Date.now() when nowMs is not provided', () => {
    const recentDateStr = new Date().toISOString().slice(0, 10);
    const result = makeResult({ path: `${recentDateStr}.md`, score: 1.0 });
    const out = applyTemporalDecay({
      results: [result],
      config: { enabled: true, halfLifeDays: 30 },
    });
    // Very recent file (today) — score should be near 1.0 (at most ~1 day old)
    expect(out[0].score).toBeGreaterThan(0.97);
  });

  test('handles empty results array', () => {
    const out = applyTemporalDecay({
      results: [],
      config: { enabled: true, halfLifeDays: 30 },
      nowMs,
    });
    expect(out).toEqual([]);
  });

  test('does not mutate original results', () => {
    const result = makeResult({ path: '2024-01-01.md', score: 1.0 });
    applyTemporalDecay({
      results: [result],
      config: { enabled: true, halfLifeDays: 30 },
      nowMs,
    });
    expect(result.score).toBe(1.0);
  });
});
