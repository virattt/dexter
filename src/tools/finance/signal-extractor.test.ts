import { describe, it, expect } from 'bun:test';
import {
  detectAssetType,
  extractSignals,
  normalizeForPolymarket,
  scoreMarketRelevance,
  TICKER_TO_COMPANY_NAME,
  SIGNAL_KEYWORDS,
} from './signal-extractor.js';

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

  it('uses company name (not ticker) in earnings search phrase for NVDA', () => {
    const signals = extractSignals('NVDA');
    const earnings = signals.find((s) => s.category === 'earnings')!;
    expect(earnings.searchPhrase).toContain('NVIDIA');
    expect(earnings.searchPhrase).not.toContain('NVDA');
  });

  it('returns fda_approval as first signal for PFE (weight 0.40)', () => {
    const signals = extractSignals('PFE');
    expect(signals[0].category).toBe('fda_approval');
    expect(signals[0].weight).toBe(0.40);
  });

  it('uses company name (not ticker) in fda_approval search phrase for PFE', () => {
    const signals = extractSignals('PFE');
    const fda = signals.find((s) => s.category === 'fda_approval')!;
    expect(fda.searchPhrase).toContain('Pfizer');
    expect(fda.searchPhrase).not.toContain('PFE');
  });

  it('returns regulatory as first signal for BTC (weight 0.35)', () => {
    const signals = extractSignals('BTC');
    expect(signals[0].category).toBe('regulatory');
    expect(signals[0].weight).toBe(0.35);
  });

  it('uses company name (Bitcoin not BTC) in ETF signal search phrase', () => {
    const signals = extractSignals('BTC');
    const etf = signals.find((s) => s.category === 'etf_product')!;
    expect(etf.searchPhrase).toContain('Bitcoin');
    expect(etf.searchPhrase).not.toContain('BTC');
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

  it('search phrases do NOT contain year tokens (normalisation strips them)', () => {
    const year = String(new Date().getFullYear());
    const signals = extractSignals('NVDA');
    for (const sig of signals) {
      expect(sig.searchPhrase).not.toContain(year);
    }
  });

  it('macro_rates search phrase does NOT contain quarter token (normalisation strips it)', () => {
    const signals = extractSignals('NVDA');
    const rate = signals.find((s) => s.category === 'macro_rates')!;
    expect(rate.searchPhrase).not.toMatch(/Q[1-4]/i);
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

  it('every signal has a queryVariants array with at least one entry', () => {
    for (const sig of extractSignals('NVDA')) {
      expect(Array.isArray(sig.queryVariants)).toBe(true);
      expect((sig.queryVariants ?? []).length).toBeGreaterThan(0);
    }
  });

  it('no queryVariant contains template placeholders', () => {
    const queries = ['NVDA', 'PFE', 'JPM', 'BTC', 'recession', 'WMT', 'XOM'];
    for (const q of queries) {
      for (const sig of extractSignals(q)) {
        for (const variant of sig.queryVariants ?? []) {
          expect(variant).not.toContain('{');
          expect(variant).not.toContain('}');
        }
      }
    }
  });

  it('no queryVariant contains year tokens', () => {
    const year = String(new Date().getFullYear());
    for (const sig of extractSignals('NVDA')) {
      for (const v of sig.queryVariants ?? []) {
        expect(v).not.toContain(year);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// normalizeForPolymarket
// ---------------------------------------------------------------------------

describe('normalizeForPolymarket', () => {
  it('replaces ticker with company name', () => {
    expect(normalizeForPolymarket('NVDA earnings', 'NVDA')).toBe('NVIDIA earnings');
  });

  it('replaces ticker case-insensitively', () => {
    expect(normalizeForPolymarket('nvda earnings', 'NVDA')).toBe('NVIDIA earnings');
  });

  it('strips 4-digit year tokens', () => {
    expect(normalizeForPolymarket('US recession 2026', null)).toBe('US recession');
  });

  it('strips quarter tokens Q1–Q4', () => {
    expect(normalizeForPolymarket('Fed rate cut Q2', null)).toBe('Fed rate cut');
  });

  it('strips both year and quarter', () => {
    expect(normalizeForPolymarket('Fed rate cut Q2 2026', null)).toBe('Fed rate cut');
  });

  it('truncates to 4 words maximum', () => {
    const result = normalizeForPolymarket('one two three four five six', null);
    expect(result.split(' ').length).toBeLessThanOrEqual(4);
  });

  it('handles null ticker gracefully (no replacement)', () => {
    expect(normalizeForPolymarket('US recession', null)).toBe('US recession');
  });

  it('leaves unknown tickers as-is', () => {
    const result = normalizeForPolymarket('ZZZZ earnings', 'ZZZZ');
    expect(result).toContain('ZZZZ');
  });

  it('collapses extra whitespace', () => {
    const result = normalizeForPolymarket('Fed  rate   cut', null);
    expect(result).toBe('Fed rate cut');
  });

  it('PFE → Pfizer in phrase', () => {
    expect(normalizeForPolymarket('PFE FDA approval', 'PFE')).toBe('Pfizer FDA approval');
  });

  it('BTC → Bitcoin in phrase', () => {
    expect(normalizeForPolymarket('BTC ETF', 'BTC')).toBe('Bitcoin ETF');
  });
});

// ---------------------------------------------------------------------------
// scoreMarketRelevance
// ---------------------------------------------------------------------------

describe('scoreMarketRelevance', () => {
  it('returns > 0 when question contains a category keyword', () => {
    expect(scoreMarketRelevance('Will NVIDIA beat Q1 earnings?', 'earnings')).toBeGreaterThan(0);
  });

  it('returns 0 when question contains no category keywords', () => {
    expect(scoreMarketRelevance('Will Argentina legalise cannabis?', 'earnings')).toBe(0);
  });

  it('returns 1 for unknown category (no filtering)', () => {
    expect(scoreMarketRelevance('Any question here', 'unknown_category')).toBe(1);
  });

  it('macro_rates question matches Fed/rate keywords', () => {
    expect(scoreMarketRelevance('Will the Fed cut rates in 2026?', 'macro_rates')).toBeGreaterThan(0);
  });

  it('earnings keyword "beat" matches via substring (beats → beat)', () => {
    expect(scoreMarketRelevance('Will NVDA beats Q1 2026?', 'earnings')).toBeGreaterThan(0);
  });

  it('fda_approval question containing FDA scores > 0', () => {
    expect(scoreMarketRelevance('Will Pfizer receive FDA approval?', 'fda_approval')).toBeGreaterThan(0);
  });

  it('trade_policy question containing tariff scores > 0', () => {
    expect(scoreMarketRelevance('Will the US impose new tariff on China?', 'trade_policy')).toBeGreaterThan(0);
  });

  it('matching more keywords gives a higher score than matching fewer', () => {
    const many = scoreMarketRelevance('Fed FOMC rate cut hike', 'macro_rates');
    const one  = scoreMarketRelevance('Fed decision', 'macro_rates');
    expect(many).toBeGreaterThan(one);
  });
});

// ---------------------------------------------------------------------------
// TICKER_TO_COMPANY_NAME coverage
// ---------------------------------------------------------------------------

describe('TICKER_TO_COMPANY_NAME', () => {
  it('contains key tech tickers', () => {
    expect(TICKER_TO_COMPANY_NAME['NVDA']).toBe('NVIDIA');
    expect(TICKER_TO_COMPANY_NAME['AAPL']).toBe('Apple');
    expect(TICKER_TO_COMPANY_NAME['MSFT']).toBe('Microsoft');
  });

  it('contains crypto tickers', () => {
    expect(TICKER_TO_COMPANY_NAME['BTC']).toBe('Bitcoin');
    expect(TICKER_TO_COMPANY_NAME['ETH']).toBe('Ethereum');
  });

  it('contains healthcare tickers', () => {
    expect(TICKER_TO_COMPANY_NAME['PFE']).toBe('Pfizer');
    expect(TICKER_TO_COMPANY_NAME['LLY']).toBe('Eli Lilly');
  });
});

// ---------------------------------------------------------------------------
// SIGNAL_KEYWORDS coverage
// ---------------------------------------------------------------------------

describe('SIGNAL_KEYWORDS', () => {
  it('has entries for core categories', () => {
    const required = ['earnings', 'macro_rates', 'macro_growth', 'regulatory', 'fda_approval'];
    for (const cat of required) {
      expect(SIGNAL_KEYWORDS[cat]).toBeDefined();
      expect(SIGNAL_KEYWORDS[cat].length).toBeGreaterThan(0);
    }
  });
});
