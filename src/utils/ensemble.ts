/**
 * Polymarket weighted ensemble forecast engine.
 *
 * Pure math — no API calls, no side effects. All functions are exported
 * individually so they can be unit-tested in isolation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketInput {
  question: string;
  probability: number;           // raw [0,1]
  volume24hUsd: number;          // 24h USD volume
  ageDays?: number;              // days since market opened (undefined → assume 21+ = mature)
  priceSpikeDetected?: boolean;  // true if |P_now - P_2h_ago| > 0.08 (whale proxy)
  signalTier?: 'macro' | 'geopolitical' | 'electoral'; // default 'geopolitical'
  deltaYes: number;              // estimated asset return if YES (decimal, e.g. 0.06)
  deltaNo: number;               // estimated asset return if NO (decimal, e.g. -0.04)
}

export interface OtherSignals {
  sentimentScore?: number;    // -1 to +1 (-1=bearish, 0=neutral, +1=bullish)
  fundamentalReturn?: number; // analyst 1yr return scaled to horizon (decimal)
  optionsSkew?: number;       // -1/0/+1 (bearish/neutral/bullish put-call skew)
  horizonDays?: number;       // for scaling fundamentalReturn (default 7)
}

export interface EnsembleResult {
  forecastReturn: number;      // E[r_forecast] as decimal
  forecastPrice: number;       // S_current * (1 + forecastReturn)
  ciLow95: number;             // lower bound of 95% CI
  ciHigh95: number;            // upper bound of 95% CI
  sigma: number;               // total standard deviation
  qualityScore: number;        // 0-100
  qualityGrade: 'A' | 'B' | 'C' | 'D';
  pmSignal: number;            // E[r_PM] the polymarket component
  pmEffectiveWeight: number;   // w_PM_eff (0-0.40 scaled by market quality)
  avgMarketQuality: number;    // w̄ mean quality weight
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Apply a yes-side bias correction.  Markets tend to overweight YES outcomes;
 * subtract beta from probabilities above 0.5.
 */
export function adjustYesBias(p: number, beta = 0.035): number {
  if (p > 0.5) {
    return clamp(p - beta, 0.01, 0.99);
  }
  return clamp(p, 0.01, 0.99);
}

/**
 * Composite quality weight for a single Polymarket market.
 *
 * Factors in market age, liquidity (log-volume), tier discount, and a 50%
 * penalty when a whale-sized price spike is detected.
 */
export function computeMarketQualityWeight(m: MarketInput): number {
  const wAge = Math.min(1, (m.ageDays ?? 21) / 21);
  const wLiq = Math.min(1, Math.log10(m.volume24hUsd + 1) / 6);
  const tau =
    m.signalTier === 'macro'
      ? 0.90
      : m.signalTier === 'electoral'
        ? 0.55
        : 0.75;
  const deltaWhale = m.priceSpikeDetected ? 1 : 0;
  // Whale flag applies a 50% discount (not full elimination).
  const w = wAge * wLiq * tau * (1 - deltaWhale * 0.5);
  return Math.max(0, Math.min(1, w));
}

/**
 * Expected asset return conditioned on the adjusted YES probability.
 */
export function computeConditionalReturn(
  pAdjusted: number,
  deltaYes: number,
  deltaNo: number,
): number {
  return pAdjusted * deltaYes + (1 - pAdjusted) * deltaNo;
}

/**
 * Aggregate the Polymarket signal across all markets.
 *
 * Returns a quality-weighted average conditional return, the mean quality
 * weight, and any relevant warnings.
 */
