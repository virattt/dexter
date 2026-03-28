import { describe, it, expect } from 'bun:test';
import { injectPolymarketContext, fetchWithFallback } from './polymarket-injector.js';
import type { PolymarketInjectorDeps, PolymarketMarketResult } from './polymarket-injector.js';
import type { SignalCategory } from './signal-extractor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const market = (question: string, probability: number, volume24h = 100_000): PolymarketMarketResult =>
  ({ question, probability, volume24h });

const noSignals = (): SignalCategory[] => [];

const twoSignals: SignalCategory[] = [
  { name: 'Earnings',        searchPhrase: 'NVDA earnings 2026',     weight: 0.35, category: 'earnings' },
  { name: 'Fed Rate',        searchPhrase: 'Fed rate cut Q2 2026',   weight: 0.20, category: 'macro_rates' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('injectPolymarketContext', () => {
  it('returns prompt unchanged when no signals found', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: noSignals,
      fetchMarkets: async () => [],
    };
    expect(await injectPolymarketContext('NVDA', 'Original', deps)).toBe('Original');
  });

  it('returns prompt unchanged when signals found but all fetches return empty', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => twoSignals,
      fetchMarkets: async () => [],
    };
    expect(await injectPolymarketContext('NVDA', 'Original', deps)).toBe('Original');
  });

  it('prepends 🎯 block when markets are found', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => twoSignals,
      fetchMarkets: async (q) =>
        q.includes('NVDA') ? [market('NVDA beats Q1 2026?', 0.74)] : [],
    };
    const result = await injectPolymarketContext('NVDA', 'Original', deps);
    expect(result).toContain('🎯');
    expect(result).toContain('Prediction Markets');
    expect(result).toContain('NVDA beats Q1 2026?');
    expect(result).toContain('74%');
  });

  it('original prompt appears after the injected block', async () => {
    const prompt = 'Original prompt text';
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => [twoSignals[0]],
      fetchMarkets: async () => [market('NVDA Q1 results?', 0.7)],
    };
    const result = await injectPolymarketContext('NVDA', prompt, deps);
    expect(result).toContain(prompt);
    expect(result.indexOf('🎯')).toBeLessThan(result.indexOf(prompt));
  });

  it('groups markets under signal category name heading', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => twoSignals,
      fetchMarkets: async (q) => [market(q.includes('NVDA') ? 'NVDA beat Q1 earnings?' : 'Will the Fed cut rates?', 0.6)],
    };
    const result = await injectPolymarketContext('NVDA', 'p', deps);
    expect(result).toContain('Earnings');
    expect(result).toContain('Fed Rate');
  });

  it('returns prompt unchanged when fetchMarkets throws', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => twoSignals,
      fetchMarkets: async () => { throw new Error('Network error'); },
    };
    expect(await injectPolymarketContext('NVDA', 'Original', deps)).toBe('Original');
  });

  it('returns prompt unchanged when extractSignals throws', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => { throw new Error('oops'); },
      fetchMarkets: async () => [],
    };
    expect(await injectPolymarketContext('NVDA', 'Original', deps)).toBe('Original');
  });

  it('respects maxSignals cap (calls fetchMarkets at most maxSignals times)', async () => {
    const manySignals: SignalCategory[] = Array.from({ length: 10 }, (_, i) => ({
      name: `Signal ${i}`,
      searchPhrase: `search ${i}`,
      weight: 0.1,
      category: `cat_${i}`,
    }));
    const calls: string[] = [];
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => manySignals,
      fetchMarkets: async (q) => { calls.push(q); return [market('Q?', 0.5)]; },
      maxSignals: 3,
    };
    await injectPolymarketContext('test', 'p', deps);
    expect(calls.length).toBeLessThanOrEqual(3);
  });

  it('filters out markets below minLiquidity threshold', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => [twoSignals[0]],
      fetchMarkets: async () => [market('Low volume?', 0.5, 500)], // 500 < 1_000
      minLiquidity: 1_000,
    };
    expect(await injectPolymarketContext('NVDA', 'Original', deps)).toBe('Original');
  });

  it('includes markets at exactly the minLiquidity threshold', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => [twoSignals[0]],
      fetchMarkets: async () => [market('Exactly threshold earnings?', 0.6, 1_000)],
      minLiquidity: 1_000,
    };
    const result = await injectPolymarketContext('NVDA', 'p', deps);
    expect(result).toContain('Exactly threshold earnings?');
  });

  it('displays probabilities as whole percentages (no decimals)', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => [twoSignals[0]],
      fetchMarkets: async () => [market('Precise earnings market?', 0.6789)],
    };
    const result = await injectPolymarketContext('NVDA', 'p', deps);
    expect(result).toContain('68%'); // Math.round(67.89) = 68
    expect(result).not.toContain('67.89');
  });

  it('filters out markets with no keyword overlap with signal category', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => [twoSignals[0]], // earnings signal
      fetchMarkets: async () => [market('Will Argentina legalise cannabis?', 0.3)],
    };
    // Irrelevant market → relevance score 0 → filtered → no block → original returned
    expect(await injectPolymarketContext('NVDA', 'Original', deps)).toBe('Original');
  });

  it('deduplicates identical market questions across multiple signals', async () => {
    const sameCategory: SignalCategory[] = [
      { name: 'Signal A', searchPhrase: 'search A', weight: 0.5, category: 'macro_rates' },
      { name: 'Signal B', searchPhrase: 'search B', weight: 0.5, category: 'macro_rates' },
    ];
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => sameCategory,
      fetchMarkets: async () => [market('Will the Fed cut rates in 2026?', 0.65)],
    };
    const result = await injectPolymarketContext('macro', 'p', deps);
    const count = (result.match(/Will the Fed cut rates in 2026\?/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('uses queryVariants fallback when primary phrase returns empty', async () => {
    const signalWithVariants: SignalCategory[] = [{
      name: 'Earnings',
      searchPhrase: 'primary-no-results',
      queryVariants: ['NVIDIA earnings'],
      weight: 0.35,
      category: 'earnings',
    }];
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => signalWithVariants,
      fetchMarkets: async (q) =>
        q.includes('NVIDIA') ? [market('NVIDIA beat Q3 earnings?', 0.7)] : [],
    };
    const result = await injectPolymarketContext('NVDA', 'p', deps);
    expect(result).toContain('NVIDIA beat Q3 earnings?');
  });
});

