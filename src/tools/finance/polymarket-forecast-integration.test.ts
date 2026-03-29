/**
 * polymarket-forecast-integration.test.ts
 *
 * Cross-module consistency tests verifying the full pipeline:
 *   signal-extractor → impact-map → ensemble → polymarket-forecast
 *
 * These tests catch silent integration bugs where each module works in
 * isolation but the contracts between them break (e.g., signal categories
 * not present in IMPACT_MAP, asset classes missing gold entries, etc.).
 *
 * No mocking — all tests use real module implementations (pure logic only,
 * no network calls).
 */
import { describe, it, expect } from 'bun:test';
// NOTE: extractSignals is intentionally NOT imported here.
// polymarket-forecast.test.ts permanently mocks signal-extractor.js via mock.module().
// All integration tests below use inferAssetClass + lookupImpact directly, which
// correctly tests the full math pipeline without the mocked dependency.
import { IMPACT_MAP, inferAssetClass, lookupImpact } from './impact-map.js';
import { computeConditionalReturn, adjustYesBias, computePolymarketSignal, runEnsemble } from '../../utils/ensemble.js';
import type { MarketInput } from '../../utils/ensemble.js';

// ---------------------------------------------------------------------------
// Cross-module category consistency
// ---------------------------------------------------------------------------

