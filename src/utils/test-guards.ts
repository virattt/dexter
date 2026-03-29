/**
 * Shared test-tier guards for Dexter's three-tier test convention:
 *
 *   *.test.ts            — unit (pure logic, always run)
 *   *.integration.test.ts — real public APIs, no LLM  (RUN_INTEGRATION=1)
 *   *.e2e.test.ts        — full agent + Ollama LLM    (RUN_E2E=1)
 *
 * Usage:
 *   import { integrationIt, e2eIt } from '@/utils/test-guards.js';
 *   integrationIt('hits real Polymarket API', async () => { ... }, 15_000);
 */
import { it } from 'bun:test';

export const RUN_INTEGRATION = process.env.RUN_INTEGRATION === '1';
export const RUN_E2E = process.env.RUN_E2E === '1';

/** Use instead of `it` for tests that hit real external APIs (no LLM). */
export const integrationIt: typeof it = RUN_INTEGRATION ? it : it.skip;

/** Use instead of `it` for tests that run the full Dexter agent against Ollama. */
export const e2eIt: typeof it = RUN_E2E ? it : it.skip;
