/**
 * Live integration tests for the Polymarket tool.
 * These hit the real Gamma API (no key required).
 *
 * Run with:  bun test --filter polymarket.integration
 * Skipped in normal `bun test` runs because they make real network calls.
 */
import { describe, expect } from 'bun:test';
import { polymarketTool } from './polymarket.js';
import { integrationIt as maybeIt } from '@/utils/test-guards.js';

describe('Polymarket integration (live API)', () => {
  maybeIt('returns real prediction markets for a finance query', async () => {
    const result = await polymarketTool.invoke({ query: 'Federal Reserve interest rates', limit: 5 });
    const text = typeof result === 'string' ? result : (result as { data: { result: string } }).data.result;

    // Should have our header
    expect(text).toContain('Polymarket');

    // Should contain at least one market (Yes/No line)
    const hasMarket = text.includes('Yes:') || text.includes('No active Polymarket');
    expect(hasMarket).toBe(true);

    // Source footer should be present if we got results
    if (text.includes('Yes:')) {
      expect(text).toContain('polymarket.com');
    }
  }, 15_000);

  maybeIt('returns results for a geopolitical query', async () => {
    const result = await polymarketTool.invoke({ query: 'US recession 2026', limit: 3 });
    const text = typeof result === 'string' ? result : (result as { data: { result: string } }).data.result;
    expect(text).toContain('Polymarket');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(20);
  }, 15_000);

  maybeIt('respects the limit parameter', async () => {
    const result = await polymarketTool.invoke({ query: 'election', limit: 2 });
    const text = typeof result === 'string' ? result : (result as { data: { result: string } }).data.result;
    // Count "▸" bullets — should be at most 2
    const bulletCount = (text.match(/▸/g) ?? []).length;
    expect(bulletCount).toBeLessThanOrEqual(2);
  }, 15_000);

  maybeIt('gracefully handles an obscure query with no matching markets', async () => {
    const result = await polymarketTool.invoke({ query: 'zxqwerty12345nomarket', limit: 3 });
    const text = typeof result === 'string' ? result : (result as { data: { result: string } }).data.result;
    // Either no results message or valid market data — never throws
    expect(typeof text).toBe('string');
  }, 15_000);
});
