/**
 * TDD tests for AgentToolExecutor in-session request deduplication (Feature 6).
 *
 * Tests verify that:
 * - A cacheable tool called twice with the same args only invokes the real
 *   tool once (second call gets result from cache, duration=0).
 * - Different args produce separate cache entries.
 * - Uncacheable tools (browser, skill, write_file, etc.) are never cached.
 * - Cache key is stable regardless of arg key ordering.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AgentToolExecutor } from './tool-executor.js';
import { createRunContext } from './run-context.js';
import type { ToolEndEvent, ToolStartEvent } from './types.js';
import type { RunContext } from './run-context.js';
import { AIMessage } from '@langchain/core/messages';

// ---------------------------------------------------------------------------
// Isolation: each test gets its own tmp dir so Scratchpad JSONL files don't
// accumulate in the project tree.
// ---------------------------------------------------------------------------
let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `tool-exec-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a fake StructuredTool-like object that records how many times it was invoked. */
function makeFakeTool(name: string, result: string) {
  let callCount = 0;
  const tool = {
    name,
    invoke: async (_args: unknown) => {
      callCount++;
      return result;
    },
    get invocationCount() { return callCount; },
    lc_namespace: [],
    schema: {},
  };
  return tool as unknown as import('@langchain/core/tools').StructuredToolInterface & {
    invocationCount: number;
  };
}

/** Drains all events from an AsyncGenerator into an array. */
async function drainEvents<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

/** Builds a minimal AIMessage with two identical tool calls (same args). */
function aiMsgTwo(toolName: string, args: Record<string, unknown>) {
  return new AIMessage({
    content: '',
    tool_calls: [
      { id: 'c1', name: toolName, args, type: 'tool_call' as const },
      { id: 'c2', name: toolName, args, type: 'tool_call' as const },
    ],
  });
}

/** Builds a minimal AIMessage with two tool calls with different args. */
function aiMsgTwoDiff(toolName: string, args1: Record<string, unknown>, args2: Record<string, unknown>) {
  return new AIMessage({
    content: '',
    tool_calls: [
      { id: 'c1', name: toolName, args: args1, type: 'tool_call' as const },
      { id: 'c2', name: toolName, args: args2, type: 'tool_call' as const },
    ],
  });
}

function makeCtx(): RunContext {
  return createRunContext('test query');
}

