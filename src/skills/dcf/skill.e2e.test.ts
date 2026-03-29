/**
 * E2E tests — DCF valuation skill with real Ollama model.
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

describe('DCF skill E2E', () => {
  e2eIt(
    'invokes skill tool and at least one financial data tool',
    async () => {
      const result = await runAgentE2E('Use the DCF skill to value Apple (AAPL)');
      const tools = result.toolsCalled;

      // skill tool must have been invoked
      expect(tools.some((t: string) => t === 'skill')).toBe(true);

      // At least one financial data tool must have been called to gather inputs
      const calledFinancial = tools.some(
        (t: string) =>
          t.includes('financial') ||
          t.includes('fundamental') ||
          t.includes('market') ||
          t.includes('filing'),
      );
      expect(calledFinancial).toBe(true);
    },
    E2E_TIMEOUT_MS,
  );

  e2eIt(
    'answer contains a DCF valuation figure and methodology',
    async () => {
      const result = await runAgentE2E('Use the DCF skill to value Apple (AAPL)');
      const answer = result.answer;

      // Must mention DCF or valuation methodology
      expect(answer.toLowerCase()).toMatch(/dcf|discounted cash flow|intrinsic value|valuation/);

      // Must contain at least one dollar/price figure
      expect(answer).toMatch(/\$[\d,]+(\.\d+)?|\d+\.\d{2}/);

      // Must mention Apple or AAPL
      expect(answer.toLowerCase()).toMatch(/apple|aapl/);
    },
    E2E_TIMEOUT_MS,
  );
});
