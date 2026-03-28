import { describe, it, expect } from 'bun:test';
import {
  computeReturns,
  computeVolatility,
  computeSharpe,
  computeVaR,
  computeCVaR,
  computeMaxDrawdown,
  computeCorrelationMatrix,
  computePortfolioReturns,
  alignReturnSeries,
} from './portfolio-stats';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Build a price series that grows at a constant daily rate. */
function constantGrowthPrices(n: number, dailyRate: number, start = 100): number[] {
  return Array.from({ length: n }, (_, i) => start * Math.pow(1 + dailyRate, i));
}

/** Build a flat (zero-return) price series. */
function flatPrices(n: number, price = 100): number[] {
  return Array(n).fill(price);
}

// ─── computeReturns ─────────────────────────────────────────────────────────

describe('computeReturns', () => {
  it('returns empty array for fewer than 2 prices', () => {
    expect(computeReturns([])).toEqual([]);
    expect(computeReturns([100])).toEqual([]);
  });

  it('computes arithmetic daily returns correctly', () => {
    const prices = [100, 110, 99]; // +10%, -10%
    const returns = computeReturns(prices);
    expect(returns).toHaveLength(2);
    expect(returns[0]).toBeCloseTo(0.1, 10);
    expect(returns[1]).toBeCloseTo(-0.1, 10);
  });

  it('returns constant rate for constant-growth series', () => {
    const rate = 0.01;
    const prices = constantGrowthPrices(10, rate);
    const returns = computeReturns(prices);
    for (const r of returns) {
      expect(r).toBeCloseTo(rate, 10);
    }
  });

  it('returns all zeros for a flat series', () => {
    const returns = computeReturns(flatPrices(5));
    expect(returns).toEqual([0, 0, 0, 0]);
  });
});

// ─── computeVolatility ──────────────────────────────────────────────────────

describe('computeVolatility', () => {
  it('returns 0 for zero-variance returns', () => {
    const returns = [0.01, 0.01, 0.01, 0.01];
    expect(computeVolatility(returns)).toBe(0);
  });

  it('annualises by √252 by default', () => {
    const returns = [0.01, -0.01, 0.01, -0.01, 0.01, -0.01];
    const daily = computeVolatility(returns, 1);
    const annual = computeVolatility(returns);
    expect(annual).toBeCloseTo(daily * Math.sqrt(252), 8);
  });

  it('returns 0 for empty returns', () => {
    expect(computeVolatility([])).toBe(0);
  });

  it('returns positive value for non-zero variance', () => {
    const returns = computeReturns(constantGrowthPrices(50, 0.001).map((p, i) => p + (i % 2 === 0 ? 1 : -1)));
    expect(computeVolatility(returns)).toBeGreaterThan(0);
  });
});

// ─── computeSharpe ──────────────────────────────────────────────────────────

describe('computeSharpe', () => {
  it('returns 0 for flat (zero-return) portfolio', () => {
    expect(computeSharpe([0, 0, 0, 0])).toBe(0);
  });

  it('returns positive Sharpe for steady positive returns', () => {
    const returns = Array(252).fill(0.001); // small daily gain
    expect(computeSharpe(returns)).toBeGreaterThan(0);
  });

  it('annualised risk-free rate: higher rfr reduces Sharpe for same returns', () => {
    const returns = [0.001, 0.002, -0.001, 0.003, 0.001, -0.002, 0.002, 0.001];
    const sharpe_zero_rfr = computeSharpe(returns, 0.0);
    const sharpe_high_rfr = computeSharpe(returns, 0.5);
    expect(sharpe_zero_rfr).toBeGreaterThan(sharpe_high_rfr);
  });

  it('returns negative Sharpe for negative-return portfolio', () => {
    const returns = Array(252).fill(-0.001);
    expect(computeSharpe(returns)).toBeLessThan(0);
  });

  it('accepts custom risk-free rate', () => {
    const returns = Array(252).fill(0.001);
    const low = computeSharpe(returns, 0.0);
    const high = computeSharpe(returns, 0.5);
    expect(low).toBeGreaterThan(high);
  });

  it('returns 0 for empty returns', () => {
    expect(computeSharpe([])).toBe(0);
  });
});

