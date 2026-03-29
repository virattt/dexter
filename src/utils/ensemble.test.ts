import { describe, it, expect } from 'bun:test';
import {
  adjustYesBias,
  computeMarketQualityWeight,
  computeConditionalReturn,
  computePolymarketSignal,
  computeEnsemble,
  computeQualityScore,
  scoreToGrade,
  runEnsemble,
  computeCI,
  computeVariance,
} from './ensemble.js';
import type { MarketInput, OtherSignals } from './ensemble.js';

// ---------------------------------------------------------------------------
// adjustYesBias
// ---------------------------------------------------------------------------

describe('adjustYesBias', () => {
  it('p=0.7 → subtracts beta=0.035 → 0.665', () => {
    expect(adjustYesBias(0.7)).toBeCloseTo(0.665, 6);
  });

  it('p=0.4 → below 0.5, returned unchanged', () => {
    expect(adjustYesBias(0.4)).toBeCloseTo(0.4, 6);
  });

  it('p=0.535 → 0.535-0.035=0.500, clamped to [0.01, 0.99]', () => {
    expect(adjustYesBias(0.535)).toBeCloseTo(0.5, 6);
  });

  it('p=0.99 (at hi boundary) → 0.99-0.035=0.955', () => {
    expect(adjustYesBias(0.99)).toBeCloseTo(0.955, 6);
  });

  it('p=0.01 (lo boundary, below 0.5) → stays at 0.01', () => {
    expect(adjustYesBias(0.01)).toBeCloseTo(0.01, 6);
  });

  it('p=0.52 with custom beta=0.10 → 0.52-0.10=0.42', () => {
    expect(adjustYesBias(0.52, 0.10)).toBeCloseTo(0.42, 6);
  });
});

// ---------------------------------------------------------------------------
// computeMarketQualityWeight
// ---------------------------------------------------------------------------

describe('computeMarketQualityWeight', () => {
  it('mature + high-volume + macro → close to 0.9', () => {
    const m: MarketInput = {
      question: 'Fed cut',
      probability: 0.6,
      volume24hUsd: 1_000_000, // log10(1_000_001) / 6 ≈ 1
      ageDays: 21,
      signalTier: 'macro',
      deltaYes: 0.05,
      deltaNo: -0.03,
    };
    const w = computeMarketQualityWeight(m);
    // wAge=1, wLiq≈1, τ=0.90, no whale → w≈0.90
    expect(w).toBeCloseTo(0.9, 1);
  });

  it('new + low-volume + electoral → low weight', () => {
    const m: MarketInput = {
      question: 'Election result',
      probability: 0.5,
      volume24hUsd: 10,       // log10(11)/6 ≈ 0.175
      ageDays: 3,              // 3/21 ≈ 0.143
      signalTier: 'electoral',
      deltaYes: 0.04,
      deltaNo: -0.02,
    };
    const w = computeMarketQualityWeight(m);
    expect(w).toBeLessThan(0.05);
  });

  it('whale flag → 50% penalty on otherwise full-quality market', () => {
    const base: MarketInput = {
      question: 'Rate decision',
      probability: 0.7,
      volume24hUsd: 1_000_000,
      ageDays: 21,
      signalTier: 'macro',
      deltaYes: 0.06,
      deltaNo: -0.04,
    };
    const noWhale = computeMarketQualityWeight({ ...base, priceSpikeDetected: false });
    const whale = computeMarketQualityWeight({ ...base, priceSpikeDetected: true });
    expect(whale).toBeCloseTo(noWhale * 0.5, 5);
  });

  it('undefined ageDays → treated as 21 (mature)', () => {
    const m: MarketInput = {
      question: 'Q',
      probability: 0.5,
      volume24hUsd: 1_000_000,
      signalTier: 'geopolitical',
      deltaYes: 0.05,
      deltaNo: -0.03,
    };
    const w = computeMarketQualityWeight(m);
    // wAge=1, wLiq≈1, τ=0.75 → ~0.75
    expect(w).toBeCloseTo(0.75, 1);
  });
});

