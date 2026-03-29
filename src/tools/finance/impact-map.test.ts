/**
 * impact-map.test.ts
 *
 * Unit tests for:
 *   - IMPACT_MAP structure & coverage
 *   - lookupImpact fallback chain
 *   - Economic direction correctness (key asset-class × signal relationships)
 *   - inferAssetClass comprehensive classification
 *   - Known coverage gaps (documented so future fixes land here too)
 */
import { describe, it, expect } from 'bun:test';
import { IMPACT_MAP, lookupImpact, inferAssetClass } from './impact-map.js';
import type { ImpactEntry } from './impact-map.js';

// ---------------------------------------------------------------------------
// IMPACT_MAP — structure
// ---------------------------------------------------------------------------

describe('IMPACT_MAP — structure', () => {
  it('exports a non-empty object', () => {
    expect(typeof IMPACT_MAP).toBe('object');
    expect(Object.keys(IMPACT_MAP).length).toBeGreaterThan(10);
  });

  it('contains every core category used by signal-extractor', () => {
    const required = [
      'macro_rates', 'macro_growth', 'trade_policy', 'geopolitical',
      'earnings', 'commodity', 'government_budget', 'regulatory',
      'supply_chain', 'recession', 'tariff_increase', 'earnings_beat',
      'earnings_miss', 'geopolitical_conflict', 'fda_approval', 'fda_rejection',
      'default',
    ];
    for (const cat of required) {
      expect(IMPACT_MAP[cat], `IMPACT_MAP missing category "${cat}"`).toBeDefined();
    }
  });

  it('every category contains at least one entry', () => {
    for (const [cat, entries] of Object.entries(IMPACT_MAP)) {
      expect(
        Object.keys(entries).length,
        `Category "${cat}" is empty`,
      ).toBeGreaterThan(0);
    }
  });

  it('all ImpactEntry deltaYes values are in realistic range (−0.30 to +0.30)', () => {
    for (const [cat, entries] of Object.entries(IMPACT_MAP)) {
      for (const [ac, entry] of Object.entries(entries as Record<string, ImpactEntry>)) {
        expect(
          entry.deltaYes,
          `${cat}.${ac} deltaYes out of range`,
        ).toBeGreaterThanOrEqual(-0.30);
        expect(
          entry.deltaYes,
          `${cat}.${ac} deltaYes out of range`,
        ).toBeLessThanOrEqual(0.30);
      }
    }
  });

  it('all ImpactEntry deltaNo values are in realistic range (−0.30 to +0.30)', () => {
    for (const [cat, entries] of Object.entries(IMPACT_MAP)) {
      for (const [ac, entry] of Object.entries(entries as Record<string, ImpactEntry>)) {
        expect(
          entry.deltaNo,
          `${cat}.${ac} deltaNo out of range`,
        ).toBeGreaterThanOrEqual(-0.30);
        expect(
          entry.deltaNo,
          `${cat}.${ac} deltaNo out of range`,
        ).toBeLessThanOrEqual(0.30);
      }
    }
  });

  it('every ImpactEntry has a valid tier', () => {
    const validTiers = new Set(['macro', 'geopolitical', 'electoral']);
    for (const [cat, entries] of Object.entries(IMPACT_MAP)) {
      for (const [ac, entry] of Object.entries(entries as Record<string, ImpactEntry>)) {
        expect(
          validTiers.has(entry.tier as string),
          `${cat}.${ac} has invalid tier "${entry.tier}"`,
        ).toBe(true);
      }
    }
  });

  it('every ImpactEntry deltaYes ≠ deltaNo (non-zero spread implies meaningful signal)', () => {
    for (const [cat, entries] of Object.entries(IMPACT_MAP)) {
      for (const [ac, entry] of Object.entries(entries as Record<string, ImpactEntry>)) {
        expect(
          entry.deltaYes,
          `${cat}.${ac} deltaYes equals deltaNo (zero signal spread)`,
        ).not.toBe(entry.deltaNo);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// lookupImpact — fallback chain
// ---------------------------------------------------------------------------

describe('lookupImpact — fallback chain', () => {
  it('returns direct entry when both category and assetClass exist', () => {
    const entry = lookupImpact('macro_rates', 'financial');
    // Known precise values — rate cut is BAD for bank NIM
    expect(entry.deltaYes).toBe(-0.03);
    expect(entry.deltaNo).toBe(0.02);
  });

  it('unknown assetClass falls back to category-level default — does not throw', () => {
    const result = lookupImpact('macro_rates', 'nonexistent_class_xyz');
    expect(result).toBeDefined();
    expect(Number.isFinite(result.deltaYes)).toBe(true);
    expect(Number.isFinite(result.deltaNo)).toBe(true);
  });

  it('unknown category falls back to global default — does not throw', () => {
    const result = lookupImpact('not_a_real_category_xyz', 'equity');
    expect(result).toBeDefined();
    expect(Number.isFinite(result.deltaYes)).toBe(true);
  });

  it('unknown category AND unknown assetClass returns global default — does not throw', () => {
    const result = lookupImpact('fake_cat', 'fake_asset');
    expect(result).toBeDefined();
    expect(Number.isFinite(result.deltaYes)).toBe(true);
  });

  it('default category has a default assetClass entry', () => {
    const result = lookupImpact('default', 'default');
    expect(result).toBeDefined();
    expect(Number.isFinite(result.deltaYes)).toBe(true);
  });

  it('returns different values for different (category, assetClass) combinations', () => {
    const r1 = lookupImpact('macro_rates', 'financial');   // rate cut → NIM compression
    const r2 = lookupImpact('macro_rates', 'small_cap');   // rate cut → rally
    expect(r1.deltaYes).not.toBe(r2.deltaYes);            // must differ
    expect(r1.deltaYes).toBeLessThan(0);                   // financial: negative
    expect(r2.deltaYes).toBeGreaterThan(0);                // small_cap: positive
  });
});

// ---------------------------------------------------------------------------
// lookupImpact — macro_rates economic direction
//
// "Will the Fed cut interest rates?" → YES = rate cut
// ---------------------------------------------------------------------------

describe('lookupImpact — macro_rates economic direction', () => {
  it('equity: deltaYes > 0 (rate cuts lower discount rates, boost broad market)', () => {
    expect(lookupImpact('macro_rates', 'equity').deltaYes).toBeGreaterThan(0);
  });

  it('financial: deltaYes < 0 (rate cut = NIM compression for banks)', () => {
    expect(lookupImpact('macro_rates', 'financial').deltaYes).toBeLessThan(0);
  });

  it('financial: deltaNo > 0 (no cut = higher rates = wider NIM → bank profit)', () => {
    expect(lookupImpact('macro_rates', 'financial').deltaNo).toBeGreaterThan(0);
  });

  it('small_cap: deltaYes > equity deltaYes (small caps carry more floating-rate debt)', () => {
    expect(lookupImpact('macro_rates', 'small_cap').deltaYes).toBeGreaterThan(
      lookupImpact('macro_rates', 'equity').deltaYes,
    );
  });

  it('gold: deltaYes > 0 (lower rates reduce opportunity cost of holding gold)', () => {
    expect(lookupImpact('macro_rates', 'gold').deltaYes).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// lookupImpact — macro_growth economic direction
//
// "Will the US enter recession?" → YES = recession
// ---------------------------------------------------------------------------

describe('lookupImpact — macro_growth economic direction', () => {
  it('equity: deltaYes < 0 (recession crushes corporate earnings)', () => {
    expect(lookupImpact('macro_growth', 'equity').deltaYes).toBeLessThan(0);
  });

  it('gold: deltaYes > 0 (recession triggers safe-haven demand for gold)', () => {
    expect(lookupImpact('macro_growth', 'gold').deltaYes).toBeGreaterThan(0);
  });

  it('financial: deltaYes < equity deltaYes (recession amplified by loan defaults)', () => {
    expect(lookupImpact('macro_growth', 'financial').deltaYes).toBeLessThan(
      lookupImpact('macro_growth', 'equity').deltaYes,
    );
  });

  it('materials: deltaYes < equity deltaYes (industrials are highly cyclical)', () => {
    expect(lookupImpact('macro_growth', 'materials').deltaYes).toBeLessThan(
      lookupImpact('macro_growth', 'equity').deltaYes,
    );
  });

  it('defense: deltaYes > financial deltaYes (govt contracts provide recession buffer)', () => {
    expect(lookupImpact('macro_growth', 'defense').deltaYes).toBeGreaterThan(
      lookupImpact('macro_growth', 'financial').deltaYes,
    );
  });

  it('small_cap: deltaYes < equity deltaYes (smaller firms less resilient in recessions)', () => {
    expect(lookupImpact('macro_growth', 'small_cap').deltaYes).toBeLessThan(
      lookupImpact('macro_growth', 'equity').deltaYes,
    );
  });
});

// ---------------------------------------------------------------------------
// lookupImpact — trade_policy economic direction
//
// "Will US impose tariffs?" → YES = tariff increase
// ---------------------------------------------------------------------------

describe('lookupImpact — trade_policy economic direction', () => {
  it('equity: deltaYes < 0 (tariffs hurt broad market via supply-chain disruption)', () => {
    expect(lookupImpact('trade_policy', 'equity').deltaYes).toBeLessThan(0);
  });

  it('materials: deltaYes > 0 (US tariffs protect domestic steel producers)', () => {
    expect(lookupImpact('trade_policy', 'materials').deltaYes).toBeGreaterThan(0);
  });

  it('materials: deltaYes is the highest across all asset classes (maximum tariff beneficiary)', () => {
    const materialsYes = lookupImpact('trade_policy', 'materials').deltaYes;
    for (const ac of ['equity', 'tech', 'semiconductor', 'financial', 'small_cap', 'industrial']) {
      expect(
        materialsYes,
        `materials deltaYes should exceed ${ac} deltaYes for trade_policy`,
      ).toBeGreaterThan(lookupImpact('trade_policy', ac).deltaYes);
    }
  });

  it('semiconductor: deltaYes < 0 (tariffs disrupt global chip supply chains)', () => {
    expect(lookupImpact('trade_policy', 'semiconductor').deltaYes).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// lookupImpact — geopolitical economic direction
//
// "Will geopolitical conflict intensify?" → YES = escalation
// ---------------------------------------------------------------------------

describe('lookupImpact — geopolitical economic direction', () => {
  it('equity: deltaYes < 0 (conflict creates market uncertainty)', () => {
    expect(lookupImpact('geopolitical', 'equity').deltaYes).toBeLessThan(0);
  });

  it('gold: deltaYes > 0 (conflict drives safe-haven demand)', () => {
    expect(lookupImpact('geopolitical', 'gold').deltaYes).toBeGreaterThan(0);
  });

  it('defense: deltaYes > 0 (escalation increases defense procurement)', () => {
    expect(lookupImpact('geopolitical', 'defense').deltaYes).toBeGreaterThan(0);
  });

  it('gold deltaYes > equity deltaYes (gold benefits while equities suffer)', () => {
    expect(lookupImpact('geopolitical', 'gold').deltaYes).toBeGreaterThan(
      lookupImpact('geopolitical', 'equity').deltaYes,
    );
  });

  it('defense deltaYes > equity deltaYes (defense outperforms in conflict)', () => {
    expect(lookupImpact('geopolitical', 'defense').deltaYes).toBeGreaterThan(
      lookupImpact('geopolitical', 'equity').deltaYes,
    );
  });
});

// ---------------------------------------------------------------------------
// lookupImpact — other core categories
// ---------------------------------------------------------------------------

describe('lookupImpact — other categories', () => {
  it('earnings (beat): semiconductor deltaYes > 0 (earnings beats drive chip stocks)', () => {
    expect(lookupImpact('earnings', 'semiconductor').deltaYes).toBeGreaterThan(0);
  });

  it('earnings (beat): tech deltaYes > 0', () => {
    expect(lookupImpact('earnings', 'tech').deltaYes).toBeGreaterThan(0);
  });

  it('commodity (price rise): gold deltaYes > 0 (gold ETFs benefit from commodity appreciation)', () => {
    expect(lookupImpact('commodity', 'gold').deltaYes).toBeGreaterThan(0);
  });

  it('commodity (price rise): materials deltaYes > 0 (materials ETFs benefit)', () => {
    expect(lookupImpact('commodity', 'materials').deltaYes).toBeGreaterThan(0);
  });

  it('fda_approval: biotech deltaYes > 0 (approval drives biotech stocks)', () => {
    expect(lookupImpact('fda_approval', 'biotech').deltaYes).toBeGreaterThan(0);
  });

  it('fda_rejection: biotech deltaYes < 0 (rejection crushes biotech stocks)', () => {
    expect(lookupImpact('fda_rejection', 'biotech').deltaYes).toBeLessThan(0);
  });

  it('government_budget (increase): defense deltaYes > 0 (higher budget = more contracts)', () => {
    expect(lookupImpact('government_budget', 'defense').deltaYes).toBeGreaterThan(0);
  });

  it('tariff_increase: materials deltaYes matches trade_policy direction (both positive)', () => {
    expect(lookupImpact('tariff_increase', 'materials').deltaYes).toBeGreaterThan(0);
  });

  it('tariff_increase.materials deltaYes is precisely 0.08 (known value)', () => {
    expect(lookupImpact('tariff_increase', 'materials').deltaYes).toBe(0.08);
  });

  it('recession: gold deltaYes > 0 (recession = safe-haven demand)', () => {
    expect(lookupImpact('recession', 'gold').deltaYes).toBeGreaterThan(0);
  });

  it('recession: equity deltaYes < 0', () => {
    expect(lookupImpact('recession', 'equity').deltaYes).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// inferAssetClass — comprehensive ticker classification
// ---------------------------------------------------------------------------

describe('inferAssetClass — semiconductors', () => {
  it('NVDA → semiconductor', () => expect(inferAssetClass('NVDA')).toBe('semiconductor'));
  it('AMD → semiconductor', () => expect(inferAssetClass('AMD')).toBe('semiconductor'));
  it('TSM → semiconductor', () => expect(inferAssetClass('TSM')).toBe('semiconductor'));
  it('SOXX (semis ETF) → semiconductor', () => expect(inferAssetClass('SOXX')).toBe('semiconductor'));
  it('ASML → semiconductor', () => expect(inferAssetClass('ASML')).toBe('semiconductor'));
});

describe('inferAssetClass — tech', () => {
  it('MSFT → tech', () => expect(inferAssetClass('MSFT')).toBe('tech'));
  it('AAPL → tech', () => expect(inferAssetClass('AAPL')).toBe('tech'));
  it('GOOGL → tech', () => expect(inferAssetClass('GOOGL')).toBe('tech'));
  it('QQQ → tech (Nasdaq-100 is tech-heavy; TECH_TICKERS precedes equity fallback)', () => {
    expect(inferAssetClass('QQQ')).toBe('tech');
  });
});

describe('inferAssetClass — sector ETFs', () => {
  it('SLX → materials', () => expect(inferAssetClass('SLX')).toBe('materials'));
  it('XME → materials', () => expect(inferAssetClass('XME')).toBe('materials'));
  it('XLI → industrial', () => expect(inferAssetClass('XLI')).toBe('industrial'));
  it('KRE → financial', () => expect(inferAssetClass('KRE')).toBe('financial'));
  it('XLF → financial', () => expect(inferAssetClass('XLF')).toBe('financial'));
  it('IWM → small_cap', () => expect(inferAssetClass('IWM')).toBe('small_cap'));
  it('ITA → defense', () => expect(inferAssetClass('ITA')).toBe('defense'));
  it('LMT → defense', () => expect(inferAssetClass('LMT')).toBe('defense'));
  it('XOM → energy', () => expect(inferAssetClass('XOM')).toBe('energy'));
});

describe('inferAssetClass — gold ETFs', () => {
  it('GLD → gold', () => expect(inferAssetClass('GLD')).toBe('gold'));
  it('IAU → gold', () => expect(inferAssetClass('IAU')).toBe('gold'));
  // Critical: GLD must NOT fall through to equity (prevents using generic equity impacts for gold)
  it('GLD is NOT equity (bug guard: gold ETF must get gold-specific safe-haven impacts)', () => {
    expect(inferAssetClass('GLD')).not.toBe('equity');
  });
});

describe('inferAssetClass — crypto', () => {
  it('BTC → crypto', () => expect(inferAssetClass('BTC')).toBe('crypto'));
  it('ETH → crypto', () => expect(inferAssetClass('ETH')).toBe('crypto'));
  it('SOL → crypto', () => expect(inferAssetClass('SOL')).toBe('crypto'));
});

describe('inferAssetClass — biotech / healthcare', () => {
  it('PFE → biotech', () => expect(inferAssetClass('PFE')).toBe('biotech'));
  it('LLY → biotech', () => expect(inferAssetClass('LLY')).toBe('biotech'));
  it('MRNA → biotech', () => expect(inferAssetClass('MRNA')).toBe('biotech'));
});

describe('inferAssetClass — broad market', () => {
  it('SPY → equity', () => expect(inferAssetClass('SPY')).toBe('equity'));
  it('VOO → equity', () => expect(inferAssetClass('VOO')).toBe('equity'));
  it('VTI → equity', () => expect(inferAssetClass('VTI')).toBe('equity'));
  it('UNKNOWN_TICKER → equity (default fallback)', () => {
    expect(inferAssetClass('UNKNOWN_TICKER')).toBe('equity');
  });
});

describe('inferAssetClass — case insensitivity', () => {
  it('lowercase "gld" → gold', () => expect(inferAssetClass('gld')).toBe('gold'));
  it('lowercase "nvda" → semiconductor', () => expect(inferAssetClass('nvda')).toBe('semiconductor'));
  it('mixed case "Spy" → equity', () => expect(inferAssetClass('Spy')).toBe('equity'));
});

// ---------------------------------------------------------------------------
// Known coverage gaps — documented so future fixes land here
// ---------------------------------------------------------------------------

describe('IMPACT_MAP — known coverage gaps', () => {
  it('trade_policy has no direct gold entry (gold benefits from trade uncertainty but falls back to default)', () => {
    // Gold is a safe haven: trade tensions should push gold UP, but IMPACT_MAP.trade_policy
    // has no gold entry. Falls back to default (slightly negative). Documented gap.
    expect(IMPACT_MAP['trade_policy']!['gold']).toBeUndefined();
    // BUT the fallback still returns a valid (non-crashing) entry
    const fallback = lookupImpact('trade_policy', 'gold');
    expect(fallback).toBeDefined();
    expect(Number.isFinite(fallback.deltaYes)).toBe(true);
  });

  it('supply_chain category falls back cleanly for all major asset classes', () => {
    // supply_chain may not have entries for every assetClass; verify no crashes
    for (const ac of ['gold', 'bond', 'usd', 'airline', 'crypto']) {
      expect(() => lookupImpact('supply_chain', ac)).not.toThrow();
    }
  });
});
