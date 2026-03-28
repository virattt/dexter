import { describe, it, expect } from 'bun:test';
import { detectAssetType, extractSignals } from './signal-extractor.js';

// ---------------------------------------------------------------------------
// detectAssetType
// ---------------------------------------------------------------------------

describe('detectAssetType', () => {
  it('detects NVDA as tech_semiconductor', () => {
    expect(detectAssetType('Should I hold NVDA?').type).toBe('tech_semiconductor');
  });

  it('detects $NVDA (dollar prefix) as tech_semiconductor', () => {
    const r = detectAssetType('$NVDA outlook');
    expect(r.type).toBe('tech_semiconductor');
    expect(r.ticker).toBe('NVDA');
  });

  it('detects AMD as tech_semiconductor', () => {
    expect(detectAssetType('AMD Q1 results').type).toBe('tech_semiconductor');
  });

  it('detects MSFT as tech_software', () => {
    expect(detectAssetType('MSFT cloud growth').type).toBe('tech_software');
  });

  it('detects AAPL as tech_general', () => {
    expect(detectAssetType('AAPL iPhone sales').type).toBe('tech_general');
  });

  it('detects PFE as healthcare', () => {
    const r = detectAssetType('PFE pipeline');
    expect(r.type).toBe('healthcare');
    expect(r.ticker).toBe('PFE');
  });

  it('detects LLY as healthcare', () => {
    expect(detectAssetType('LLY GLP-1 market share').type).toBe('healthcare');
  });

  it('detects JPM as financials', () => {
    expect(detectAssetType('JPM earnings').type).toBe('financials');
  });

  it('detects XOM as energy', () => {
    expect(detectAssetType('XOM dividend').type).toBe('energy');
  });

  it('detects WMT as consumer', () => {
    expect(detectAssetType('WMT retail outlook').type).toBe('consumer');
  });

  it('detects bitcoin (lowercase) as crypto with ticker BTC', () => {
    const r = detectAssetType('bitcoin outlook');
    expect(r.type).toBe('crypto');
    expect(r.ticker).toBe('BTC');
  });

  it('detects BTC keyword as crypto', () => {
    const r = detectAssetType('BTC price prediction');
    expect(r.type).toBe('crypto');
    expect(r.ticker).toBe('BTC');
  });

  it('detects ethereum as crypto with ticker ETH', () => {
    const r = detectAssetType('ethereum staking');
    expect(r.type).toBe('crypto');
    expect(r.ticker).toBe('ETH');
  });

  it('detects ETH keyword as crypto', () => {
    expect(detectAssetType('ETH 2.0 upgrade').type).toBe('crypto');
  });

  it('detects solana as crypto with ticker SOL', () => {
    const r = detectAssetType('solana ecosystem');
    expect(r.type).toBe('crypto');
    expect(r.ticker).toBe('SOL');
  });

  it('detects Fed keyword as macro', () => {
    expect(detectAssetType('What will the Fed do with rates?').type).toBe('macro');
  });

  it('detects recession keyword as macro', () => {
    expect(detectAssetType('recession risk this year').type).toBe('macro');
  });

  it('detects CPI keyword as macro', () => {
    expect(detectAssetType('CPI print next week').type).toBe('macro');
  });

  it('detects tariff keyword as macro', () => {
    expect(detectAssetType('impact of tariff on tech').type).toBe('macro');
  });

  it('$UNKNOWN ticker falls back to tech_general with ticker set', () => {
    const r = detectAssetType('What about $ZZZZ?');
    expect(r.type).toBe('tech_general');
    expect(r.ticker).toBe('ZZZZ');
  });
});

// ---------------------------------------------------------------------------
// extractSignals
// ---------------------------------------------------------------------------

