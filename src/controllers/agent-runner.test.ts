/**
 * TDD regression tests for AgentRunnerController event handling.
 *
 * Focus: parallel tool call display — verifies that when multiple tools are
 * invoked simultaneously, both show completed (not "Interrupted") when they finish.
 *
 * Root-cause: finishToolEvent() used to match via `activeToolId` which is a single
 * pointer that gets overwritten by each tool_start. For parallel tools:
 *   tool_start(A) → activeToolId = 'tool-A'
 *   tool_start(B) → activeToolId = 'tool-B'    ← overwrites A
 *   tool_end(B)   → finishes 'tool-B' ✓
 *   tool_end(A)   → activeToolId is now undefined → A never completed → shows "Interrupted"
 *
 * Fix: finishToolEvent now searches events by tool name instead.
 */

import { describe, it, expect, mock } from 'bun:test';
import { AgentRunnerController } from './agent-runner.js';
import type { HistoryItem } from '../types.js';
import type { ToolStartEvent, ToolEndEvent, ToolErrorEvent } from '../agent/types.js';

// ──────────────────────────────────────────────────────────────────────────────
// Minimal stubs
// ──────────────────────────────────────────────────────────────────────────────

function makeController() {
  // @ts-expect-error partial mock — only test event processing, not full run
  const ctrl = new AgentRunnerController({
    model: null,
    tools: [],
    systemPrompt: '',
  });
  return ctrl;
}

/** Inject a processing HistoryItem so updateLastItem operates on it. */
function seedProcessingItem(ctrl: AgentRunnerController) {
  // Access private field via cast to any
  (ctrl as unknown as { historyValue: HistoryItem[] }).historyValue = [
    {
      id: 'test-item',
      query: 'test query',
      events: [],
      answer: '',
      status: 'processing',
    },
  ];
}

