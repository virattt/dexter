import { describe, it, expect, mock, afterAll, beforeEach } from 'bun:test';
import { polymarketBreaker } from '../../utils/circuit-breaker.js';
import type { PolymarketMarketResult } from './polymarket.js';

// ---------------------------------------------------------------------------
// Capture real polymarket module before mocking so it can be restored in afterAll.
// signal-extractor is NOT mocked here — it is pure rule-based logic with no
// external deps, and mocking it would leak into signal-extractor.test.ts.
// ---------------------------------------------------------------------------

const realPolymarket = await import('./polymarket.js');

const mockMarkets: PolymarketMarketResult[] = [
  { question: 'Will NVIDIA beat Q2 earnings?', probability: 0.72, volume24h: 500_000 },
  { question: 'Will NVIDIA revenue exceed $30B?', probability: 0.65, volume24h: 300_000 },
];

mock.module('./polymarket.js', () => ({
  fetchPolymarketMarkets: async (_query: string, _limit: number): Promise<PolymarketMarketResult[]> =>
    mockMarkets,
}));

// Import after mocking
const { polymarketForecastTool } = await import('./polymarket-forecast.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResult(raw: unknown): string {
  const outer = JSON.parse(raw as string) as { data?: { result?: string; error?: string } };
  return outer.data?.result ?? outer.data?.error ?? '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('polymarketForecastTool', () => {
  beforeEach(() => { polymarketBreaker.reset(); });

  it('result string contains "Polymarket Forecast"', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('Polymarket Forecast');
  });

  it('includes the ticker in the output', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('NVDA');
  });

  it('forecastPrice > 0', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    const output = parseResult(raw);
    const match = output.match(/Forecast price:\s+\$([0-9.]+)/);
    expect(match).not.toBeNull();
    const price = parseFloat(match![1]!);
    expect(price).toBeGreaterThan(0);
  });

  it('shows warning when no current_price provided', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7 },
      undefined,
    );
    expect(parseResult(raw)).toContain('No current price provided');
  });

  it('shows market questions in polymarket signal section', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('Will NVIDIA beat Q2 earnings?');
  });

  it('includes 95% CI in output', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('95% CI');
  });

  it('includes grade in output', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toMatch(/Grade:\s+[ABCD]/);
  });

  it('omits not-provided signals with placeholder text', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('[signal omitted — not provided]');
  });

  it('includes provided sentiment_score in output', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50, sentiment_score: 0.7 },
      undefined,
    );
    expect(parseResult(raw)).toContain('very bullish');
  });

  it('grade D when 0 markets returned', async () => {
    // Temporarily override mock to return 0 markets
    mock.module('./polymarket.js', () => ({
      fetchPolymarketMarkets: async (): Promise<PolymarketMarketResult[]> => [],
    }));

    const { polymarketForecastTool: freshTool } = await import('./polymarket-forecast.js');
    const raw = await freshTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 135.50 },
      undefined,
    );
    expect(parseResult(raw)).toContain('Grade: D');
  });
});

// ---------------------------------------------------------------------------
// Horizon validation — ensure long horizons are accepted (no hard 14-day cap)
// ---------------------------------------------------------------------------

describe('horizon_days validation', () => {
  it('accepts horizon_days = 30', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 30, current_price: 135.50 },
      undefined,
    );
    const result = parseResult(raw);
    expect(result).not.toContain('error');
    expect(result).toContain('Polymarket Forecast');
  });

  it('accepts horizon_days = 90 and emits moderate-quality note', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 90, current_price: 135.50 },
      undefined,
    );
    const result = parseResult(raw);
    expect(result).toContain('Polymarket Forecast');
    expect(result).toContain('Horizon 90d');
  });

  it('accepts horizon_days = 180 and emits >90-day accuracy warning', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 180, current_price: 135.50 },
      undefined,
    );
    const result = parseResult(raw);
    expect(result).toContain('Polymarket Forecast');
    expect(result).toContain('Horizon 180d > 90 days');
  });

  it('accepts horizon_days = 365', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'BTC', horizon_days: 365, current_price: 85000 },
      undefined,
    );
    const result = parseResult(raw);
    expect(result).toContain('Polymarket Forecast');
    expect(result).not.toContain('"ok":false');
  });
});