describe('extractSignals', () => {
  it('returns earnings as first signal for NVDA (highest weight 0.35)', () => {
    const signals = extractSignals('NVDA');
    expect(signals[0].category).toBe('earnings');
    expect(signals[0].weight).toBe(0.35);
  });

  it('substitutes NVDA ticker in earnings search phrase', () => {
    const signals = extractSignals('NVDA');
    const earnings = signals.find((s) => s.category === 'earnings')!;
    expect(earnings.searchPhrase).toContain('NVDA');
  });

  it('returns fda_approval as first signal for PFE (weight 0.40)', () => {
    const signals = extractSignals('PFE');
    expect(signals[0].category).toBe('fda_approval');
    expect(signals[0].weight).toBe(0.40);
  });

  it('substitutes PFE ticker in fda_approval search phrase', () => {
    const signals = extractSignals('PFE');
    const fda = signals.find((s) => s.category === 'fda_approval')!;
    expect(fda.searchPhrase).toContain('PFE');
  });

  it('returns regulatory as first signal for BTC (weight 0.35)', () => {
    const signals = extractSignals('BTC');
    expect(signals[0].category).toBe('regulatory');
    expect(signals[0].weight).toBe(0.35);
  });

  it('substitutes BTC ticker in ETF signal search phrase', () => {
    const signals = extractSignals('BTC');
    const etf = signals.find((s) => s.category === 'etf_product')!;
    expect(etf.searchPhrase).toContain('BTC');
  });

  it('returns macro_rates as first signal for JPM (financials)', () => {
    const signals = extractSignals('JPM');
    expect(signals[0].category).toBe('macro_rates');
    expect(signals[0].weight).toBe(0.35);
  });

  it('returns macro_rates as first signal for Fed rate query', () => {
    const signals = extractSignals('What will the Fed do with rates?');
    expect(signals[0].category).toBe('macro_rates');
  });

  it('substitutes current year in search phrases', () => {
    const year = String(new Date().getFullYear());
    const signals = extractSignals('NVDA');
    const withYear = signals.filter((s) => s.searchPhrase.includes(year));
    expect(withYear.length).toBeGreaterThan(0);
  });

  it('substitutes current quarter in macro_rates search phrase', () => {
    const q = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
    const signals = extractSignals('NVDA');
    const rate = signals.find((s) => s.category === 'macro_rates')!;
    expect(rate.searchPhrase).toContain(q);
  });

  it('weights sum to 1.0 for tech_semiconductor (NVDA)', () => {
    const sum = extractSignals('NVDA').reduce((s, sig) => s + sig.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('weights sum to 1.0 for healthcare (PFE)', () => {
    const sum = extractSignals('PFE analysis').reduce((s, sig) => s + sig.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('weights sum to 1.0 for financials (JPM)', () => {
    const sum = extractSignals('JPM outlook').reduce((s, sig) => s + sig.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('weights sum to 1.0 for energy (XOM)', () => {
    const sum = extractSignals('XOM dividend').reduce((s, sig) => s + sig.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('weights sum to 1.0 for consumer (WMT)', () => {
    const sum = extractSignals('WMT retail').reduce((s, sig) => s + sig.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('weights sum to 1.0 for crypto (BTC)', () => {
    const sum = extractSignals('BTC').reduce((s, sig) => s + sig.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('weights sum to 1.0 for macro query', () => {
    const sum = extractSignals('US recession risk').reduce((s, sig) => s + sig.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('returns at least 4 signals for known asset types', () => {
    expect(extractSignals('NVDA').length).toBeGreaterThanOrEqual(4);
    expect(extractSignals('PFE').length).toBeGreaterThanOrEqual(4);
    expect(extractSignals('BTC').length).toBeGreaterThanOrEqual(4);
    expect(extractSignals('JPM').length).toBeGreaterThanOrEqual(4);
  });

  it('every signal has non-empty name and category', () => {
    for (const sig of extractSignals('NVDA')) {
      expect(sig.name.length).toBeGreaterThan(0);
      expect(sig.category.length).toBeGreaterThan(0);
    }
  });

  it('no template placeholders remain in any search phrase', () => {
    const queries = ['NVDA', 'PFE', 'JPM', 'BTC', 'recession', 'WMT', 'XOM'];
    for (const q of queries) {
      for (const sig of extractSignals(q)) {
        expect(sig.searchPhrase).not.toContain('{');
        expect(sig.searchPhrase).not.toContain('}');
      }
    }
  });
});