// ─── computeVaR ─────────────────────────────────────────────────────────────

describe('computeVaR', () => {
  it('returns 0 for empty returns', () => {
    expect(computeVaR([])).toBe(0);
  });

  it('returns positive number (loss expressed as a positive value)', () => {
    const returns = [-0.05, 0.03, -0.02, 0.01, -0.04, 0.02];
    expect(computeVaR(returns, 0.95)).toBeGreaterThanOrEqual(0);
  });

  it('95% VaR equals the 5th-percentile loss (sorted ascending, floor index)', () => {
    // 20 returns: sorted → -0.10, -0.09, ..., +0.09
    const returns = Array.from({ length: 20 }, (_, i) => -0.10 + i * 0.01);
    const var95 = computeVaR(returns, 0.95); // 5th pct → index 0 → -0.10 → VaR = 0.10
    expect(var95).toBeCloseTo(0.10, 6);
  });

  it('higher confidence → larger (or equal) VaR', () => {
    const returns = Array.from({ length: 100 }, (_, i) => (i - 50) / 1000);
    const var95 = computeVaR(returns, 0.95);
    const var99 = computeVaR(returns, 0.99);
    expect(var99).toBeGreaterThanOrEqual(var95);
  });
});

// ─── computeCVaR ────────────────────────────────────────────────────────────

describe('computeCVaR', () => {
  it('returns 0 for empty returns', () => {
    expect(computeCVaR([])).toBe(0);
  });

  it('CVaR >= VaR (tail is at least as bad as the cut-off)', () => {
    const returns = Array.from({ length: 100 }, (_, i) => (i - 50) / 1000);
    expect(computeCVaR(returns, 0.95)).toBeGreaterThanOrEqual(computeVaR(returns, 0.95));
  });

  it('returns a positive number for a distribution with losses', () => {
    const returns = [-0.05, -0.03, 0.01, 0.02, 0.04];
    expect(computeCVaR(returns, 0.5)).toBeGreaterThan(0);
  });
});

// ─── computeMaxDrawdown ─────────────────────────────────────────────────────

describe('computeMaxDrawdown', () => {
  it('returns 0 for empty or single-price series', () => {
    expect(computeMaxDrawdown([])).toBe(0);
    expect(computeMaxDrawdown([100])).toBe(0);
  });

  it('returns 0 for monotonically increasing prices', () => {
    expect(computeMaxDrawdown([100, 105, 110, 120])).toBe(0);
  });

  it('computes correct drawdown for simple drop and recovery', () => {
    // Peak = 100, trough = 50 → MDD = 0.50
    const prices = [100, 90, 50, 60, 80];
    expect(computeMaxDrawdown(prices)).toBeCloseTo(0.5, 10);
  });

  it('returns 1 for a series that hits zero from positive', () => {
    const prices = [100, 50, 0];
    expect(computeMaxDrawdown(prices)).toBeCloseTo(1.0, 10);
  });

  it('returns a value in [0, 1]', () => {
    const prices = [10, 5, 8, 3, 6];
    const mdd = computeMaxDrawdown(prices);
    expect(mdd).toBeGreaterThanOrEqual(0);
    expect(mdd).toBeLessThanOrEqual(1);
  });
});

// ─── computeCorrelationMatrix ────────────────────────────────────────────────

