/**
 * E2E test helper — runs the full Dexter agent against the configured Ollama
 * model and returns a structured result for assertion.
 *
 * Environment variables:
 *   E2E_MODEL      — Ollama model to use (default: 'ollama:nemotron-3-nano:30b-cloud')
 *   OLLAMA_BASE_URL — Ollama endpoint (default: 'http://127.0.0.1:11434')
 *   E2E_TIMEOUT_MS  — Hard timeout in ms (default: 300 000)
 */
import { Agent } from '../agent/agent.js';
import type { AgentEvent, DoneEvent } from '../agent/types.js';

export const E2E_MODEL = process.env.E2E_MODEL ?? 'ollama:nemotron-3-nano:30b-cloud';
export const E2E_TIMEOUT_MS = parseInt(process.env.E2E_TIMEOUT_MS ?? '300000', 10);

export interface E2EResult {
  /** Full final answer text from the done event */
  answer: string;
  /** Ordered list of tool names that were called (tool_start events) */
  toolsCalled: string[];
  /** All raw events emitted by the agent */
  events: AgentEvent[];
  /** Wall-clock duration in ms */
  durationMs: number;
  /** Number of agent iterations */
  iterations: number;
}

/**
 * Run the Dexter agent end-to-end with the E2E model.
 * Throws if no `done` event is received within E2E_TIMEOUT_MS.
 */
export async function runAgentE2E(
  query: string,
  opts: { maxIterations?: number; model?: string } = {},
): Promise<E2EResult> {
  const model = opts.model ?? E2E_MODEL;
  const maxIterations = opts.maxIterations ?? 10;

  const agent = await Agent.create({
    model,
    maxIterations,
    memoryEnabled: false, // keep E2E tests hermetic — no cross-test memory bleed
  });

  const events: AgentEvent[] = [];
  const toolsCalled: string[] = [];
  const start = Date.now();

  // Race the agent run against the hard wall-clock timeout
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), E2E_TIMEOUT_MS);

  try {
    for await (const event of agent.run(query)) {
      if (ac.signal.aborted) break;
      events.push(event);
      if (event.type === 'tool_start') toolsCalled.push(event.tool);
    }
  } finally {
    clearTimeout(timer);
  }

  const doneEvent = events.find((e): e is DoneEvent => e.type === 'done');
  if (!doneEvent) {
    throw new Error(
      `E2E: no 'done' event received after ${Date.now() - start}ms. ` +
        `Tools called: [${toolsCalled.join(', ')}]. Events: [${events.map((e) => e.type).join(', ')}]`,
    );
  }

  return {
    answer: doneEvent.answer,
    toolsCalled,
    events,
    durationMs: Date.now() - start,
    iterations: doneEvent.iterations,
  };
}