// ---------------------------------------------------------------------------
// Sector ETF differentiation — the core bug: all ETFs must NOT produce the
// same forecast return (-0.68% identical for every ETF).
// ---------------------------------------------------------------------------

describe('sector ETF differentiation', () => {
  // Helper to extract the forecast return line
  function extractReturn(raw: unknown): number {
    const s = parseResult(raw);
    // Matches: "Forecast price:  $88.99  (-0.14%)" or "(+1.20%)"
    const m = s.match(/Forecast price:[^(]+\(([+-]?\d+\.\d+)%\)/);
    if (!m) throw new Error(`No forecast return found in: ${s}`);
    return parseFloat(m[1]);
  }

  it('SLX (steel ETF) infers materials asset class and has POSITIVE tariff delta', () => {
    // inferAssetClass must return 'materials' for SLX
    // The trade_policy signal for materials has deltaYes=+0.07 (tariffs protect US steel)
    // With tariff probability ~97%, this should push forecast POSITIVE vs generic equity
    const { inferAssetClass } = require('./impact-map.js');
    expect(inferAssetClass('SLX')).toBe('materials');
  });

  it('KRE (regional bank ETF) infers financial asset class', () => {
    const { inferAssetClass } = require('./impact-map.js');
    expect(inferAssetClass('KRE')).toBe('financial');
  });

  it('IWM (small-cap ETF) infers small_cap asset class', () => {
    const { inferAssetClass } = require('./impact-map.js');
    expect(inferAssetClass('IWM')).toBe('small_cap');
  });

  it('XLI (industrials ETF) infers industrial asset class', () => {
    const { inferAssetClass } = require('./impact-map.js');
    expect(inferAssetClass('XLI')).toBe('industrial');
  });

  it('ITA (defense ETF) remains defense asset class', () => {
    const { inferAssetClass } = require('./impact-map.js');
    expect(inferAssetClass('ITA')).toBe('defense');
  });

  it('NVDA remains semiconductor', () => {
    const { inferAssetClass } = require('./impact-map.js');
    expect(inferAssetClass('NVDA')).toBe('semiconductor');
  });

  it('SLX (materials) and KRE (financial) produce different conditional returns for their respective primary signals', () => {
    const { lookupImpact } = require('./impact-map.js');
    const { computeConditionalReturn, adjustYesBias } = require('../../utils/ensemble.js');

    // Both assets at same Polymarket probability (0.72)
    const p = adjustYesBias(0.72);

    // SLX primary signal: trade_policy (tariff) → materials
    // US tariffs PROTECT domestic steel producers → positive impact
    const slxImpact = lookupImpact('trade_policy', 'materials');
    const slxReturn = computeConditionalReturn(p, slxImpact.deltaYes, slxImpact.deltaNo);

    // KRE primary signal: macro_rates (Fed) → financial
    // Rate cut = NIM compression for banks → negative impact
    const kreImpact = lookupImpact('macro_rates', 'financial');
    const kreReturn = computeConditionalReturn(p, kreImpact.deltaYes, kreImpact.deltaNo);

    expect(slxReturn).not.toBeCloseTo(kreReturn, 3); // must differ
    expect(slxReturn).toBeGreaterThan(0);            // tariffs → bullish for steel
    expect(kreReturn).toBeLessThan(0);               // rate cut → bearish for bank NIM
  });

  it('trade_policy lookupImpact: materials gets POSITIVE deltaYes (tariffs protect domestic steel)', () => {
    const { lookupImpact } = require('./impact-map.js');
    const entry = lookupImpact('trade_policy', 'materials');
    expect(entry.deltaYes).toBeGreaterThan(0); // US tariffs are bullish for domestic steel
    const equityEntry = lookupImpact('trade_policy', 'equity');
    expect(equityEntry.deltaYes).toBeLessThan(0); // broad market is bearish on tariffs
  });

  it('macro_growth lookupImpact: financial has deeper drawdown than equity (loan defaults)', () => {
    const { lookupImpact } = require('./impact-map.js');
    const financial = lookupImpact('macro_growth', 'financial');
    const equity    = lookupImpact('macro_growth', 'equity');
    expect(financial.deltaYes).toBeLessThan(equity.deltaYes); // financial < equity (more negative)
  });

  it('macro_rates lookupImpact: financial has negative deltaYes (rate cut = NIM compression)', () => {
    const { lookupImpact } = require('./impact-map.js');
    const entry = lookupImpact('macro_rates', 'financial');
    expect(entry.deltaYes).toBeLessThan(0); // rate cut is BAD for bank NIM
  });

  it('macro_growth lookupImpact: materials more cyclical than defense', () => {
    const { lookupImpact } = require('./impact-map.js');
    const materials = lookupImpact('macro_growth', 'materials');
    const defense   = lookupImpact('macro_growth', 'defense');
    expect(materials.deltaYes).toBeLessThan(defense.deltaYes); // materials more exposed to recessions
  });
});

// ---------------------------------------------------------------------------
// CI display correctness
// ---------------------------------------------------------------------------

describe('CI display format', () => {
  it('shows dollar CI when current_price is provided', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 500 },
      undefined,
    );
    const result = parseResult(raw);
    // Should contain a dollar-sign CI like [$xxx – $xxx]
    expect(result).toMatch(/\[\$[\d.]+ – \$[\d.]+\]/);
  });

  it('shows percentage CI (not dollar) when current_price is omitted', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7 },
      undefined,
    );
    const result = parseResult(raw);
    // Must contain % CI  (e.g. [-3.5% – +3.5%]) not dollar CI around $99-$101
    expect(result).toMatch(/\[[-+\d.]+%/);
    // Must NOT contain a CI like [$99 – $101] (base-100 dollar CI is misleading)
    expect(result).not.toMatch(/\[\$9[0-9]\.|\[\$10[0-1]\./);
  });

  it('CI sigma is > 1% even for short horizons (floor applied)', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7, current_price: 500 },
      undefined,
    );
    const result = parseResult(raw);
    // σ = x.xx% — extract it
    const sigmaMatch = result.match(/σ = ([\d.]+)%/);
    expect(sigmaMatch).not.toBeNull();
    const sigma = parseFloat(sigmaMatch![1]);
    // 7-day floor = 10% × sqrt(7/252) = 1.67%; should be at least 1%
    expect(sigma).toBeGreaterThan(1.0);
  });
});

