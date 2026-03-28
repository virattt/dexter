import { describe, it, expect } from 'bun:test';
import { injectPolymarketContext } from './polymarket-injector.js';
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
      fetchMarkets: async () => [market('NVDA Q1?', 0.7)],
    };
    const result = await injectPolymarketContext('NVDA', prompt, deps);
    expect(result).toContain(prompt);
    expect(result.indexOf('🎯')).toBeLessThan(result.indexOf(prompt));
  });

  it('groups markets under signal category name heading', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => twoSignals,
      fetchMarkets: async (q) => [market(q.includes('NVDA') ? 'NVDA Q1?' : 'Fed cut Q2?', 0.6)],
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
      fetchMarkets: async () => [market('Exactly threshold?', 0.6, 1_000)],
      minLiquidity: 1_000,
    };
    const result = await injectPolymarketContext('NVDA', 'p', deps);
    expect(result).toContain('Exactly threshold?');
  });

  it('displays probabilities as whole percentages (no decimals)', async () => {
    const deps: PolymarketInjectorDeps = {
      extractSignals: () => [twoSignals[0]],
      fetchMarkets: async () => [market('Precise market?', 0.6789)],
    };
    const result = await injectPolymarketContext('NVDA', 'p', deps);
    expect(result).toContain('68%'); // Math.round(67.89) = 68
    expect(result).not.toContain('67.89');
  });
});