// ---------------------------------------------------------------------------
// fetchWithFallback
// ---------------------------------------------------------------------------

describe('fetchWithFallback', () => {
  it('returns results from the first (primary) phrase', async () => {
    const results = await fetchWithFallback(
      ['primary', 'fallback'],
      2,
      async (q) => q === 'primary' ? [market('Primary result', 0.5)] : [],
    );
    expect(results).toHaveLength(1);
    expect(results[0].question).toBe('Primary result');
  });

  it('falls back to second variant when primary returns empty', async () => {
    const results = await fetchWithFallback(
      ['empty', 'fallback'],
      2,
      async (q) => q === 'fallback' ? [market('Fallback result', 0.4)] : [],
    );
    expect(results).toHaveLength(1);
    expect(results[0].question).toBe('Fallback result');
  });

  it('returns empty when all variants return empty', async () => {
    const results = await fetchWithFallback(['a', 'b', 'c'], 2, async () => []);
    expect(results).toHaveLength(0);
  });

  it('skips throwing variants and continues to the next', async () => {
    const results = await fetchWithFallback(
      ['throws', 'good'],
      2,
      async (q) => {
        if (q === 'throws') throw new Error('network error');
        return [market('Good result', 0.7)];
      },
    );
    expect(results).toHaveLength(1);
    expect(results[0].question).toBe('Good result');
  });

  it('skips blank/whitespace-only phrases', async () => {
    const calls: string[] = [];
    await fetchWithFallback(
      ['  ', 'valid'],
      2,
      async (q) => { calls.push(q); return [market('Q?', 0.5)]; },
    );
    expect(calls).not.toContain('  ');
    expect(calls).toContain('valid');
  });

  it('returns results from third variant when first two are empty', async () => {
    const results = await fetchWithFallback(
      ['a', 'b', 'third'],
      2,
      async (q) => q === 'third' ? [market('Third variant result', 0.6)] : [],
    );
    expect(results[0].question).toBe('Third variant result');
  });
});
