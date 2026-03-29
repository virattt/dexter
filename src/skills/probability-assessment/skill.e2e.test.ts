/**
 * E2E tests — probability_assessment skill with real Ollama model.
 *
 * Run with:  RUN_E2E=1 bun test --filter e2e
 * Skipped in normal `bun test` / CI runs.
 *
 * Verifies that the full skill flow produces:
 *   1. Correct tool invocations (skill → polymarket → social_sentiment)
 *   2. Structured output (Probability Assessment header, signal table, disclaimer)
 *   3. price_distribution_chart called when Polymarket threshold data is present
 *
 * Model: ollama:nemotron-3-nano:30b-cloud (override via E2E_MODEL env var)
 * Timeout: 300 s per test
 */
import { describe, expect } from 'bun:test';
import { e2eIt } from '@/utils/test-guards.js';
import { runAgentE2E, E2E_TIMEOUT_MS } from '@/utils/e2e-helpers.js';
import type { AgentEvent } from '@/agent/types.js';

const PROBABILITY_QUERY =
  '--deep Use the probability_assessment skill for BTC price movement in the next 30 days';

describe('probability_assessment skill E2E', () => {
  e2eIt(
    'invokes skill, Polymarket, and social_sentiment tools',
    async () => {
      const result = await runAgentE2E(PROBABILITY_QUERY);
      const tools = result.toolsCalled;

      // skill tool must have been invoked
      expect(tools.some((t: string) => t === 'skill')).toBe(true);

      // Polymarket search must have been invoked
      expect(tools.some((t: string) => t.toLowerCase().includes('polymarket'))).toBe(true);

      // Social sentiment must have been invoked
      expect(tools.some((t: string) => t.toLowerCase().includes('sentiment'))).toBe(true);
    },
    E2E_TIMEOUT_MS,
  );

  e2eIt(
    'answer contains Probability Assessment header and signal table',
    async () => {
      const result = await runAgentE2E(PROBABILITY_QUERY);
      const answer = result.answer;

      // Must contain the standard header
      expect(answer.toLowerCase()).toMatch(/probability assessment/);

      // Must contain a table with the expected column names
      expect(answer).toMatch(/Signal/);
      expect(answer).toMatch(/Probability/);
      expect(answer).toMatch(/Weight/);

      // Must contain at least one percentage figure
      expect(answer).toMatch(/\d+%/);
    },
    E2E_TIMEOUT_MS,
  );

  e2eIt(
    'answer contains disclaimer section',
    async () => {
      const result = await runAgentE2E(PROBABILITY_QUERY);
      expect(result.answer.toLowerCase()).toMatch(/disclaimer|not financial advice/);
    },
    E2E_TIMEOUT_MS,
  );

  e2eIt(
    'calls price_distribution_chart when Polymarket threshold data is available',
    async () => {
      const result = await runAgentE2E(PROBABILITY_QUERY);

      // Find all Polymarket tool_end events to check if threshold data was returned
      const polymarketResults = result.events
        .filter((e: AgentEvent) => e.type === 'tool_end' && (e as { tool: string }).tool.toLowerCase().includes('polymarket'))
        .map((e: AgentEvent) => (e as { result: string }).result);

      // If Polymarket returned price-threshold data (contains "%" markers typical of threshold markets)
      const hasThresholdData = polymarketResults.some(
        (r) => /\d+K|\$\d+|\d+%.*Yes|above|below|reach/.test(r),
      );

      if (hasThresholdData) {
        // price_distribution_chart MUST have been called
        const chartCalled = result.toolsCalled.some((t: string) => t.toLowerCase().includes('chart'));
        expect(
          chartCalled,
          'price_distribution_chart must be called when Polymarket threshold data is present',
        ).toBe(true);
      } else {
        // No threshold data — chart call is not required but answer must still be present
        expect(result.answer.length).toBeGreaterThan(100);
      }
    },
    E2E_TIMEOUT_MS,
  );
});
