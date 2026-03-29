/**
 * E2E tests — basic agent flows with the configured Ollama model.
 *
 * Run with:  RUN_E2E=1 bun test --filter e2e
 * Skipped in normal `bun test` / CI runs.
 *
 * Model: ollama:nemotron-3-nano:30b-cloud (override via E2E_MODEL env var)
 * Timeout: 300 s per test
 */
import { describe, expect } from 'bun:test';
import { e2eIt } from '@/utils/test-guards.js';
import { runAgentE2E, E2E_TIMEOUT_MS } from '@/utils/e2e-helpers.js';

describe('Agent E2E — basic financial query flows', () => {
  e2eIt(
    'looks up AAPL stock price and returns a numeric value',
    async () => {
      const result = await runAgentE2E('What is the current stock price of Apple (AAPL)?');

      // Agent must have called at least one financial tool
      expect(result.toolsCalled.length).toBeGreaterThan(0);
      const calledFinancial = result.toolsCalled.some(
        (t: string) => t.includes('financial') || t.includes('market') || t.includes('price'),
      );
      expect(calledFinancial).toBe(true);

      // Answer must contain a dollar amount or a clear price figure
      expect(result.answer).toMatch(/\$[\d,]+(\.\d+)?|\d+\.\d{2}/);

      // Answer must mention AAPL or Apple
      expect(result.answer.toLowerCase()).toMatch(/aapl|apple/);

      // Should complete in a reasonable time
      expect(result.durationMs).toBeLessThan(E2E_TIMEOUT_MS);
    },
    E2E_TIMEOUT_MS,
  );

  e2eIt(
    'searches for Federal Reserve news and returns a non-trivial answer',
    async () => {
      const result = await runAgentE2E('Find recent news about Federal Reserve interest rate decisions');

      // Agent must have called a search tool
      expect(result.toolsCalled.length).toBeGreaterThan(0);
      const calledSearch = result.toolsCalled.some(
        (t: string) => t.includes('search') || t.includes('web') || t.includes('news'),
      );
      expect(calledSearch).toBe(true);

      // Answer must be substantive (not just an error or placeholder)
      expect(result.answer.length).toBeGreaterThan(200);

      // Answer must mention Federal Reserve or interest rates
      expect(result.answer.toLowerCase()).toMatch(/federal reserve|interest rate|fed|fomc/);
    },
    E2E_TIMEOUT_MS,
  );
});
