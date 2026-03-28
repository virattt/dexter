/**
 * Pure portfolio statistics utilities.
 *
 * All functions are side-effect free and accept plain number arrays so they can
 * be unit-tested without any API or file-system dependencies.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PortfolioPosition {
  ticker: string;
  weight: number;
  returns: number[];
}

export interface PortfolioRiskReport {
  tickers: string[];
  lookbackDays: number;
  /** Annualized volatility per ticker, e.g. { AAPL: 0.24 } */
  volatility: Record<string, number>;
  /** Annualized Sharpe ratio per ticker */
  sharpe: Record<string, number>;
  /** Historical Value-at-Risk (positive = loss) per ticker at given confidence */
  var: Record<string, number>;
  /** Conditional VaR (Expected Shortfall) per ticker */
  cvar: Record<string, number>;
  /** Max drawdown per ticker (0–1) */
  maxDrawdown: Record<string, number>;
  /** Pearson correlation matrix */
  correlation: Record<string, Record<string, number>>;
  /** Portfolio-level metrics (weighted combination) */
  portfolio: {
    volatility: number;
    sharpe: number;
    var: number;
    cvar: number;
    maxDrawdown: number;
  };
  confidenceLevel: number;
  riskFreeRate: number;
}

// ─── Core functions ──────────────────────────────────────────────────────────

/**
 * Compute arithmetic daily returns from a price series.
 * Returns an array of length (prices.length - 1).
 */
export function computeReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

/**
 * Compute the sample standard deviation of an array of numbers.
 * Returns 0 for arrays with fewer than 2 elements or zero variance.
 */
