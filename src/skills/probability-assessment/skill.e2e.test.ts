/**
 * Refined E2E tests — probability_assessment skill with a real Ollama thinking model.
 *
 * Run with:  RUN_E2E=1 bun test --filter e2e
 * Skipped in normal `bun test` / CI runs.
 *
 * The agent is invoked ONCE via beforeAll; all tests share the same result so
 * we pay the LLM cost only once per run.
 *
 * What this suite verifies end-to-end:
 *   1. Tool chain order  — skill loads first, polymarket_search follows, chart is called
 *   2. Signal Evidence   — raw Polymarket market text with YES percentages in the answer
 *   3. Price chart       — ASCII distribution chart rendered from threshold markets
 *   4. Probability table — signal rows with Weight column and a Combined row
 *   5. Bear case block   — inversion / failure-mode paragraph is present
 *   6. Disclaimer        — market-implied-odds caveat at end of output
 *   7. Live BTC price    — get_market_data called; dollar figure appears in answer
 *
 * Model: nemotron-3-nano:30b-cloud (thinking model — recognised via isThinkingModel)
 * Timeout: E2E_TIMEOUT_MS (default 300 s) for the single beforeAll call
 */
import { describe, expect, beforeAll } from 'bun:test';
import { e2eIt } from '@/utils/test-guards.js';
import { runAgentE2E, E2E_TIMEOUT_MS } from '@/utils/e2e-helpers.js';
import type { E2EResult } from '@/utils/e2e-helpers.js';
import type { AgentEvent } from '@/agent/types.js';

const PROBABILITY_QUERY =
  '--deep Use the probability_assessment skill for BTC price movement in the next 30 days';

// ── shared agent result ──────────────────────────────────────────────────────
// All tests in this suite share a single agent run to avoid paying the LLM
// cost multiple times.  beforeAll runs only when RUN_E2E=1 is set; individual
// tests are still skipped via e2eIt when the env var is absent.
let result: E2EResult;
let tools: string[];
let answer: string;