describe('computeCorrelationMatrix', () => {
  it('returns empty object for empty input', () => {
    expect(computeCorrelationMatrix({})).toEqual({});
  });

  it('returns 1 on the diagonal', () => {
    const series = {
      A: [0.01, -0.02, 0.03, -0.01, 0.02],
      B: [0.02, 0.01, -0.01, 0.02, -0.01],
    };
    const matrix = computeCorrelationMatrix(series);
    expect(matrix.A.A).toBeCloseTo(1, 8);
    expect(matrix.B.B).toBeCloseTo(1, 8);
  });

  it('is symmetric', () => {
    const series = {
      A: [0.01, -0.02, 0.03, 0.00, 0.02],
      B: [0.02, 0.01, -0.01, 0.03, -0.01],
    };
    const matrix = computeCorrelationMatrix(series);
    expect(matrix.A.B).toBeCloseTo(matrix.B.A, 10);
  });

  it('all values are in [-1, 1]', () => {
    const series = {
      A: [0.05, -0.03, 0.02, -0.01, 0.04],
      B: [-0.02, 0.04, -0.01, 0.03, -0.02],
    };
    const matrix = computeCorrelationMatrix(series);
    for (const row of Object.values(matrix)) {
      for (const val of Object.values(row)) {
        expect(val).toBeGreaterThanOrEqual(-1 - 1e-10);
        expect(val).toBeLessThanOrEqual(1 + 1e-10);
      }
    }
  });

  it('returns 1 for perfectly correlated series', () => {
    const base = [0.01, -0.02, 0.03, -0.01, 0.02];
    const series = { A: base, B: base.map((x) => x * 2) }; // scaled — same direction
    const matrix = computeCorrelationMatrix(series);
    expect(matrix.A.B).toBeCloseTo(1, 6);
  });

  it('returns -1 for perfectly anti-correlated series', () => {
    const base = [0.01, -0.02, 0.03, -0.01, 0.02];
    const series = { A: base, B: base.map((x) => -x) };
    const matrix = computeCorrelationMatrix(series);
    expect(matrix.A.B).toBeCloseTo(-1, 6);
  });
});

// ─── computePortfolioReturns ─────────────────────────────────────────────────

describe('computePortfolioReturns', () => {
  it('returns empty array for empty input', () => {
    expect(computePortfolioReturns({})).toEqual([]);
  });

  it('returns single-asset returns when one position with weight 1', () => {
    const returns = [0.01, -0.02, 0.03];
    const result = computePortfolioReturns({ A: { returns, weight: 1 } });
    for (let i = 0; i < returns.length; i++) {
      expect(result[i]).toBeCloseTo(returns[i], 10);
    }
  });

  it('weights two assets correctly', () => {
    const input = {
      A: { returns: [0.10, 0.10], weight: 0.4 },
      B: { returns: [0.20, 0.20], weight: 0.6 },
    };
    const result = computePortfolioReturns(input);
    // 0.4 * 0.10 + 0.6 * 0.20 = 0.04 + 0.12 = 0.16
    expect(result[0]).toBeCloseTo(0.16, 10);
    expect(result[1]).toBeCloseTo(0.16, 10);
  });
});

// ─── alignReturnSeries ───────────────────────────────────────────────────────

describe('alignReturnSeries', () => {
  it('returns empty map for empty input', () => {
    expect(Object.keys(alignReturnSeries({}))).toHaveLength(0);
  });

  it('trims all series to the length of the shortest', () => {
    const series = {
      A: [0.01, 0.02, 0.03, 0.04, 0.05],
      B: [0.01, 0.02, 0.03],
    };
    const aligned = alignReturnSeries(series);
    expect(aligned.A).toHaveLength(3);
    expect(aligned.B).toHaveLength(3);
  });

  it('keeps series unchanged when they are already equal length', () => {
    const series = {
      A: [0.01, 0.02],
      B: [0.03, 0.04],
    };
    const aligned = alignReturnSeries(series);
    expect(aligned.A).toEqual([0.01, 0.02]);
    expect(aligned.B).toEqual([0.03, 0.04]);
  });

  it('trims from the start (most recent data is at the end)', () => {
    const series = {
      long: [1, 2, 3, 4, 5],
      short: [10, 20],
    };
    const aligned = alignReturnSeries(series);
    // Shortest is 2 — takes the last 2 elements of 'long'
    expect(aligned.long).toEqual([4, 5]);
    expect(aligned.short).toEqual([10, 20]);
  });
});
