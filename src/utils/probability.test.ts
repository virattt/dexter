import { describe, it, expect } from 'bun:test';
import { combineLogOdds, normaliseWeights, formatProbabilityTable } from './probability.js';
import type { LogOddsSignal } from './probability.js';

// ---------------------------------------------------------------------------
// combineLogOdds
// ---------------------------------------------------------------------------

describe('combineLogOdds', () => {
  it('single signal: returns the clamped probability unchanged', () => {
    const signals: LogOddsSignal[] = [
      { name: 'Fed cut', probability: 0.65, weight: 1, category: 'macro_rates' },
    ];
    const result = combineLogOdds(signals);
    expect(result.probability).toBeCloseTo(0.65, 3);
    expect(result.divergence).toBe(false);
  });

  it('two identical signals: returns that probability', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.70, weight: 0.5, category: 'x' },
      { name: 'B', probability: 0.70, weight: 0.5, category: 'y' },
    ];
    expect(combineLogOdds(signals).probability).toBeCloseTo(0.70, 3);
  });

  it('two signals at 40% and 60% (equal weight) → combined ≈ 50%', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.4, weight: 1, category: 'x' },
      { name: 'B', probability: 0.6, weight: 1, category: 'y' },
    ];
    // log-odds(0.4) = −0.405, log-odds(0.6) = +0.405 → sum = 0 → p = 0.5
    expect(combineLogOdds(signals).probability).toBeCloseTo(0.5, 2);
  });

  it('higher-weight signal pulls the combined result toward its probability', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.3, weight: 0.3, category: 'x' },
      { name: 'B', probability: 0.8, weight: 0.7, category: 'y' },
    ];
    const result = combineLogOdds(signals);
    expect(result.probability).toBeGreaterThan(0.5); // pulled toward B's 0.8
  });

  it('clamps p=0 to CLAMP_MIN without throwing', () => {
    const signals: LogOddsSignal[] = [{ name: 'A', probability: 0, weight: 1, category: 'x' }];
    expect(() => combineLogOdds(signals)).not.toThrow();
    expect(combineLogOdds(signals).probability).toBeCloseTo(0.001, 2);
  });

  it('clamps p=1 to CLAMP_MAX without throwing', () => {
    const signals: LogOddsSignal[] = [{ name: 'A', probability: 1, weight: 1, category: 'x' }];
    expect(() => combineLogOdds(signals)).not.toThrow();
    expect(combineLogOdds(signals).probability).toBeCloseTo(0.999, 2);
  });

  it('flags divergence when signals strongly disagree (20% vs 80%)', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.2, weight: 0.5, category: 'x' },
      { name: 'B', probability: 0.8, weight: 0.5, category: 'y' },
    ];
    expect(combineLogOdds(signals).divergence).toBe(true);
  });

  it('does not flag divergence when signals agree closely (58% vs 62%)', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.58, weight: 0.5, category: 'x' },
      { name: 'B', probability: 0.62, weight: 0.5, category: 'y' },
    ];
    expect(combineLogOdds(signals).divergence).toBe(false);
  });

  it('lower < probability < upper', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.4, weight: 0.6, category: 'x' },
      { name: 'B', probability: 0.7, weight: 0.4, category: 'y' },
    ];
    const result = combineLogOdds(signals);
    expect(result.lower).toBeLessThan(result.probability);
    expect(result.upper).toBeGreaterThan(result.probability);
  });

  it('probability and bounds are all within (0, 1)', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.1, weight: 0.5, category: 'x' },
      { name: 'B', probability: 0.9, weight: 0.5, category: 'y' },
    ];
    const result = combineLogOdds(signals);
    expect(result.probability).toBeGreaterThan(0);
    expect(result.probability).toBeLessThan(1);
    expect(result.lower).toBeGreaterThan(0);
    expect(result.upper).toBeLessThan(1);
  });

  it('result.signals includes normalisedWeight and logOdds', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.6, weight: 2, category: 'x' },
      { name: 'B', probability: 0.4, weight: 3, category: 'y' },
    ];
    const result = combineLogOdds(signals);
    expect(result.signals[0].normalisedWeight).toBeCloseTo(0.4, 5);
    expect(result.signals[1].normalisedWeight).toBeCloseTo(0.6, 5);
    expect(typeof result.signals[0].logOdds).toBe('number');
  });

  it('throws on empty signals array', () => {
    expect(() => combineLogOdds([])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// normaliseWeights
// ---------------------------------------------------------------------------

describe('normaliseWeights', () => {
  it('re-normalises weights to sum to 1.0', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.6, weight: 2, category: 'x' },
      { name: 'B', probability: 0.4, weight: 3, category: 'y' },
    ];
    const result = normaliseWeights(signals);
    const sum = result.reduce((s, sig) => s + sig.normalisedWeight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
    expect(result[0].normalisedWeight).toBeCloseTo(0.4, 5);
    expect(result[1].normalisedWeight).toBeCloseTo(0.6, 5);
  });

  it('preserves original signal fields alongside normalisedWeight', () => {
    const signals: LogOddsSignal[] = [
      { name: 'Polymarket', probability: 0.65, weight: 0.4, category: 'a' },
    ];
    const result = normaliseWeights(signals);
    expect(result[0].name).toBe('Polymarket');
    expect(result[0].probability).toBe(0.65);
    expect(result[0].normalisedWeight).toBeCloseTo(1.0, 5);
  });

  it('throws when all weights are zero', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.5, weight: 0, category: 'x' },
    ];
    expect(() => normaliseWeights(signals)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// formatProbabilityTable
// ---------------------------------------------------------------------------

describe('formatProbabilityTable', () => {
  it('includes the title in the output', () => {
    const signals: LogOddsSignal[] = [
      { name: 'Fed cut', probability: 0.65, weight: 1, category: 'macro_rates' },
    ];
    const table = formatProbabilityTable(combineLogOdds(signals), 'Will Fed cut rates?');
    expect(table).toContain('Will Fed cut rates?');
  });

  it('includes each signal name', () => {
    const signals: LogOddsSignal[] = [
      { name: 'Polymarket', probability: 0.65, weight: 0.4, category: 'a' },
      { name: 'Analyst consensus', probability: 0.72, weight: 0.6, category: 'b' },
    ];
    const table = formatProbabilityTable(combineLogOdds(signals), 'test');
    expect(table).toContain('Polymarket');
    expect(table).toContain('Analyst consensus');
  });

  it('includes a Combined row', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.6, weight: 1, category: 'x' },
    ];
    const table = formatProbabilityTable(combineLogOdds(signals), 'test');
    expect(table).toContain('Combined');
  });

  it('includes divergence warning when signals diverge', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.15, weight: 0.5, category: 'x' },
      { name: 'B', probability: 0.85, weight: 0.5, category: 'y' },
    ];
    const table = formatProbabilityTable(combineLogOdds(signals), 'test');
    expect(table).toContain('diverge');
  });

  it('does NOT include divergence warning when signals agree', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.60, weight: 0.5, category: 'x' },
      { name: 'B', probability: 0.65, weight: 0.5, category: 'y' },
    ];
    const table = formatProbabilityTable(combineLogOdds(signals), 'test');
    expect(table).not.toContain('diverge');
  });

  it('output is a non-empty string', () => {
    const signals: LogOddsSignal[] = [
      { name: 'A', probability: 0.5, weight: 1, category: 'x' },
    ];
    const table = formatProbabilityTable(combineLogOdds(signals), 'title');
    expect(table.length).toBeGreaterThan(50);
  });
});