function sampleStd(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Annualised volatility (standard deviation of daily returns × √annualizationFactor).
 * Default annualizationFactor = 252 (trading days/year).
 */
export function computeVolatility(returns: number[], annualizationFactor = 252): number {
  if (returns.length === 0) return 0;
  return sampleStd(returns) * Math.sqrt(annualizationFactor);
}

/**
 * Annualised Sharpe ratio.
 *
 * @param returns        Daily arithmetic returns
 * @param riskFreeRate   Annual risk-free rate (default 5 % = 0.05)
 */
export function computeSharpe(returns: number[], riskFreeRate = 0.05): number {
  if (returns.length === 0) return 0;
  const vol = computeVolatility(returns);
  if (vol === 0) return 0;
  const annualReturn = mean(returns) * 252;
  return (annualReturn - riskFreeRate) / vol;
}

/**
 * Historical Value-at-Risk at the given confidence level.
 * Returns a positive number representing the loss not exceeded with `confidence`
 * probability (e.g. 0.95 → the worst 5 % of days are worse than this).
 */
export function computeVaR(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  // Round to avoid floating-point drift (e.g. 1-0.95 = 0.0500...044 in IEEE 754).
  // tailSize = number of observations in the tail (at least 1).
  const tailSize = Math.max(1, Math.round((1 - confidence) * sorted.length));
  return -sorted[tailSize - 1];
}

/**
 * Conditional Value-at-Risk (Expected Shortfall) at the given confidence level.
 * Average loss among returns that fall below the VaR threshold.
 * Always >= VaR.
 */
export function computeCVaR(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const tailSize = Math.max(1, Math.round((1 - confidence) * sorted.length));
  return -mean(sorted.slice(0, tailSize));
}

/**
 * Maximum peak-to-trough drawdown of a price series.
 * Returns a value in [0, 1] where 1 = total loss.
 */
export function computeMaxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;
  let peak = prices[0];
  let maxDD = 0;
  for (const price of prices) {
    if (price > peak) peak = price;
    const dd = peak > 0 ? (peak - price) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

/**
 * Pearson correlation between two equal-length return arrays.
 * Returns 0 if either series has zero variance.
 */
function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : Math.max(-1, Math.min(1, cov / denom));
}

/**
 * Compute the full pairwise Pearson correlation matrix for a set of return series.
 * Diagonal entries are always 1.
 */
export function computeCorrelationMatrix(
  series: Record<string, number[]>,
): Record<string, Record<string, number>> {
  const tickers = Object.keys(series);
  const matrix: Record<string, Record<string, number>> = {};
  for (const a of tickers) {
    matrix[a] = {};
    for (const b of tickers) {
      matrix[a][b] = a === b ? 1 : pearsonCorrelation(series[a], series[b]);
    }
  }
  return matrix;
}

/**
 * Compute weighted portfolio daily returns.
 * All return series must be equal length (use `alignReturnSeries` first).
 * Weights need not sum to 1 — they are normalised internally.
 */
export function computePortfolioReturns(
  positions: Record<string, { returns: number[]; weight: number }>,
): number[] {
  const entries = Object.values(positions);
  if (entries.length === 0) return [];
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  if (totalWeight === 0) return [];

  const n = entries[0].returns.length;
  const result = new Array<number>(n).fill(0);
  for (const { returns, weight } of entries) {
    const w = weight / totalWeight;
    for (let i = 0; i < n; i++) {
      result[i] += w * (returns[i] ?? 0);
    }
  }
  return result;
}

/**
 * Trim all return series to the length of the shortest one.
 * Trimming from the start so the most recent data (at the end) is preserved.
 */
export function alignReturnSeries(
  series: Record<string, number[]>,
): Record<string, number[]> {
  const tickers = Object.keys(series);
  if (tickers.length === 0) return {};
  const minLen = Math.min(...tickers.map((t) => series[t].length));
  const aligned: Record<string, number[]> = {};
  for (const t of tickers) {
    aligned[t] = series[t].slice(series[t].length - minLen);
  }
  return aligned;
}

/**
 * Build a full PortfolioRiskReport from per-ticker price series and weights.
 *
 * @param pricesByTicker   Map of ticker → close price array (chronological order)
 * @param weights          Map of ticker → portfolio weight (e.g. market value)
 * @param confidenceLevel  VaR/CVaR confidence (default 0.95)
 * @param riskFreeRate     Annual risk-free rate for Sharpe (default 0.05)
 */
export function buildPortfolioRiskReport(
  pricesByTicker: Record<string, number[]>,
  weights: Record<string, number>,
  confidenceLevel = 0.95,
  riskFreeRate = 0.05,
): PortfolioRiskReport {
  const tickers = Object.keys(pricesByTicker);

  // Compute per-ticker returns
  const returnsByTicker: Record<string, number[]> = {};
  for (const t of tickers) {
    returnsByTicker[t] = computeReturns(pricesByTicker[t]);
  }

  // Align series lengths (different tickers may have different history)
  const aligned = alignReturnSeries(returnsByTicker);

  // Per-ticker metrics
  const volatility: Record<string, number> = {};
  const sharpe: Record<string, number> = {};
  const varMap: Record<string, number> = {};
  const cvarMap: Record<string, number> = {};
  const maxDrawdownMap: Record<string, number> = {};

  for (const t of tickers) {
    const r = aligned[t] ?? [];
    volatility[t] = computeVolatility(r);
    sharpe[t] = computeSharpe(r, riskFreeRate);
    varMap[t] = computeVaR(r, confidenceLevel);
    cvarMap[t] = computeCVaR(r, confidenceLevel);
    maxDrawdownMap[t] = computeMaxDrawdown(pricesByTicker[t]);
  }

  // Portfolio-level: use equal weights if no weights provided
  const totalWeight = tickers.reduce((s, t) => s + (weights[t] ?? 1), 0) || tickers.length;
  const portPositions: Record<string, { returns: number[]; weight: number }> = {};
  for (const t of tickers) {
    portPositions[t] = { returns: aligned[t] ?? [], weight: weights[t] ?? 1 };
  }

  const portReturns = computePortfolioReturns(portPositions);
  // Reconstruct a pseudo-price series from portfolio returns for drawdown
  const portPrices = [100, ...portReturns.map((r, i, arr) => {
    return arr.slice(0, i + 1).reduce((p, ret) => p * (1 + ret), 100);
  })];

  const portfolio = {
    volatility: computeVolatility(portReturns),
    sharpe: computeSharpe(portReturns, riskFreeRate),
    var: computeVaR(portReturns, confidenceLevel),
    cvar: computeCVaR(portReturns, confidenceLevel),
    maxDrawdown: computeMaxDrawdown(portPrices),
  };

  const lookbackDays = (aligned[tickers[0]] ?? []).length;

  return {
    tickers,
    lookbackDays,
    volatility,
    sharpe,
    var: varMap,
    cvar: cvarMap,
    maxDrawdown: maxDrawdownMap,
    correlation: computeCorrelationMatrix(aligned),
    portfolio,
    confidenceLevel,
    riskFreeRate,
    _totalWeight: totalWeight,
  } as unknown as PortfolioRiskReport;
}