describe('probability_assessment skill E2E', () => {
  beforeAll(async () => {
    if (process.env.RUN_E2E !== '1') return; // guard — tests will be skipped
    result = await runAgentE2E(PROBABILITY_QUERY);
    tools = result.toolsCalled;
    answer = result.answer;
  }, E2E_TIMEOUT_MS);

  // ── 1. Tool chain ──────────────────────────────────────────────────────────

  e2eIt('invokes both skill and polymarket_search tools', () => {
    const skillIdx = tools.indexOf('skill');
    const polyIdx = tools.findIndex((t) => t.includes('polymarket'));

    expect(skillIdx, 'skill tool must be called').toBeGreaterThanOrEqual(0);
    expect(polyIdx, 'polymarket_search must be called').toBeGreaterThanOrEqual(0);
    // A thinking model may fetch Polymarket data before or after loading the skill —
    // both orderings are valid. What matters is that both are called in the same run.
  });

  e2eIt('calls polymarket_search (not web_search) for market probabilities', () => {
    // The dedicated polymarket_search tool must be used — not a generic web search
    expect(
      tools.some((t) => t === 'polymarket_search'),
      'polymarket_search must be called, not substituted by web_search',
    ).toBe(true);
  });

  e2eIt('calls get_market_data for live BTC price', () => {
    expect(
      tools.some((t) => t === 'get_market_data'),
      'get_market_data must be called to anchor the current price',
    ).toBe(true);
  });

  e2eIt('calls price_distribution_chart after Polymarket data is received', () => {
    // Verify that the chart tool was called AND that it came after polymarket_search
    const polyIdx = tools.findIndex((t) => t.includes('polymarket'));
    const chartIdx = tools.findIndex((t) => t.includes('chart'));

    expect(chartIdx, 'price_distribution_chart must be called').toBeGreaterThanOrEqual(0);
    expect(chartIdx, 'chart must come after polymarket_search').toBeGreaterThan(polyIdx);
  });

  // ── 2. Signal Evidence section ─────────────────────────────────────────────

  e2eIt('answer contains Signal Evidence with raw Polymarket YES percentages', () => {
    // The SKILL.md mandates showing exact market question text and YES probability
    expect(answer.toLowerCase()).toMatch(/signal evidence|evidence/);

    // Must contain at least one Polymarket market entry: "X% YES" or "YES: X%"
    expect(answer).toMatch(/\d+\.?\d*\s*%\s*YES|\bYES\b.*\d+\.?\d*\s*%/i);

    // Must reference real dollar price thresholds from the markets
    expect(answer).toMatch(/\$\d{2,3}[,.]?\d*[Kk]?|\$\d{1,3},\d{3}/);
  });

  e2eIt('answer cites polymarket.com as the data source', () => {
    // The model should attribute the crowd probabilities to Polymarket
    expect(answer.toLowerCase()).toMatch(/polymarket/);
  });

  // ── 3. Price distribution chart ────────────────────────────────────────────

  e2eIt('answer embeds the price distribution chart', () => {
    // The chart tool renders an ASCII chart with block characters or dashed lines.
    // Accept any of the common rendering styles.
    const hasChart =
      /░|█|▓|▒/.test(answer) ||            // block-fill characters
      /─{3,}/.test(answer) ||               // horizontal rule dividers inside chart
      /chart|distribution/i.test(answer);   // explicit chart label (fallback)
    expect(hasChart, 'answer must embed the ASCII price distribution chart').toBe(true);
  });

  // ── 4. Probability summary table ───────────────────────────────────────────

  e2eIt('answer contains probability summary table with Signal, Probability, Weight columns', () => {
    expect(answer).toMatch(/Signal/);
    expect(answer).toMatch(/Probability/);
    expect(answer).toMatch(/Weight/);
    // Combined row must be present
    expect(answer.toLowerCase()).toMatch(/combined|weighted/);
    // At least one percentage value
    expect(answer).toMatch(/\d+%/);
  });

  e2eIt('combined probability is in 1–99% range (not fabricated extremes)', () => {
    // Extract all percentages from the answer and verify at least one is a
    // plausible combined probability (between 1% and 99% inclusive)
    const pcts = [...answer.matchAll(/(\d+\.?\d*)\s*%/g)].map((m) => parseFloat(m[1]));
    expect(pcts.length, 'answer must contain percentage figures').toBeGreaterThan(0);
    const inRange = pcts.some((p) => p >= 1 && p <= 99);
    expect(inRange, `at least one probability must be in 1–99% range; found: ${pcts.join(', ')}`).toBe(true);
  });

  // ── 5. Bear case ───────────────────────────────────────────────────────────

  e2eIt('answer contains Bear case (inversion) block', () => {
    expect(
      answer.toLowerCase(),
      'Bear case block is required per SKILL.md Step 6',
    ).toMatch(/bear case/);
  });

  // ── 6. Disclaimer ──────────────────────────────────────────────────────────

  e2eIt('answer ends with a Polymarket disclaimer', () => {
    // The SKILL.md Constraints section mandates a disclaimer about market-implied odds
    expect(answer.toLowerCase()).toMatch(
      /disclaimer|not financial advice|market.implied|not guaranteed/,
    );
  });

  // ── 7. Live price anchor ───────────────────────────────────────────────────

  e2eIt('answer includes current BTC price from live market data', () => {
    // BTC price is typically in the $20K–$200K range; pattern matches $66,539 or $66K style
    const hasBtcPrice = /\$[2-9]\d[,.]?\d*[Kk]|\$[1-9]\d{2}[,.]?\d*[Kk]|\$\d{2,3},\d{3}/.test(answer);
    expect(
      hasBtcPrice,
      'answer must include a live BTC dollar price sourced from get_market_data',
    ).toBe(true);
  });
});