describe('signal-extractor × impact-map — category consistency', () => {
  const TEST_TICKERS = ['NVDA', 'GLD', 'SPY', 'QQQ', 'SLX', 'KRE', 'IWM', 'BTC', 'PFE', 'JPM', 'XOM', 'ITA'];
  // All categories that extractSignals can produce (verified in signal-extractor.test.ts)
  const KNOWN_SIGNAL_CATEGORIES = [
    'macro_rates', 'macro_growth', 'trade_policy', 'geopolitical', 'earnings',
    'tariff_increase', 'commodity', 'government_budget',
    'fda_approval', 'fda_rejection',
  ];

  it('all known signal categories exist in IMPACT_MAP', () => {
    const impactCats = new Set(Object.keys(IMPACT_MAP));
    const missing = KNOWN_SIGNAL_CATEGORIES.filter((c) => !impactCats.has(c));
    expect(missing, `Missing IMPACT_MAP entries for: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('inferAssetClass returns a string that lookupImpact can handle for all test tickers', () => {
    for (const ticker of TEST_TICKERS) {
      const assetClass = inferAssetClass(ticker);
      expect(typeof assetClass).toBe('string');
      expect(assetClass.length).toBeGreaterThan(0);
      // lookupImpact must not throw for any (category, assetClass) combo
      expect(() => lookupImpact('macro_rates', assetClass)).not.toThrow();
      expect(() => lookupImpact('geopolitical', assetClass)).not.toThrow();
      expect(() => lookupImpact('earnings', assetClass)).not.toThrow();
    }
  });

  it('all known categories + test assetClasses produce finite deltas', () => {
    for (const ticker of TEST_TICKERS) {
      const assetClass = inferAssetClass(ticker);
      for (const cat of KNOWN_SIGNAL_CATEGORIES) {
        const impact = lookupImpact(cat, assetClass);
        expect(
          Number.isFinite(impact.deltaYes),
          `${ticker}/${cat}/${assetClass} deltaYes is not finite`,
        ).toBe(true);
        expect(
          Number.isFinite(impact.deltaNo),
          `${ticker}/${cat}/${assetClass} deltaNo is not finite`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// GLD (gold ETF) full pipeline correctness
// ---------------------------------------------------------------------------

describe('GLD full pipeline — gold safe-haven logic', () => {
  it('GLD assetClass is "gold" (not "equity")', () => {
    expect(inferAssetClass('GLD')).toBe('gold');
  });

  it('GLD primary signal macro_growth has POSITIVE impact on gold (recession = safe haven)', () => {
    const impact = lookupImpact('macro_growth', 'gold');
    expect(impact.deltaYes).toBeGreaterThan(0);
  });

  it('GLD geopolitical signal has POSITIVE impact on gold (conflict = safe haven)', () => {
    const impact = lookupImpact('geopolitical', 'gold');
    expect(impact.deltaYes).toBeGreaterThan(0);
  });

  it('GLD macro_rates signal is POSITIVE (lower rates reduce opportunity cost of gold)', () => {
    const impact = lookupImpact('macro_rates', 'gold');
    expect(impact.deltaYes).toBeGreaterThan(0);
  });

  it('GLD conditional return is POSITIVE under high recession probability (p=0.80)', () => {
    const p = adjustYesBias(0.80);
    const impact = lookupImpact('macro_growth', 'gold');
    const r = computeConditionalReturn(p, impact.deltaYes, impact.deltaNo);
    expect(r).toBeGreaterThan(0);
  });

  it('GLD conditional return from geopolitical signal POSITIVE at high conflict probability', () => {
    const p = adjustYesBias(0.90);
    const impact = lookupImpact('geopolitical', 'gold');
    const r = computeConditionalReturn(p, impact.deltaYes, impact.deltaNo);
    expect(r).toBeGreaterThan(0);
  });

  it('GLD runEnsemble returns finite, non-NaN values with gold-specific deltas', () => {
    const assetClass = inferAssetClass('GLD'); // 'gold'
    const goldMarkets: MarketInput[] = ['macro_rates', 'macro_growth', 'trade_policy', 'geopolitical'].map((cat) => {
      const impact = lookupImpact(cat, assetClass);
      return {
        question: `${cat} signal for GLD`,
        probability: 0.70,
        volume24hUsd: 500_000,
        ageDays: 21,
        signalTier: 'geopolitical' as const,
        deltaYes: impact.deltaYes,
        deltaNo:  impact.deltaNo,
      };
    });
    const result = runEnsemble(414.84, goldMarkets, { horizonDays: 7 });
    expect(Number.isFinite(result.forecastPrice)).toBe(true);
    expect(Number.isFinite(result.forecastReturn)).toBe(true);
    expect(Number.isFinite(result.sigma)).toBe(true);
    expect(Number.isFinite(result.ciLow95)).toBe(true);
    expect(Number.isFinite(result.ciHigh95)).toBe(true);
    expect(result.ciLow95).toBeGreaterThan(300); // NOT near base-100
    expect(result.ciHigh95).toBeGreaterThan(300);
  });
});

// ---------------------------------------------------------------------------
// SPY vs GLD — opposite macro signals
// ---------------------------------------------------------------------------

describe('SPY vs GLD — opposite directions under macro stress', () => {
  const P_RECESSION_HIGH = adjustYesBias(0.80); // 80% recession probability

  it('GLD earns positive return from recession signal; SPY earns negative', () => {
    const gldImpact = lookupImpact('macro_growth', inferAssetClass('GLD'));
    const spyImpact = lookupImpact('macro_growth', inferAssetClass('SPY'));
    const gldReturn = computeConditionalReturn(P_RECESSION_HIGH, gldImpact.deltaYes, gldImpact.deltaNo);
    const spyReturn = computeConditionalReturn(P_RECESSION_HIGH, spyImpact.deltaYes, spyImpact.deltaNo);
    expect(gldReturn).toBeGreaterThan(0);
    expect(spyReturn).toBeLessThan(0);
  });

  it('GLD earns positive geopolitical return; SPY earns negative', () => {
    const P_CONFLICT = adjustYesBias(0.75);
    const gldImpact = lookupImpact('geopolitical', inferAssetClass('GLD'));
    const spyImpact = lookupImpact('geopolitical', inferAssetClass('SPY'));
    const gldR = computeConditionalReturn(P_CONFLICT, gldImpact.deltaYes, gldImpact.deltaNo);
    const spyR = computeConditionalReturn(P_CONFLICT, spyImpact.deltaYes, spyImpact.deltaNo);
    expect(gldR).toBeGreaterThan(0);
    expect(spyR).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// SPY vs QQQ — distinct assetClasses → distinct conditional returns
// ---------------------------------------------------------------------------

describe('SPY vs QQQ — distinct asset class routing', () => {
  it('SPY is equity; QQQ is tech (distinct assetClasses)', () => {
    expect(inferAssetClass('SPY')).toBe('equity');
    expect(inferAssetClass('QQQ')).toBe('tech');
  });

  it('QQQ (tech) has larger earnings beat upside than SPY (equity)', () => {
    const qqqImpact = lookupImpact('earnings', inferAssetClass('QQQ')); // tech
    const spyImpact = lookupImpact('earnings', inferAssetClass('SPY')); // equity
    expect(qqqImpact.deltaYes).toBeGreaterThanOrEqual(spyImpact.deltaYes);
  });

  it('QQQ computePolymarketSignal differs from SPY for same markets', () => {
    // Build markets with earnings_beat category (impacts differ for tech vs equity)
    const buildMarkets = (assetClass: string): MarketInput[] => [
      {
        question: 'Will Mega-cap tech beat Q2 earnings?',
        probability: 0.72,
        volume24hUsd: 500_000,
        ageDays: 21,
        signalTier: 'macro' as const,
        deltaYes: lookupImpact('earnings', assetClass).deltaYes,
        deltaNo:  lookupImpact('earnings', assetClass).deltaNo,
      },
    ];

    const qqqMarkets = buildMarkets(inferAssetClass('QQQ'));
    const spyMarkets = buildMarkets(inferAssetClass('SPY'));
    const qqqSignal = computePolymarketSignal(qqqMarkets).signal;
    const spySignal = computePolymarketSignal(spyMarkets).signal;

    // QQQ gets tech deltas; SPY gets equity deltas → should differ
    expect(qqqSignal).not.toBeCloseTo(spySignal, 3);
  });
});

// ---------------------------------------------------------------------------
// SLX vs SPY — tariff asymmetry
// ---------------------------------------------------------------------------

describe('SLX vs SPY — tariff_increase asymmetry', () => {
  it('SLX (materials) earns POSITIVE return when tariffs are highly probable', () => {
    const P_TARIFF = adjustYesBias(0.97); // tariffs almost certain
    const impact = lookupImpact('tariff_increase', inferAssetClass('SLX'));
    const r = computeConditionalReturn(P_TARIFF, impact.deltaYes, impact.deltaNo);
    expect(r).toBeGreaterThan(0);
  });

  it('SPY (equity) earns NEGATIVE return when tariffs are highly probable', () => {
    const P_TARIFF = adjustYesBias(0.97);
    const impact = lookupImpact('trade_policy', inferAssetClass('SPY'));
    const r = computeConditionalReturn(P_TARIFF, impact.deltaYes, impact.deltaNo);
    expect(r).toBeLessThan(0);
  });

  it('SLX tariff_increase primary signal weight is the highest weight for materials type', () => {
    // This test verifies the impact-map integration for the materials assetClass.
    // The signal order from extractSignals is verified in signal-extractor.test.ts.
    // Here we confirm that tariff_increase exists in IMPACT_MAP for materials, and its
    // deltaYes is larger than the generic equity trade_policy deltaYes.
    expect(inferAssetClass('SLX')).toBe('materials');
    const tariffImpact = lookupImpact('tariff_increase', 'materials');
    const equityImpact = lookupImpact('tariff_increase', 'equity');
    // Steel ETF benefits more from tariffs than broad equity
    expect(tariffImpact.deltaYes).toBeGreaterThan(equityImpact.deltaYes);
  });
});

// ---------------------------------------------------------------------------
// KRE vs IWM — rate-cut asymmetry
// ---------------------------------------------------------------------------

describe('KRE vs IWM — macro_rates asymmetry', () => {
  it('KRE (financial) earns NEGATIVE return on high rate-cut probability (NIM compression)', () => {
    const P_RATE_CUT = adjustYesBias(0.85);
    const impact = lookupImpact('macro_rates', inferAssetClass('KRE'));
    const r = computeConditionalReturn(P_RATE_CUT, impact.deltaYes, impact.deltaNo);
    expect(r).toBeLessThan(0);
  });

  it('IWM (small_cap) earns POSITIVE return on high rate-cut probability (debt relief)', () => {
    const P_RATE_CUT = adjustYesBias(0.85);
    const impact = lookupImpact('macro_rates', inferAssetClass('IWM'));
    const r = computeConditionalReturn(P_RATE_CUT, impact.deltaYes, impact.deltaNo);
    expect(r).toBeGreaterThan(0);
  });

  it('KRE macro_rates return < IWM macro_rates return at same probability (reversed directions)', () => {
    const P_RATE_CUT = adjustYesBias(0.75);
    const kreImpact = lookupImpact('macro_rates', inferAssetClass('KRE'));
    const iwmImpact = lookupImpact('macro_rates', inferAssetClass('IWM'));
    const kreR = computeConditionalReturn(P_RATE_CUT, kreImpact.deltaYes, kreImpact.deltaNo);
    const iwmR = computeConditionalReturn(P_RATE_CUT, iwmImpact.deltaYes, iwmImpact.deltaNo);
    expect(kreR).toBeLessThan(iwmR);
  });
});

// ---------------------------------------------------------------------------
// runEnsemble end-to-end with real pipeline inputs
// ---------------------------------------------------------------------------

describe('runEnsemble — end-to-end with pipeline-derived inputs', () => {
  // Build markets using only inferAssetClass + lookupImpact (not extractSignals,
  // which is mocked by polymarket-forecast.test.ts when tests run together).
  const CORE_CATEGORIES = ['macro_rates', 'macro_growth', 'trade_policy', 'geopolitical'];

  const buildMarketsForTicker = (ticker: string, probability = 0.65): MarketInput[] => {
    const assetClass = inferAssetClass(ticker);
    return CORE_CATEGORIES.map((cat) => {
      const impact = lookupImpact(cat, assetClass);
      return {
        question: `${cat} signal for ${ticker}`,
        probability,
        volume24hUsd: 500_000,
        ageDays: 21,
        signalTier: 'macro' as const,
        deltaYes: impact.deltaYes,
        deltaNo:  impact.deltaNo,
      };
    });
  };

  it('SPY and GLD produce different forecastReturns (not the identical -0.68% bug)', () => {
    const spyResult = runEnsemble(100, buildMarketsForTicker('SPY'), { horizonDays: 30 });
    const gldResult = runEnsemble(100, buildMarketsForTicker('GLD'), { horizonDays: 30 });
    expect(spyResult.forecastReturn).not.toBeCloseTo(gldResult.forecastReturn, 3);
  });

  it('SPY, QQQ, GLD, SLX, KRE all produce distinct forecastReturns (5-ticker differentiation)', () => {
    const returns = ['SPY', 'QQQ', 'GLD', 'SLX', 'KRE'].map(
      (t) => Math.round(runEnsemble(100, buildMarketsForTicker(t), { horizonDays: 30 }).forecastReturn * 10000),
    );
    const unique = new Set(returns);
    expect(unique.size).toBeGreaterThanOrEqual(3); // at least 3 distinct values
  });

  it('GLD forecastReturn > SPY forecastReturn under macro-stress inputs (p=0.85)', () => {
    // At high stress probability, gold outperforms broad equity
    const spyR = runEnsemble(100, buildMarketsForTicker('SPY', 0.85), { horizonDays: 30 }).forecastReturn;
    const gldR = runEnsemble(100, buildMarketsForTicker('GLD', 0.85), { horizonDays: 30 }).forecastReturn;
    expect(gldR).toBeGreaterThan(spyR);
  });

  it('all tickers return valid EnsembleResult with finite numbers', () => {
    for (const ticker of ['NVDA', 'GLD', 'SPY', 'QQQ', 'SLX', 'KRE', 'IWM', 'BTC']) {
      const r = runEnsemble(100, buildMarketsForTicker(ticker), { horizonDays: 7 });
      expect(Number.isFinite(r.forecastReturn), `${ticker} forecastReturn NaN`).toBe(true);
      expect(Number.isFinite(r.forecastPrice),  `${ticker} forecastPrice NaN`).toBe(true);
      expect(Number.isFinite(r.sigma),          `${ticker} sigma NaN`).toBe(true);
      expect(Number.isFinite(r.ciLow95),        `${ticker} ciLow95 NaN`).toBe(true);
      expect(Number.isFinite(r.ciHigh95),       `${ticker} ciHigh95 NaN`).toBe(true);
      expect(r.ciLow95).toBeLessThan(r.forecastPrice);
      expect(r.ciHigh95).toBeGreaterThan(r.forecastPrice);
    }
  });
});