function getLastItem(ctrl: AgentRunnerController): HistoryItem {
  const history = (ctrl as unknown as { historyValue: HistoryItem[] }).historyValue;
  return history[history.length - 1];
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers to fire events via the private handleEvent method
// ──────────────────────────────────────────────────────────────────────────────

async function fire(ctrl: AgentRunnerController, event: Parameters<AgentRunnerController['handleEvent'] extends (...a: infer P) => unknown ? (...a: P) => unknown : never>[0]) {
  // handleEvent is private; access via cast
  await (ctrl as unknown as { handleEvent: (e: unknown) => Promise<void> }).handleEvent(event);
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('AgentRunnerController parallel tool completion', () => {
  it('marks both tools completed when tool_start fires for each then tool_end fires for each', async () => {
    const ctrl = makeController();
    seedProcessingItem(ctrl);

    // Two tools start simultaneously
    await fire(ctrl, { type: 'tool_start', tool: 'geopolitics_search', args: { topic: 'Iran' } } as ToolStartEvent);
    await fire(ctrl, { type: 'tool_start', tool: 'polymarket_search', args: { query: 'Iran' } } as ToolStartEvent);

    // Both finish — in reverse order (polymarket finishes first)
    await fire(ctrl, { type: 'tool_end', tool: 'polymarket_search', args: { query: 'Iran' }, result: 'ok', duration: 597 } as ToolEndEvent);
    await fire(ctrl, { type: 'tool_end', tool: 'geopolitics_search', args: { topic: 'Iran' }, result: 'ok', duration: 8000 } as ToolEndEvent);

    const item = getLastItem(ctrl);
    const toolEvents = item.events.filter((e) => e.event.type === 'tool_start');

    expect(toolEvents).toHaveLength(2);

    const geopoliticsEntry = toolEvents.find((e) => (e.event as ToolStartEvent).tool === 'geopolitics_search')!;
    const polymarketEntry = toolEvents.find((e) => (e.event as ToolStartEvent).tool === 'polymarket_search')!;

    expect(geopoliticsEntry.completed).toBe(true);
    expect(geopoliticsEntry.endEvent?.type).toBe('tool_end');

    expect(polymarketEntry.completed).toBe(true);
    expect(polymarketEntry.endEvent?.type).toBe('tool_end');
  });

  it('marks both tools completed when tool_end fires in same order as tool_start', async () => {
    const ctrl = makeController();
    seedProcessingItem(ctrl);

    await fire(ctrl, { type: 'tool_start', tool: 'get_market_data', args: { query: 'NVDA' } } as ToolStartEvent);
    await fire(ctrl, { type: 'tool_start', tool: 'get_financials', args: { query: 'NVDA' } } as ToolStartEvent);

    await fire(ctrl, { type: 'tool_end', tool: 'get_market_data', args: { query: 'NVDA' }, result: 'price', duration: 300 } as ToolEndEvent);
    await fire(ctrl, { type: 'tool_end', tool: 'get_financials', args: { query: 'NVDA' }, result: 'metrics', duration: 700 } as ToolEndEvent);

    const item = getLastItem(ctrl);
    const toolEvents = item.events.filter((e) => e.event.type === 'tool_start');

    expect(toolEvents.every((e) => e.completed)).toBe(true);
    expect(toolEvents.every((e) => e.endEvent?.type === 'tool_end')).toBe(true);
  });

  it('marks tool with tool_error when error occurs during parallel run', async () => {
    const ctrl = makeController();
    seedProcessingItem(ctrl);

    await fire(ctrl, { type: 'tool_start', tool: 'geopolitics_search', args: { topic: 'Ukraine' } } as ToolStartEvent);
    await fire(ctrl, { type: 'tool_start', tool: 'web_search', args: { query: 'Ukraine' } } as ToolStartEvent);

    // geopolitics errors, web_search succeeds
    await fire(ctrl, { type: 'tool_error', tool: 'geopolitics_search', error: 'GDELT timeout' } as ToolErrorEvent);
    await fire(ctrl, { type: 'tool_end', tool: 'web_search', args: { query: 'Ukraine' }, result: 'articles', duration: 400 } as ToolEndEvent);

    const item = getLastItem(ctrl);
    const geoEntry = item.events.find((e) => e.event.type === 'tool_start' && (e.event as ToolStartEvent).tool === 'geopolitics_search')!;
    const webEntry = item.events.find((e) => e.event.type === 'tool_start' && (e.event as ToolStartEvent).tool === 'web_search')!;

    expect(geoEntry.completed).toBe(true);
    expect(geoEntry.endEvent?.type).toBe('tool_error');
    expect((geoEntry.endEvent as ToolErrorEvent).error).toBe('GDELT timeout');

    expect(webEntry.completed).toBe(true);
    expect(webEntry.endEvent?.type).toBe('tool_end');
  });

  it('handles 3 parallel tools all completing', async () => {
    const ctrl = makeController();
    seedProcessingItem(ctrl);

    const tools = ['geopolitics_search', 'polymarket_search', 'get_market_data'];
    for (const tool of tools) {
      await fire(ctrl, { type: 'tool_start', tool, args: {} } as ToolStartEvent);
    }

    // Finish in reverse order
    for (const tool of [...tools].reverse()) {
      await fire(ctrl, { type: 'tool_end', tool, args: {}, result: 'ok', duration: 100 } as ToolEndEvent);
    }

    const item = getLastItem(ctrl);
    const toolEvents = item.events.filter((e) => e.event.type === 'tool_start');

    expect(toolEvents).toHaveLength(3);
    expect(toolEvents.every((e) => e.completed)).toBe(true);
  });

  it('handles sequential (non-parallel) tool calls correctly', async () => {
    const ctrl = makeController();
    seedProcessingItem(ctrl);

    // Sequential: start → end → start → end
    await fire(ctrl, { type: 'tool_start', tool: 'web_search', args: { query: 'q1' } } as ToolStartEvent);
    await fire(ctrl, { type: 'tool_end', tool: 'web_search', args: { query: 'q1' }, result: 'r1', duration: 200 } as ToolEndEvent);

    await fire(ctrl, { type: 'tool_start', tool: 'web_search', args: { query: 'q2' } } as ToolStartEvent);
    await fire(ctrl, { type: 'tool_end', tool: 'web_search', args: { query: 'q2' }, result: 'r2', duration: 300 } as ToolEndEvent);

    const item = getLastItem(ctrl);
    const toolEvents = item.events.filter((e) => e.event.type === 'tool_start');

    expect(toolEvents).toHaveLength(2);
    expect(toolEvents.every((e) => e.completed)).toBe(true);
  });
});
