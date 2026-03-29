/**
 * Integration tests — direct tool chain verification with real external APIs.
 * No LLM involved; tests the data layer independently.
 *
 * Run with:  RUN_INTEGRATION=1 bun test --filter integration
 * Skipped in normal `bun test` / CI runs.
 */
import { describe, expect } from 'bun:test';
import { integrationIt } from '@/utils/test-guards.js';
import { polymarketTool } from './polymarket.js';
import { socialSentimentTool } from './social-sentiment.js';

describe('Financial tools integration — Polymarket', () => {
  integrationIt(
    'Polymarket search returns structured text for a crypto query',
    async () => {
      const result = await polymarketTool.invoke({ query: 'Bitcoin price', limit: 5 });
      const text = typeof result === 'string' ? result : (result as { data: { result: string } }).data.result;

      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(20);

      // Should contain either market data or a clear "no active markets" message
      const hasContent = text.includes('Yes:') || text.includes('No active Polymarket') || text.includes('polymarket.com');
      expect(hasContent).toBe(true);
    },
    20_000,
  );

  integrationIt(
    'Polymarket search returns markets for a macro query',
    async () => {
      const result = await polymarketTool.invoke({ query: 'US recession 2026', limit: 3 });
      const text = typeof result === 'string' ? result : (result as { data: { result: string } }).data.result;

      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(10);
    },
    20_000,
  );
});

describe('Financial tools integration — Social Sentiment', () => {
  integrationIt(
    'social sentiment returns sentiment fields for BTC',
    async () => {
      const result = await socialSentimentTool.invoke({
        ticker: 'BTC',
        include_fear_greed: true,
        limit: 5,
      });
      const text = typeof result === 'string' ? result : JSON.stringify(result);

      expect(text.length).toBeGreaterThan(20);

      // Should contain sentiment indicators
      const hasSentiment =
        text.toLowerCase().includes('bullish') ||
        text.toLowerCase().includes('bearish') ||
        text.toLowerCase().includes('neutral') ||
        text.toLowerCase().includes('sentiment') ||
        text.toLowerCase().includes('fear');
      expect(hasSentiment).toBe(true);
    },
    30_000,
  );
});