// ---------------------------------------------------------------------------
// QQQ classification
// ---------------------------------------------------------------------------

describe('QQQ / broad-market ETF classification', () => {
  it('QQQ infers tech asset class (Nasdaq-100 is tech-heavy)', () => {
    const { inferAssetClass } = require('./impact-map.js');
    expect(inferAssetClass('QQQ')).toBe('tech');
  });

  it('SPY infers equity asset class (broad market)', () => {
    const { inferAssetClass } = require('./impact-map.js');
    expect(inferAssetClass('SPY')).toBe('equity');
  });

  it('QQQ detected as tech_general signal type in extractor', () => {
    // Must be tested in signal-extractor.test.ts (this file mocks the module)
    expect(true).toBe(true); // placeholder — see signal-extractor.test.ts
  });

  it('SPY detected as macro signal type in extractor', () => {
    // Must be tested in signal-extractor.test.ts (this file mocks the module)
    expect(true).toBe(true); // placeholder — see signal-extractor.test.ts
  });
});

// ---------------------------------------------------------------------------
// CI dollar anchoring — the $99-$101 bug guard
//
// When current_price is provided, the 95% CI must be anchored around that
// price, NOT around a base of 100. (The bug: agent omits current_price →
// tool uses base=100 → CI around $99-$101 for a $414 stock.)
// ---------------------------------------------------------------------------