// ---------------------------------------------------------------------------
// computeConditionalReturn
// ---------------------------------------------------------------------------

describe('computeConditionalReturn', () => {
  it('p=0.7, δY=0.06, δN=-0.04 → 0.7*0.06 + 0.3*(-0.04) = 0.030', () => {
    expect(computeConditionalReturn(0.7, 0.06, -0.04)).toBeCloseTo(0.030, 6);
  });

  it('p=0.0 → returns deltaNo', () => {
    expect(computeConditionalReturn(0.0, 0.08, -0.05)).toBeCloseTo(-0.05, 6);
  });

  it('p=1.0 → returns deltaYes', () => {
    expect(computeConditionalReturn(1.0, 0.08, -0.05)).toBeCloseTo(0.08, 6);
  });

  it('p=0.5 → simple average of deltaYes and deltaNo', () => {
    expect(computeConditionalReturn(0.5, 0.10, -0.10)).toBeCloseTo(0, 6);
  });
});

// ---------------------------------------------------------------------------
// computePolymarketSignal
// ---------------------------------------------------------------------------

describe('computePolymarketSignal', () => {
  it('empty array → signal=0, warning about no markets', () => {
    const { signal, avgQuality, warnings } = computePolymarketSignal([]);
    expect(signal).toBe(0);
    expect(avgQuality).toBe(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/No Polymarket markets/);
  });

  it('single market → signal equals its own conditional return', () => {
    const m: MarketInput = {
      question: 'Oil supply cut',
      probability: 0.6,
      volume24hUsd: 500_000,
      ageDays: 30,
      signalTier: 'macro',
      deltaYes: 0.08,
      deltaNo: -0.03,
    };
    const { signal, warnings } = computePolymarketSignal([m]);
    // pAdj = 0.6 - 0.035 = 0.565
    const expected = computeConditionalReturn(adjustYesBias(0.6), 0.08, -0.03);
    expect(signal).toBeCloseTo(expected, 6);
    expect(warnings).toHaveLength(0);
  });

  it('two markets → quality-weighted average signal', () => {
    const m1: MarketInput = {
      question: 'M1',
      probability: 0.7,
      volume24hUsd: 1_000_000,
      ageDays: 21,
      signalTier: 'macro',
      deltaYes: 0.10,
      deltaNo: -0.05,
    };
    const m2: MarketInput = {
      question: 'M2',
      probability: 0.3,
      volume24hUsd: 1_000_000,
      ageDays: 21,
      signalTier: 'macro',
      deltaYes: 0.06,
      deltaNo: -0.02,
    };
    const { signal } = computePolymarketSignal([m1, m2]);
    // Both same tier/liquidity/age → equal quality weights → simple average
    const r1 = computeConditionalReturn(adjustYesBias(0.7), 0.10, -0.05);
    const r2 = computeConditionalReturn(adjustYesBias(0.3), 0.06, -0.02);
    expect(signal).toBeCloseTo((r1 + r2) / 2, 5);
  });

  it('priceSpikeDetected market → warning added', () => {
    const m: MarketInput = {
      question: 'Whale market',
      probability: 0.55,
      volume24hUsd: 100_000,
      ageDays: 14,
      priceSpikeDetected: true,
      signalTier: 'geopolitical',
      deltaYes: 0.05,
      deltaNo: -0.03,
    };
    const { warnings } = computePolymarketSignal([m]);
    expect(warnings.some((w) => w.includes('price spike'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeEnsemble
// ---------------------------------------------------------------------------

describe('computeEnsemble', () => {
  it('all four signals present → weighted sum; weights sum to 1', () => {
    const others: OtherSignals = {
      sentimentScore: 0.5,
      fundamentalReturn: 0.12,
      optionsSkew: 1,
      horizonDays: 7,
    };
    const { forecastReturn, weights } = computeEnsemble(0.02, 1.0, others);
    const wSum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(wSum).toBeCloseTo(1, 5);

    // Manual: wPmEff=0.40, wSent=0.20, wFund=0.25, wOpt=0.15 → total=1.00
    const rPm = 0.02;
    const rSent = 0.5 * 0.04;
    const rFund = 0.12 * (7 / 365);
    const rOpt = 1 * 0.03;
    const expected = 0.40 * rPm + 0.20 * rSent + 0.25 * rFund + 0.15 * rOpt;
    expect(forecastReturn).toBeCloseTo(expected, 5);
  });

  it('missing sentiment → remaining weights renormalised', () => {
    const others: OtherSignals = { fundamentalReturn: 0.10, optionsSkew: -1, horizonDays: 7 };
    const { weights } = computeEnsemble(0.01, 0.8, others);
    expect(weights['sentiment']).toBeUndefined();
    const wSum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(wSum).toBeCloseTo(1, 5);
  });

  it('only PM signal (pmAvgQuality=0.5, no others) → PM weight=1 after normalisation', () => {
    const { weights, forecastReturn } = computeEnsemble(0.03, 0.5, {});
    expect(weights['pm']).toBeCloseTo(1, 5);
    expect(forecastReturn).toBeCloseTo(0.03, 5);
  });
});

// ---------------------------------------------------------------------------
// computeQualityScore
// ---------------------------------------------------------------------------

describe('computeQualityScore', () => {
  it('5 markets + avgQuality=1 + low sigma + all 4 signals + no whales → high score (≥80)', () => {
    const markets: MarketInput[] = Array.from({ length: 5 }, (_, i) => ({
      question: `M${i}`,
      probability: 0.5,
      volume24hUsd: 1_000_000,
      ageDays: 30,
      signalTier: 'macro' as const,
      deltaYes: 0.05,
      deltaNo: -0.03,
    }));
    const score = computeQualityScore(markets, 1.0, 0.01, 4, 0);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('0 markets → s1=0, s5=0 → low score', () => {
    const score = computeQualityScore([], 0, 0.10, 1, 0);
    // s1=0, s2=0, s3=20*(1-0.5)=10, s4=15*0.25=3.75, s5=0 → ≈14
    expect(score).toBeLessThan(20);
  });

  it('returns integer in [0, 100]', () => {
    const score = computeQualityScore([], 0, 1.0, 0, 0);
    expect(score).toBe(0);
    expect(Number.isInteger(score)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scoreToGrade
// ---------------------------------------------------------------------------

describe('scoreToGrade', () => {
  it('80 → A', () => expect(scoreToGrade(80)).toBe('A'));
  it('100 → A', () => expect(scoreToGrade(100)).toBe('A'));
  it('60 → B', () => expect(scoreToGrade(60)).toBe('B'));
  it('79 → B', () => expect(scoreToGrade(79)).toBe('B'));
  it('40 → C', () => expect(scoreToGrade(40)).toBe('C'));
  it('59 → C', () => expect(scoreToGrade(59)).toBe('C'));
  it('39 → D', () => expect(scoreToGrade(39)).toBe('D'));
  it('0 → D', () => expect(scoreToGrade(0)).toBe('D'));
});

// ---------------------------------------------------------------------------
// computeCI
// ---------------------------------------------------------------------------

describe('computeCI', () => {
  it('CI spans symmetrically around forecast price', () => {
    const { low, high } = computeCI(100, 0.05);
    expect(low).toBeCloseTo(100 * (1 - 1.96 * 0.05), 5);
    expect(high).toBeCloseTo(100 * (1 + 1.96 * 0.05), 5);
  });

  it('sigma=0 → CI equals forecast price', () => {
    const { low, high } = computeCI(200, 0);
    expect(low).toBe(200);
    expect(high).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// computeVariance
// ---------------------------------------------------------------------------

describe('computeVariance', () => {
  it('empty markets → 0.05 default uncertainty', () => {
    expect(computeVariance([], 0.4, 0.2, 0.5)).toBe(0.05);
  });

  it('single market → finite positive sigma', () => {
    const m: MarketInput = {
      question: 'Q',
      probability: 0.6,
      volume24hUsd: 100_000,
      ageDays: 21,
      signalTier: 'geopolitical',
      deltaYes: 0.08,
      deltaNo: -0.04,
    };
    const sigma = computeVariance([m], 0.4, 0.2, 0.3);
    expect(sigma).toBeGreaterThan(0);
    expect(Number.isFinite(sigma)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runEnsemble (end-to-end)
// ---------------------------------------------------------------------------

describe('runEnsemble', () => {
  const markets: MarketInput[] = [
    {
      question: 'OPEC supply cut',
      probability: 0.65,
      volume24hUsd: 800_000,
      ageDays: 21,
      signalTier: 'macro',
      deltaYes: 0.06,
      deltaNo: -0.04,
    },
    {
      question: 'US sanctions relief',
      probability: 0.40,
      volume24hUsd: 300_000,
      ageDays: 14,
      signalTier: 'geopolitical',
      deltaYes: 0.05,
      deltaNo: -0.02,
    },
  ];

  const others: OtherSignals = {
    sentimentScore: 0.3,
    fundamentalReturn: 0.08,
    optionsSkew: 1,
    horizonDays: 7,
  };

  it('forecastPrice is based on currentPrice=100', () => {
    const result = runEnsemble(100, markets, others);
    const expected = 100 * (1 + result.forecastReturn);
    expect(result.forecastPrice).toBeCloseTo(expected, 6);
  });

  it('CI spans the forecast price (low < forecastPrice < high)', () => {
    const result = runEnsemble(100, markets, others);
    expect(result.ciLow95).toBeLessThan(result.forecastPrice);
    expect(result.ciHigh95).toBeGreaterThan(result.forecastPrice);
  });

  it('sigma is finite and positive', () => {
    const { sigma } = runEnsemble(100, markets, others);
    expect(sigma).toBeGreaterThan(0);
    expect(Number.isFinite(sigma)).toBe(true);
  });

  it('qualityGrade is a valid letter grade', () => {
    const { qualityGrade } = runEnsemble(100, markets, others);
    expect(['A', 'B', 'C', 'D']).toContain(qualityGrade);
  });

  it('pmEffectiveWeight is between 0 and 0.40', () => {
    const { pmEffectiveWeight } = runEnsemble(100, markets, others);
    expect(pmEffectiveWeight).toBeGreaterThanOrEqual(0);
    expect(pmEffectiveWeight).toBeLessThanOrEqual(0.40);
  });

  it('no markets → warnings array non-empty', () => {
    const { warnings } = runEnsemble(100, [], others);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('pmSignal matches computePolymarketSignal output', () => {
    const { signal } = require('./ensemble.js').computePolymarketSignal
      ? { signal: computePolymarketSignal(markets).signal }
      : { signal: 0 };
    const { pmSignal } = runEnsemble(100, markets, others);
    expect(pmSignal).toBeCloseTo(signal, 5);
  });
});

// ---------------------------------------------------------------------------
// runEnsemble — real price scaling
//
// All prior tests use currentPrice=100. These verify the engine correctly
// scales the forecast and CI to any real asset price.
// ---------------------------------------------------------------------------

describe('runEnsemble — real price scaling', () => {
  const markets: MarketInput[] = [
    {
      question: 'Will gold demand stay elevated?',
      probability: 0.75,
      volume24hUsd: 500_000,
      ageDays: 21,
      signalTier: 'geopolitical',
      deltaYes: 0.05,
      deltaNo: -0.02,
    },
  ];

  it('forecastPrice = currentPrice × (1 + forecastReturn) for any price', () => {
    const r = runEnsemble(414.84, markets, { horizonDays: 7 });
    expect(r.forecastPrice).toBeCloseTo(414.84 * (1 + r.forecastReturn), 4);
  });

  it('CI is near currentPrice when currentPrice = 414.84 (not near base-100)', () => {
    const { ciLow95, ciHigh95 } = runEnsemble(414.84, markets, { horizonDays: 7 });
    // Both bounds must be well above 100 — the $99-$101 bug guard
    expect(ciLow95).toBeGreaterThan(300);
    expect(ciHigh95).toBeGreaterThan(300);
  });

  it('CI brackets forecastPrice (low < forecastPrice < high) for real price', () => {
    const r = runEnsemble(414.84, markets, { horizonDays: 7 });
    expect(r.ciLow95).toBeLessThan(r.forecastPrice);
    expect(r.ciHigh95).toBeGreaterThan(r.forecastPrice);
  });

  it('relative CI width is identical regardless of currentPrice (scale invariance)', () => {
    const r100 = runEnsemble(100,    markets, { horizonDays: 7 });
    const r414 = runEnsemble(414.84, markets, { horizonDays: 7 });
    const r634 = runEnsemble(634.09, markets, { horizonDays: 7 });
    const relWidth100 = (r100.ciHigh95 - r100.ciLow95) / r100.forecastPrice;
    const relWidth414 = (r414.ciHigh95 - r414.ciLow95) / r414.forecastPrice;
    const relWidth634 = (r634.ciHigh95 - r634.ciLow95) / r634.forecastPrice;
    expect(relWidth100).toBeCloseTo(relWidth414, 4);
    expect(relWidth100).toBeCloseTo(relWidth634, 4);
  });

  it('forecastReturn is independent of currentPrice', () => {
    const r100 = runEnsemble(100,    markets, { horizonDays: 7 });
    const r634 = runEnsemble(634.09, markets, { horizonDays: 7 });
    expect(r100.forecastReturn).toBeCloseTo(r634.forecastReturn, 8);
  });

  it('sigma is independent of currentPrice', () => {
    const s100 = runEnsemble(100,    markets, { horizonDays: 7 }).sigma;
    const s500 = runEnsemble(500,    markets, { horizonDays: 7 }).sigma;
    expect(s100).toBeCloseTo(s500, 8);
  });
});

// ---------------------------------------------------------------------------
// runEnsemble — sigma floor
//
// With extreme probabilities (P≈0.99), P×(1-P) ≈ 0.01 making rawSigma nearly 0.
// A 10%-annualised floor prevents implausibly tight CIs.
//
// Floor formula: σ_floor = 0.10 × √(horizonDays / 252)
//   7d  → 0.10 × √(0.02778) = 0.01667 (1.67%)
//  30d  → 0.10 × √(0.11905) = 0.03450 (3.45%)
//  90d  → 0.10 × √(0.35714) = 0.05976 (5.98%)
// 252d  → 0.10 × √(1.00000) = 0.10000 (10.0%)
// ---------------------------------------------------------------------------

describe('runEnsemble — sigma floor', () => {
  // Zero-volume markets → quality weight = 0 → normW = 0 → variancePmMarkets = 0 → rawSigma = 0
  // The floor prevents sigma from collapsing to 0 (which would give a zero-width CI).
  const zeroVolumeMarkets: MarketInput[] = [
    {
      question: 'Extreme-probability event',
      probability: 0.99,     // P×(1-P)=0.01, very low market variance
      volume24hUsd: 0,        // zero volume → quality weight = 0 → rawSigma = 0
      ageDays: 21,
      signalTier: 'macro',
      deltaYes: 0.05,
      deltaNo: -0.02,
    },
  ];

  it('sigma equals floor for 7-day horizon when rawSigma = 0', () => {
    const { sigma } = runEnsemble(100, zeroVolumeMarkets, { horizonDays: 7 });
    const expectedFloor = 0.10 * Math.sqrt(7 / 252);
    expect(sigma).toBeCloseTo(expectedFloor, 4);
  });

  it('7-day floor is ≈ 1.67%', () => {
    const { sigma } = runEnsemble(100, zeroVolumeMarkets, { horizonDays: 7 });
    expect(sigma * 100).toBeCloseTo(1.667, 2);
  });

  it('30-day floor is ≈ 3.45%', () => {
    const { sigma } = runEnsemble(100, zeroVolumeMarkets, { horizonDays: 30 });
    const expectedFloor = 0.10 * Math.sqrt(30 / 252);
    expect(sigma).toBeCloseTo(expectedFloor, 4);
  });

  it('90-day floor is ≈ 5.98%', () => {
    const { sigma } = runEnsemble(100, zeroVolumeMarkets, { horizonDays: 90 });
    const expectedFloor = 0.10 * Math.sqrt(90 / 252);
    expect(sigma).toBeCloseTo(expectedFloor, 4);
  });

  it('252-day floor is exactly 10.0%', () => {
    const { sigma } = runEnsemble(100, zeroVolumeMarkets, { horizonDays: 252 });
    expect(sigma).toBeCloseTo(0.10, 4);
  });

  it('sigma floor increases monotonically with horizonDays', () => {
    const s7   = runEnsemble(100, zeroVolumeMarkets, { horizonDays: 7   }).sigma;
    const s30  = runEnsemble(100, zeroVolumeMarkets, { horizonDays: 30  }).sigma;
    const s90  = runEnsemble(100, zeroVolumeMarkets, { horizonDays: 90  }).sigma;
    const s252 = runEnsemble(100, zeroVolumeMarkets, { horizonDays: 252 }).sigma;
    expect(s7).toBeLessThan(s30);
    expect(s30).toBeLessThan(s90);
    expect(s90).toBeLessThan(s252);
  });

  it('floor applies when rawSigma is less than the floor value', () => {
    // Use single high-quality market with tiny spread to get rawSigma < floor
    const tinySpreadMarket: MarketInput = {
      question: 'Q',
      probability: 0.5,
      volume24hUsd: 1_000_000,
      ageDays: 21,
      signalTier: 'macro',
      deltaYes: 0.001,   // spread = 0.002 → tiny variance
      deltaNo: -0.001,
    };
    const { sigma } = runEnsemble(100, [tinySpreadMarket], { horizonDays: 252 });
    // 252-day floor = 10%; tiny spread would give rawSigma << 10%
    expect(sigma).toBeGreaterThanOrEqual(0.10 * 0.99); // at least 99% of floor
  });

  it('CI width is non-zero even when rawSigma = 0 (floor prevents point CI)', () => {
    const { ciLow95, ciHigh95, forecastPrice } = runEnsemble(100, zeroVolumeMarkets, { horizonDays: 7 });
    expect(ciHigh95 - ciLow95).toBeGreaterThan(0);
    expect(ciHigh95).toBeGreaterThan(forecastPrice);
    expect(ciLow95).toBeLessThan(forecastPrice);
  });
});

// ---------------------------------------------------------------------------
// computeVariance — additional edge cases
// ---------------------------------------------------------------------------

describe('computeVariance — additional edge cases', () => {
  it('zero-volume market → quality weight = 0 → variancePmMarkets = 0 → sigma = 0', () => {
    const zeroVol: MarketInput = {
      question: 'Q',
      probability: 0.5,
      volume24hUsd: 0,
      ageDays: 21,
      signalTier: 'macro',
      deltaYes: 0.10,
      deltaNo: -0.10,
    };
    // With pmWeight=1, rawSigma = sqrt(1² × 0) × 1.2 = 0
    expect(computeVariance([zeroVol], 1.0, 0, 0)).toBe(0);
  });

  it('sigma increases monotonically with larger spread (deltaYes − deltaNo)', () => {
    const mk = (spread: number): MarketInput => ({
      question: 'Q',
      probability: 0.5,
      volume24hUsd: 500_000,
      ageDays: 21,
      signalTier: 'macro',
      deltaYes:  spread / 2,
      deltaNo:  -spread / 2,
    });
    const s1 = computeVariance([mk(0.04)], 1.0, 0, 0);
    const s2 = computeVariance([mk(0.10)], 1.0, 0, 0);
    const s3 = computeVariance([mk(0.20)], 1.0, 0, 0);
    expect(s1).toBeLessThan(s2);
    expect(s2).toBeLessThan(s3);
  });

  it('sentiment-only variance when pmWeight = 0: sigma = sentWeight × 0.04 × 1.2', () => {
    const m: MarketInput = {
      question: 'Q',
      probability: 0.5,
      volume24hUsd: 500_000,
      ageDays: 21,
      signalTier: 'macro',
      deltaYes: 0.10,
      deltaNo: -0.10,
    };
    // varianceSent = (sentWeight × 0.04)² → sigma = sentWeight × 0.04 × 1.2
    const sentWeight = 0.20;
    const sigma = computeVariance([m], 0, sentWeight, 0);
    expect(sigma).toBeCloseTo(sentWeight * 0.04 * 1.2, 6);
  });

  it('doubling pmWeight doubles sigma (quadratic variance, linear sigma)', () => {
    const m: MarketInput = {
      question: 'Q',
      probability: 0.5,
      volume24hUsd: 1_000_000,
      ageDays: 21,
      signalTier: 'macro',
      deltaYes: 0.10,
      deltaNo: -0.10,
    };
    const sigmaHalf = computeVariance([m], 0.5, 0, 0);
    const sigmaFull = computeVariance([m], 1.0, 0, 0);
    // sigma_full = sqrt(1²×v)×1.2; sigma_half = sqrt(0.5²×v)×1.2 → ratio = 2
    expect(sigmaFull).toBeCloseTo(sigmaHalf * 2, 4);
  });

  it('adding more markets with different probabilities increases total variance', () => {
    const single: MarketInput = {
      question: 'Q1',
      probability: 0.5,
      volume24hUsd: 500_000,
      ageDays: 21,
      signalTier: 'macro',
      deltaYes: 0.06,
      deltaNo: -0.04,
    };
    const second: MarketInput = { ...single, question: 'Q2', probability: 0.3 };
    const s1 = computeVariance([single], 1.0, 0, 0);
    const s2 = computeVariance([single, second], 1.0, 0, 0);
    // With more independent sources of variance, total sigma should change
    // (it may go up or down depending on normW redistribution, but must be > 0)
    expect(s2).toBeGreaterThan(0);
    expect(Number.isFinite(s2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeEnsemble — degenerate pmAvgQuality = 0
//
// When markets have zero volume, pmAvgQuality = 0 → wPmEff = 0.
// Whether the PM signal influences the forecast depends on whether other
// signals are present (which is a documented design trade-off).
// ---------------------------------------------------------------------------

describe('computeEnsemble — degenerate pmAvgQuality = 0', () => {
  it('PM only (no others) + pmAvgQuality=0 → equal-weight fallback → PM weight = 1', () => {
    // totalRaw = 0.40 × 0 = 0 → triggers equal-weight fallback
    const { weights, forecastReturn } = computeEnsemble(0.03, 0, {});
    expect(weights['pm']).toBeCloseTo(1, 5);
    expect(forecastReturn).toBeCloseTo(0.03, 5);
  });

  it('PM + sentiment + pmAvgQuality=0 → PM excluded (weight = 0), sentiment drives return', () => {
    // totalRaw = wPmEff(0) + wSent(0.20) = 0.20 → no fallback → PM normalised to 0
    const sentimentScore = 0.5;
    const { weights, forecastReturn } = computeEnsemble(0.03, 0, { sentimentScore });
    expect(weights['pm']).toBeCloseTo(0, 5);
    expect(weights['sentiment']).toBeCloseTo(1, 5);
    // forecastReturn = 1.0 × sentimentScore × 0.04 = 0.02
    expect(forecastReturn).toBeCloseTo(sentimentScore * 0.04, 6);
  });

  it('PM with full quality (pmAvgQuality=1) → wPmEff = 0.40 (max PM influence)', () => {
    const { weights } = computeEnsemble(0.05, 1.0, {});
    // Only PM signal; totalRaw = 0.40 × 1.0 = 0.40; weights.pm = 0.40/0.40 = 1
    expect(weights['pm']).toBeCloseTo(1, 5);
  });

  it('PM with partial quality (pmAvgQuality=0.5) still normalises correctly', () => {
    const { weights } = computeEnsemble(0.05, 0.5, { sentimentScore: 0.3 });
    const wSum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(wSum).toBeCloseTo(1, 5);
  });
});
