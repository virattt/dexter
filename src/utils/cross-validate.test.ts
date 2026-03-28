/**
 * TDD tests for src/utils/cross-validate.ts
 *
 * Pure functions — no I/O, no mocking required.
 */
import { describe, it, expect } from 'bun:test';
import { crossValidateFinancials } from './cross-validate.js';
import type { FinancialRecord } from './cross-validate.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make(
  year: number,
  totalRevenue?: number,
  netIncome?: number,
): FinancialRecord {
  return { year, totalRevenue, netIncome };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('crossValidateFinancials — no discrepancy', () => {
  it('returns ok=true when primary and secondary are identical', () => {
    const primary = [make(2024, 1_000_000, 200_000)];
    const secondary = [make(2024, 1_000_000, 200_000)];
    const result = crossValidateFinancials(primary, secondary);
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns ok=true when divergence is exactly at the 15% threshold', () => {
    // 15% difference → should NOT trigger (threshold is strictly >)
    const primary = [make(2024, 1_000_000, undefined)];
    const secondary = [make(2024, 1_150_000, undefined)]; // exactly +15%
    const result = crossValidateFinancials(primary, secondary);
    expect(result.ok).toBe(true);
  });

  it('returns ok=true when data covers different years (no overlap)', () => {
    const primary = [make(2024, 1_000_000, 200_000)];
    const secondary = [make(2023, 500_000, 100_000)];
    const result = crossValidateFinancials(primary, secondary);
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns ok=true when secondary is empty', () => {
    const primary = [make(2024, 1_000_000, 200_000)];
    const result = crossValidateFinancials(primary, []);
    expect(result.ok).toBe(true);
  });

  it('returns ok=true when primary is empty', () => {
    const result = crossValidateFinancials([], [make(2024, 1_000_000)]);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Discrepancy detection
// ---------------------------------------------------------------------------

describe('crossValidateFinancials — discrepancy detection', () => {
  it('warns when totalRevenue diverges by more than 15%', () => {
    const primary = [make(2024, 1_000_000)];
    const secondary = [make(2024, 1_200_000)]; // 20% higher
    const result = crossValidateFinancials(primary, secondary);
    expect(result.ok).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('⚠️');
    expect(result.warnings[0]).toContain('totalRevenue');
    expect(result.warnings[0]).toContain('2024');
    expect(result.warnings[0]).toContain('20.0%');
  });

  it('warns when netIncome diverges by more than 15%', () => {
    const primary = [make(2024, undefined, 1_000_000)];
    const secondary = [make(2024, undefined, 800_000)]; // 20% lower
    const result = crossValidateFinancials(primary, secondary);
    expect(result.ok).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('netIncome');
  });

  it('emits two warnings when both fields diverge', () => {
    const primary = [make(2024, 1_000_000, 200_000)];
    const secondary = [make(2024, 1_300_000, 400_000)]; // 30% and 100% divergence
    const result = crossValidateFinancials(primary, secondary);
    expect(result.ok).toBe(false);
    expect(result.warnings).toHaveLength(2);
  });

  it('warns for each year that has a diverging value', () => {
    const primary = [make(2024, 1_000_000), make(2023, 900_000)];
    const secondary = [make(2024, 1_300_000), make(2023, 1_200_000)]; // both diverge
    const result = crossValidateFinancials(primary, secondary);
    expect(result.warnings).toHaveLength(2);
    const years = result.warnings.map(w => (w.includes('2024') ? 2024 : 2023));
    expect(years).toContain(2024);
    expect(years).toContain(2023);
  });

  it('triggers at just above the threshold (15.1%)', () => {
    const primary = [make(2024, 1_000_000)];
    const secondary = [make(2024, 1_151_000)]; // 15.1%
    const result = crossValidateFinancials(primary, secondary);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge cases / null safety
// ---------------------------------------------------------------------------

describe('crossValidateFinancials — edge cases', () => {
  it('skips comparison when primary totalRevenue is undefined', () => {
    const primary = [make(2024, undefined, 200_000)];
    const secondary = [make(2024, 1_500_000, 200_000)];
    const result = crossValidateFinancials(primary, secondary);
    expect(result.ok).toBe(true); // only revenue is undefined; netIncome matches
  });

  it('skips comparison when secondary totalRevenue is undefined', () => {
    const primary = [make(2024, 1_000_000)];
    const secondary = [make(2024, undefined)];
    const result = crossValidateFinancials(primary, secondary);
    expect(result.ok).toBe(true);
  });

  it('skips comparison when primary totalRevenue is 0 (avoid divide-by-zero)', () => {
    const primary = [make(2024, 0, 100_000)];
    const secondary = [make(2024, 999_999, 200_000)]; // secondary revenue hugely different
    const result = crossValidateFinancials(primary, secondary);
    // Revenue skipped; netIncome diverges 100% → warning
    expect(result.warnings.some(w => w.includes('netIncome'))).toBe(true);
    expect(result.warnings.every(w => !w.includes('totalRevenue'))).toBe(true);
  });

  it('handles negative netIncome (losses) correctly', () => {
    const primary = [make(2024, undefined, -1_000_000)];
    const secondary = [make(2024, undefined, -1_300_000)]; // 30% larger loss
    const result = crossValidateFinancials(primary, secondary);
    expect(result.ok).toBe(false);
    expect(result.warnings[0]).toContain('netIncome');
  });

  it('respects a custom threshold of 10%', () => {
    const primary = [make(2024, 1_000_000)];
    const secondary = [make(2024, 1_110_000)]; // 11% — above 10% but below default 15%
    const defaultResult = crossValidateFinancials(primary, secondary);
    const strictResult = crossValidateFinancials(primary, secondary, 0.10);
    expect(defaultResult.ok).toBe(true);   // 11% < 15%: fine under default
    expect(strictResult.ok).toBe(false);   // 11% > 10%: flagged under strict threshold
  });

  it('respects a loose threshold of 50%', () => {
    const primary = [make(2024, 1_000_000)];
    const secondary = [make(2024, 1_400_000)]; // 40% — below 50% threshold
    const result = crossValidateFinancials(primary, secondary, 0.50);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Warning message format (for readability in agent output)
// ---------------------------------------------------------------------------

describe('crossValidateFinancials — warning message format', () => {
  it('formats USD in billions', () => {
    const primary = [make(2024, 100_000_000_000)]; // $100B
    const secondary = [make(2024, 130_000_000_000)]; // $130B — 30% divergence
    const { warnings } = crossValidateFinancials(primary, secondary);
    expect(warnings[0]).toMatch(/\$\d+\.\d+B/);
  });

  it('formats USD in millions', () => {
    const primary = [make(2024, 500_000_000)]; // $500M
    const secondary = [make(2024, 650_000_000)]; // 30% divergence
    const { warnings } = crossValidateFinancials(primary, secondary);
    expect(warnings[0]).toMatch(/\$\d+\.\d+M/);
  });

  it('formats USD in trillions', () => {
    const primary = [make(2024, 2_000_000_000_000)]; // $2T
    const secondary = [make(2024, 2_600_000_000_000)]; // 30% divergence
    const { warnings } = crossValidateFinancials(primary, secondary);
    expect(warnings[0]).toMatch(/\$\d+\.\d+T/);
  });

  it('formats negative USD with a minus sign', () => {
    const primary = [make(2024, undefined, -500_000_000)]; // -$500M
    const secondary = [make(2024, undefined, -700_000_000)]; // 40% divergence
    const { warnings } = crossValidateFinancials(primary, secondary);
    expect(warnings[0]).toContain('-$');
  });

  it('includes percentage divergence in the warning', () => {
    const primary = [make(2024, 1_000_000)];
    const secondary = [make(2024, 1_200_000)]; // exactly 20%
    const { warnings } = crossValidateFinancials(primary, secondary);
    expect(warnings[0]).toContain('20.0%');
  });
});