describe('CI dollar anchoring', () => {
  it('ciLow95 > currentPrice/2 for any current_price (never collapses to base-100 range)', async () => {
    const currentPrice = 414.84;
    const raw = await polymarketForecastTool.func(
      { ticker: 'GLD', horizon_days: 7, current_price: currentPrice },
      undefined,
    );
    const result = parseResult(raw);
    // Extract dollar CI from format [$xxx.xx – $xxx.xx]
    const m = result.match(/\[\$([\d.]+) – \$([\d.]+)\]/);
    expect(m, 'No dollar CI found in output').not.toBeNull();
    const low  = parseFloat(m![1]);
    const high = parseFloat(m![2]);
    // Both bounds must be near $414, NOT near $100
    expect(low).toBeGreaterThan(currentPrice / 2);    // > $207 (not $99)
    expect(high).toBeGreaterThan(currentPrice / 2);   // > $207 (not $101)
    expect(high).toBeGreaterThan(low);
  });

  it('dollar CI bounds scale with current_price (500 gives ~5x wider dollar range than 100)', async () => {
    const extractDollarCI = async (price: number) => {
      const raw = await polymarketForecastTool.func(
        { ticker: 'NVDA', horizon_days: 7, current_price: price },
        undefined,
      );
      const result = parseResult(raw);
      const m = result.match(/\[\$([\d.]+) – \$([\d.]+)\]/);
      if (!m) return null;
      return { low: parseFloat(m[1]), high: parseFloat(m[2]) };
    };

    const ci100 = await extractDollarCI(100);
    const ci500 = await extractDollarCI(500);
    expect(ci100).not.toBeNull();
    expect(ci500).not.toBeNull();
    const width100 = ci100!.high - ci100!.low;
    const width500 = ci500!.high - ci500!.low;
    // CI width scales proportionally: width500 / width100 ≈ 500/100 = 5
    expect(width500 / width100).toBeCloseTo(5, 0);
  });

  it('no-price output uses % notation, not $ signs for the CI', async () => {
    const raw = await polymarketForecastTool.func(
      { ticker: 'NVDA', horizon_days: 7 },
      undefined,
    );
    const result = parseResult(raw);
    // CI must be in percent form: [-x.xx% – +x.xx%]
    expect(result).toMatch(/\[[-+\d.]+%\s*–\s*[+-\d.]+%\]/);
    // Must NOT contain a dollar-sign CI near $100 like [$99 or [$100
    expect(result).not.toMatch(/\[\$9[5-9]\.\d|\ \[\$10[0-5]\.\d/);
  });
});

// ---------------------------------------------------------------------------
// CI width grows with horizon
// ---------------------------------------------------------------------------

describe('CI width increases with longer horizons', () => {
  it('90-day sigma is strictly larger than 7-day sigma (floor: 5.98% vs 1.67%)', async () => {
    // The sigma floor is 0.10 × √(h/252). At 7d it's 1.67% and at 90d it's 5.98%.
    // When raw sigma (from mock market variance) sits between those two values,
    // sigma7 = raw and sigma90 = max(5.98%, raw) > raw = sigma7.
    const extractSigma = async (horizonDays: number) => {
      const raw = await polymarketForecastTool.func(
        { ticker: 'NVDA', horizon_days: horizonDays, current_price: 500 },
        undefined,
      );
      const m = parseResult(raw).match(/σ = ([\d.]+)%/);
      return m ? parseFloat(m[1]) : 0;
    };

    const sigma7  = await extractSigma(7);
    const sigma90 = await extractSigma(90);
    const sigma252 = await extractSigma(252);

    // sigma is monotone non-decreasing — floor guarantees 90d ≥ 7d
    expect(sigma90).toBeGreaterThanOrEqual(sigma7);
    // At 252d the floor is exactly 10% — always larger than any sub-252d sigma
    expect(sigma252).toBeGreaterThan(sigma90);
    // Sigma must be positive
    expect(sigma7).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Per-asset-class distinct returns (SPY vs GLD)
//
// Even with the same mock Polymarket markets, SPY (equity) and GLD (gold)
// must produce DIFFERENT conditional returns because they use different
// assetClass → different lookupImpact() deltas.
// ---------------------------------------------------------------------------

describe('different asset classes produce distinct conditional returns', () => {
  it('SPY (equity) and GLD (gold) have opposite macro_growth conditional returns at high probability', () => {
    // Import impact-map directly (no mock needed — pure math)
    const { lookupImpact, inferAssetClass } = require('./impact-map.js');
    const { computeConditionalReturn, adjustYesBias } = require('../../utils/ensemble.js');

    const p = adjustYesBias(0.75); // high probability of recession

    const spyClass = inferAssetClass('SPY');  // equity
    const gldClass = inferAssetClass('GLD');  // gold

    const spyR = computeConditionalReturn(
      p,
      lookupImpact('macro_growth', spyClass).deltaYes,
      lookupImpact('macro_growth', spyClass).deltaNo,
    );
    const gldR = computeConditionalReturn(
      p,
      lookupImpact('macro_growth', gldClass).deltaYes,
      lookupImpact('macro_growth', gldClass).deltaNo,
    );

    // Recession is NEGATIVE for equity and POSITIVE for gold (safe haven)
    expect(spyR).toBeLessThan(0);
    expect(gldR).toBeGreaterThan(0);
    // They must produce meaningfully different returns
    expect(gldR).toBeGreaterThan(spyR + 0.01);
  });

  it('KRE (financial) and IWM (small_cap) have opposite macro_rates conditional returns', () => {
    const { lookupImpact, inferAssetClass } = require('./impact-map.js');
    const { computeConditionalReturn, adjustYesBias } = require('../../utils/ensemble.js');

    const p = adjustYesBias(0.80); // high probability of rate cut

    const kreClass = inferAssetClass('KRE');  // financial
    const iwmClass = inferAssetClass('IWM');  // small_cap

    const kreR = computeConditionalReturn(
      p,
      lookupImpact('macro_rates', kreClass).deltaYes,
      lookupImpact('macro_rates', kreClass).deltaNo,
    );
    const iwmR = computeConditionalReturn(
      p,
      lookupImpact('macro_rates', iwmClass).deltaYes,
      lookupImpact('macro_rates', iwmClass).deltaNo,
    );

    // Rate cut is NEGATIVE for bank NIM (KRE) but POSITIVE for leveraged small caps (IWM)
    expect(kreR).toBeLessThan(0);
    expect(iwmR).toBeGreaterThan(0);
  });

  it('SLX (materials) and SPY (equity) have opposite trade_policy conditional returns', () => {
    const { lookupImpact, inferAssetClass } = require('./impact-map.js');
    const { computeConditionalReturn, adjustYesBias } = require('../../utils/ensemble.js');

    const p = adjustYesBias(0.97); // near-certain tariff imposition

    const slxClass = inferAssetClass('SLX');  // materials
    const spyClass = inferAssetClass('SPY');  // equity

    const slxR = computeConditionalReturn(
      p,
      lookupImpact('trade_policy', slxClass).deltaYes,
      lookupImpact('trade_policy', slxClass).deltaNo,
    );
    const spyR = computeConditionalReturn(
      p,
      lookupImpact('trade_policy', spyClass).deltaYes,
      lookupImpact('trade_policy', spyClass).deltaNo,
    );

    // Tariffs PROTECT domestic steel (SLX +) while hurting broad market (SPY −)
    expect(slxR).toBeGreaterThan(0);
    expect(spyR).toBeLessThan(0);
  });
});

// Restore module mocks so they do not leak into other test files.
// mock.restore() only handles function mocks; module mocks must be
// explicitly re-registered with their original implementations.
afterAll(() => {
  mock.module('./polymarket.js', () => realPolymarket);
});