export function computePolymarketSignal(markets: MarketInput[]): {
  signal: number;
  avgQuality: number;
  warnings: string[];
} {
  if (markets.length === 0) {
    return {
      signal: 0,
      avgQuality: 0,
      warnings: ['No Polymarket markets found — PM signal omitted'],
    };
  }

  const warnings: string[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const m of markets) {
    const pAdj = adjustYesBias(m.probability);
    const w = computeMarketQualityWeight(m);
    const r = computeConditionalReturn(pAdj, m.deltaYes, m.deltaNo);
    weightedSum += w * r;
    totalWeight += w;

    if (Math.abs(m.probability - adjustYesBias(m.probability)) > 0.1) {
      warnings.push(
        `Market "${m.question}" has high YES bias (raw p=${m.probability.toFixed(3)})`,
      );
    }
    if (m.priceSpikeDetected) {
      warnings.push(
        `Market "${m.question}" has a price spike (possible whale activity) — quality discounted 50%`,
      );
    }
  }

  const signal = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const avgQuality = totalWeight / markets.length;

  return { signal, avgQuality, warnings };
}

/**
 * Combine the Polymarket signal with auxiliary signals into a single forecast
 * return, normalising weights so they sum to 1 across available signals.
 *
 * Base weights: PM=0.40, sentiment=0.20, fundamental=0.25, options=0.15.
 * The PM weight is further scaled by pmAvgQuality before normalisation.
 */
export function computeEnsemble(
  pmSignal: number,
  pmAvgQuality: number,
  others: OtherSignals,
): { forecastReturn: number; weights: Record<string, number> } {
  const horizonDays = others.horizonDays ?? 7;

  // Effective PM weight scaled by market quality.
  const wPmEff = 0.40 * pmAvgQuality;

  // Available signals with their raw weights and returns.
  type SignalEntry = { weight: number; signal: number };
  const available: Record<string, SignalEntry> = {};

  // PM is always included.
  available['pm'] = { weight: wPmEff, signal: pmSignal };

  if (others.sentimentScore !== undefined && !Number.isNaN(others.sentimentScore)) {
    available['sentiment'] = {
      weight: 0.20,
      signal: others.sentimentScore * 0.04,
    };
  }

  if (others.fundamentalReturn !== undefined && !Number.isNaN(others.fundamentalReturn)) {
    available['fundamental'] = {
      weight: 0.25,
      signal: others.fundamentalReturn * (horizonDays / 365),
    };
  }

  if (others.optionsSkew !== undefined && !Number.isNaN(others.optionsSkew)) {
    available['options'] = {
      weight: 0.15,
      signal: others.optionsSkew * 0.03,
    };
  }

  // Normalise weights to sum to 1.
  const totalRaw = Object.values(available).reduce((acc, e) => acc + e.weight, 0);
  const weights: Record<string, number> = {};
  let forecastReturn = 0;

  if (totalRaw === 0) {
    // Degenerate case: all weights zero — equal-weight available signals.
    const n = Object.keys(available).length;
    for (const [key, entry] of Object.entries(available)) {
      const w = n > 0 ? 1 / n : 0;
      weights[key] = w;
      forecastReturn += w * entry.signal;
    }
  } else {
    for (const [key, entry] of Object.entries(available)) {
      const w = entry.weight / totalRaw;
      weights[key] = w;
      forecastReturn += w * entry.signal;
    }
  }

  return { forecastReturn, weights };
}

/**
 * Estimate total forecast standard deviation combining market-level
 * uncertainty, sentiment uncertainty, and a 20% model-uncertainty buffer.
 */
export function computeVariance(
  markets: MarketInput[],
  pmWeight: number,
  sentWeight: number,
  sentSignal: number,
): number {
  if (markets.length === 0) {
    return 0.05; // default 5% uncertainty when no markets
  }

  // Total quality weight across markets (for normalisation).
  const weights = markets.map((m) => computeMarketQualityWeight(m));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Variance of the quality-weighted PM signal.
  let variancePmMarkets = 0;
  for (let i = 0; i < markets.length; i++) {
    const m = markets[i]!;
    const pAdj = adjustYesBias(m.probability);
    const normW = totalWeight > 0 ? weights[i]! / totalWeight : 0;
    const spread = m.deltaYes - m.deltaNo;
    variancePmMarkets += normW * normW * pAdj * (1 - pAdj) * spread * spread;
  }

  // Sentiment variance — assume ±4% std for full bullish/bearish unit.
  const varianceSent = (sentWeight * 0.04) ** 2;

  // Combine and apply 20% model-uncertainty buffer.
  const varianceCombined = pmWeight ** 2 * variancePmMarkets + varianceSent;
  return Math.sqrt(varianceCombined) * 1.2;
}