// ---------------------------------------------------------------------------
// Cache hit on identical (tool, args) — tests use SEQUENTIAL calls,
// i.e., two separate executeAll invocations (simulating two agent iterations
// both calling the same tool with the same args).
// The cache does NOT deduplicate within a single parallel batch because both
// calls launch before either resolves.
// ---------------------------------------------------------------------------
describe('AgentToolExecutor — request deduplication', () => {
  it('calls the real tool only once across two sequential calls with identical args', async () => {
    const fakeTool = makeFakeTool('financial_search', '{"price": 100}');
    const executor = new AgentToolExecutor(new Map([['financial_search', fakeTool]]));
    const ctx = makeCtx();
    const args = { query: 'AAPL stock price' };

    const msg = new AIMessage({
      content: '',
      tool_calls: [{ id: 'c1', name: 'financial_search', args, type: 'tool_call' as const }],
    });

    // First agent iteration
    const events1 = await drainEvents(executor.executeAll(msg, ctx));
    // Second agent iteration — same tool, same args → should hit cache
    const events2 = await drainEvents(executor.executeAll(msg, ctx));

    expect(fakeTool.invocationCount).toBe(1);

    const end1 = events1.find((e) => e.type === 'tool_end') as ToolEndEvent | undefined;
    const end2 = events2.find((e) => e.type === 'tool_end') as ToolEndEvent | undefined;
    expect(end1?.result).toBe('{"price": 100}');
    expect(end2?.result).toBe('{"price": 100}');
  });

  it('the second sequential call has duration=0 (served from cache)', async () => {
    const fakeTool = makeFakeTool('financial_search', 'cached result');
    const executor = new AgentToolExecutor(new Map([['financial_search', fakeTool]]));
    const ctx = makeCtx();
    const args = { query: 'BTC' };

    const msg = new AIMessage({
      content: '',
      tool_calls: [{ id: 'c1', name: 'financial_search', args, type: 'tool_call' as const }],
    });

    await drainEvents(executor.executeAll(msg, ctx));
    const events = await drainEvents(executor.executeAll(msg, ctx));

    const end = events.find((e) => e.type === 'tool_end') as ToolEndEvent | undefined;
    expect(end?.duration).toBe(0);
  });

  it('uses separate cache entries for different args', async () => {
    const fakeTool = makeFakeTool('financial_search', 'result');
    const executor = new AgentToolExecutor(new Map([['financial_search', fakeTool]]));
    const ctx = makeCtx();

    const msg1 = new AIMessage({
      content: '',
      tool_calls: [{ id: 'c1', name: 'financial_search', args: { query: 'AAPL' }, type: 'tool_call' as const }],
    });
    const msg2 = new AIMessage({
      content: '',
      tool_calls: [{ id: 'c2', name: 'financial_search', args: { query: 'MSFT' }, type: 'tool_call' as const }],
    });

    await drainEvents(executor.executeAll(msg1, ctx));
    await drainEvents(executor.executeAll(msg2, ctx));

    expect(fakeTool.invocationCount).toBe(2);
  });

  it('cache key is stable regardless of arg property order', async () => {
    const fakeTool = makeFakeTool('financial_search', 'stable');
    const executor = new AgentToolExecutor(new Map([['financial_search', fakeTool]]));
    const ctx = makeCtx();

    // Same logical args, different property order
    const msg1 = new AIMessage({
      content: '',
      tool_calls: [{ id: 'c1', name: 'financial_search', args: { b: 2, a: 1 }, type: 'tool_call' as const }],
    });
    const msg2 = new AIMessage({
      content: '',
      tool_calls: [{ id: 'c2', name: 'financial_search', args: { a: 1, b: 2 }, type: 'tool_call' as const }],
    });

    await drainEvents(executor.executeAll(msg1, ctx));
    await drainEvents(executor.executeAll(msg2, ctx));

    expect(fakeTool.invocationCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Uncacheable tools are never cached (tested with sequential calls).
// Note: write_file and edit_file require user approval; we exclude those
// from this basic test and cover them separately.
// ---------------------------------------------------------------------------
describe('AgentToolExecutor — uncacheable tools bypass cache', () => {
  const NON_APPROVAL_UNCACHEABLE = ['browser', 'sequential_thinking', 'create_file', 'memory_store'];

  for (const toolName of NON_APPROVAL_UNCACHEABLE) {
    it(`does not cache '${toolName}' calls`, async () => {
      const fakeTool = makeFakeTool(toolName, 'result');
      const executor = new AgentToolExecutor(new Map([[toolName, fakeTool]]));
      const ctx = makeCtx();

      const msg = new AIMessage({
        content: '',
        tool_calls: [{ id: 'c1', name: toolName, args: { query: 'same args' }, type: 'tool_call' as const }],
      });

      await drainEvents(executor.executeAll(msg, ctx));
      await drainEvents(executor.executeAll(msg, ctx));

      expect(fakeTool.invocationCount).toBe(2);
    });
  }

  it('skill is deduplicated at scratchpad level (not re-run in same session)', async () => {
    const fakeTool = makeFakeTool('skill', 'skill result');
    const executor = new AgentToolExecutor(new Map([['skill', fakeTool]]));
    const ctx = makeCtx();

    const msg = new AIMessage({
      content: '',
      tool_calls: [{ id: 'c1', name: 'skill', args: { skill: 'dcf-valuation', ticker: 'AAPL' }, type: 'tool_call' as const }],
    });

    await drainEvents(executor.executeAll(msg, ctx));
    // Second call — scratchpad says skill already ran → filtered before invoke
    await drainEvents(executor.executeAll(msg, ctx));

    // Second invocation is suppressed by scratchpad-level dedup (not cache)
    expect(fakeTool.invocationCount).toBe(1);
  });

  it('does not cache write_file even when session-approved', async () => {
    const fakeTool = makeFakeTool('write_file', 'ok');
    // Pre-approve the tool so approval doesn't block invocation
    const approved = new Set(['write_file']);
    const executor = new AgentToolExecutor(
      new Map([['write_file', fakeTool]]),
      undefined,
      async () => 'allow-once' as const,
      approved,
    );
    const ctx = makeCtx();

    const msg = new AIMessage({
      content: '',
      tool_calls: [{ id: 'c1', name: 'write_file', args: { path: 'test.txt', content: 'hello' }, type: 'tool_call' as const }],
    });

    await drainEvents(executor.executeAll(msg, ctx));
    await drainEvents(executor.executeAll(msg, ctx));

    expect(fakeTool.invocationCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// tool_start still fires on cache hit
// ---------------------------------------------------------------------------
describe('AgentToolExecutor — tool_start on cache hit', () => {
  it('emits tool_start even when result is served from cache', async () => {
    const fakeTool = makeFakeTool('web_search', 'result');
    const executor = new AgentToolExecutor(new Map([['web_search', fakeTool]]));
    const ctx = makeCtx();

    const msg = new AIMessage({
      content: '',
      tool_calls: [{ id: 'c1', name: 'web_search', args: { query: 'gold price' }, type: 'tool_call' as const }],
    });

    // Warm the cache
    await drainEvents(executor.executeAll(msg, ctx));
    // Second call — cache hit should still emit tool_start
    const events = await drainEvents(executor.executeAll(msg, ctx));
    const starts = events.filter((e) => e.type === 'tool_start') as ToolStartEvent[];
    expect(starts.length).toBe(1);
  });
});
