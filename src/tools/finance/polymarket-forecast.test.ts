import { describe, it, expect, mock } from 'bun:test';
import type { PolymarketMarketResult } from './polymarket.js';
import type { SignalCategory } from './signal-extractor.js';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test
// ---------------------------------------------------------------------------

const mockMarkets: PolymarketMarketResult[] = [
  { question: 'Will NVIDIA beat Q2 earnings?', probability: 0.72, volume24h: 500_000 },
  { question: 'Will NVIDIA revenue exceed $30B?', probability: 0.65, volume24h: 300_000 },
];

const mockSignals: SignalCategory[] = [
  {
    name: 'Earnings',
    searchPhrase: 'NVIDIA earnings',
    weight: 0.35,
    category: 'earnings_beat',
  },
];

mock.module('./polymarket.js', () => ({
  fetchPolymarketMarkets: async (_query: string, _limit: number): Promise<PolymarketMarketResult[]> =>
    mockMarkets,
}));

mock.module('./signal-extractor.js', () => ({
  extractSignals: (_query: string): SignalCategory[] => mockSignals,
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