/**
 * 95% confidence interval around the forecast price using 1.96σ.
 */
export function computeCI(
  forecastPrice: number,
  sigma: number,
): { low: number; high: number } {
  return {
    low: forecastPrice * (1 - 1.96 * sigma),
    high: forecastPrice * (1 + 1.96 * sigma),
  };
}

/**
 * Composite quality score in [0, 100].
 *
 * Combines market breadth, average quality, forecast precision, signal
 * diversity, and absence of whale activity.
 */
export function computeQualityScore(
  markets: MarketInput[],
  avgQuality: number,
  sigma: number,
  signalsWithData: number,
  whaleCount: number,
): number {
  const s1 = 30 * Math.min(markets.length, 5) / 5;
  const s2 = 25 * avgQuality;
  const s3 = 20 * Math.max(0, 1 - sigma / 0.20);
  const s4 = 15 * (signalsWithData / 4);
  const s5 = markets.length > 0 ? 10 * (1 - whaleCount / markets.length) : 0;
  return Math.round(Math.min(100, Math.max(0, s1 + s2 + s3 + s4 + s5)));
}

/**
 * Convert a numeric quality score to a letter grade.
 */
export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

/**
 * End-to-end ensemble forecast.
 *
 * Given a current asset price, a set of Polymarket markets, and optional
 * auxiliary signals, returns a full EnsembleResult including forecast price,
 * confidence interval, quality score, and diagnostic metadata.
 */
export function runEnsemble(
  currentPrice: number,
  markets: MarketInput[],
  others: OtherSignals,
): EnsembleResult {
  // Step 1: Aggregate Polymarket signal.
  const { signal: pmSignal, avgQuality, warnings } = computePolymarketSignal(markets);

  // Step 2: Blend with auxiliary signals.
  const { forecastReturn, weights } = computeEnsemble(pmSignal, avgQuality, others);

  // Step 3: Forecast price.
  const forecastPrice = currentPrice * (1 + forecastReturn);

  // Step 4: Uncertainty.
  const rawSigma = computeVariance(
    markets,
    weights['pm'] ?? 0,
    weights['sentiment'] ?? 0,
    others.sentimentScore ?? 0,
  );

  // Apply a minimum sigma floor based on horizon length.
  // Prediction-market variance only captures event-resolution uncertainty, not
  // general market volatility. A 10% annualised floor prevents implausibly tight
  // CIs when market probabilities are extreme (P≈0.03 makes P×(1-P) ≈ 0.03).
  const horizonFrac = Math.max(1, others.horizonDays ?? 7) / 252;
  const sigmaFloor = 0.10 * Math.sqrt(horizonFrac); // 10% annual floor scaled to horizon
  const sigma = Math.max(sigmaFloor, rawSigma);

  // Step 5: Confidence interval.
  const { low, high } = computeCI(forecastPrice, sigma);

  // Step 6: Count available signals.
  const signalsWithData =
    (markets.length > 0 ? 1 : 0) +
    (others.sentimentScore !== undefined && !Number.isNaN(others.sentimentScore) ? 1 : 0) +
    (others.fundamentalReturn !== undefined && !Number.isNaN(others.fundamentalReturn) ? 1 : 0) +
    (others.optionsSkew !== undefined && !Number.isNaN(others.optionsSkew) ? 1 : 0);

  // Step 7: Whale count.
  const whaleCount = markets.filter((m) => m.priceSpikeDetected).length;

  // Step 8-9: Quality.
  const qualityScore = computeQualityScore(markets, avgQuality, sigma, signalsWithData, whaleCount);
  const qualityGrade = scoreToGrade(qualityScore);

  return {
    forecastReturn,
    forecastPrice,
    ciLow95: low,
    ciHigh95: high,
    sigma,
    qualityScore,
    qualityGrade,
    pmSignal,
    pmEffectiveWeight: 0.40 * avgQuality,
    avgMarketQuality: avgQuality,
    warnings,
  };
}
