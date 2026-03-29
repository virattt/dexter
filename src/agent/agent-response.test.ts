/**
 * Regression tests for agent response delivery.
 *
 * Guards three specific fixes made to handleDirectResponse():
 *
 * 1. No redundant streamCallLlm call when callLlm already returned an answer.
 *    The original bug caused multi-minute hangs: streamCallLlm has no timeout
 *    and was called even when the model's text answer was already available.
 *
 * 2. Synthesis stream (streamCallLlm) IS called at max iterations when there
 *    is no pre-existing answer — the one legitimate case for the extra call.
 *
 * 3. Synthesis timeout is graceful: if streamCallLlm throws (e.g. AbortError
 *    from the hard timeout), the agent emits a done event rather than hanging
 *    or producing a blank response.
 *
 * 4. Thinking text is truncated to 500 chars so verbose models (e.g. Qwen)
 *    that embed raw JSON in their reasoning text don't flood the terminal.
 */
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AgentEvent, DoneEvent, AnswerChunkEvent } from './types.js';

// ---------------------------------------------------------------------------
// Mutable mock state — reset before each test.
// ---------------------------------------------------------------------------
const mockState = {
  /** Number of times streamCallLlm was called. Key regression metric. */
  streamCallCount: 0,
  /** When true, callLlm returns tool_calls instead of a direct text answer. */
  invokeReturnsToolCalls: false,
  /** Text content returned alongside tool_calls (simulates model reasoning). */
  invokeThinkingText: '',
  /** Direct answer returned when invokeReturnsToolCalls is false. */
  invokeContent: 'The direct answer from callLlm',
  /** Chunks yielded by streamCallLlm (synthesis path). */
  streamChunks: ['synthesis result'] as string[],
  /** When true, streamCallLlm throws immediately (simulates timeout). */
  streamShouldThrow: false,
};

const ST_TOOL_CALL = {
  id: 'st1',
  name: 'sequential_thinking',
  args: {
    thought: 'analyzing...',
    nextThoughtNeeded: false,
    thoughtNumber: 1,
    totalThoughts: 1,
  },
  type: 'tool_call' as const,
};

// ---------------------------------------------------------------------------
// Mock callLlm + streamCallLlm at the module boundary.
// Mocking at this level (rather than @langchain/openai) avoids the providerMap
// cache-poisoning issue and gives precise control over call tracking.
// ---------------------------------------------------------------------------
mock.module('../model/llm.js', () => ({
  DEFAULT_MODEL: 'gpt-5.4',
  callLlm: async () => {
    if (mockState.invokeReturnsToolCalls) {
      return {
        response: {
          content: mockState.invokeThinkingText,
          tool_calls: [ST_TOOL_CALL],
          additional_kwargs: {},
        },
        usage: undefined,
      };
    }
    return {
      response: {
        content: mockState.invokeContent,
        tool_calls: [],
        additional_kwargs: {},
      },
      usage: undefined,
    };
  },
  streamCallLlm: async function* (_prompt: string, opts: { signal?: AbortSignal } = {}) {
    mockState.streamCallCount++;
    if (mockState.streamShouldThrow) {
      throw new Error('LLM stream timed out');
    }
    for (const chunk of mockState.streamChunks) {
      if (opts.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      yield chunk;
    }
  },
  resolveProvider: (model: string) => ({ id: 'openai', displayName: model }),
  formatUserFacingError: (msg: string) => msg,
  isContextOverflowError: () => false,
}));

// Mock memory to avoid SQLite initialization.
mock.module('../memory/index.js', () => ({
  MemoryManager: {
    get: async () => ({
      listFiles: async () => [],
      loadSessionContext: async () => ({ text: '' }),
      saveAnswer: async () => {},
    }),
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks are registered.
// ---------------------------------------------------------------------------
const { Agent } = await import('./agent.js');

// ---------------------------------------------------------------------------
// Test environment helpers
// ---------------------------------------------------------------------------
let tmpDir: string;
let originalCwd: string;
let prevOpenAiKey: string | undefined;

beforeEach(() => {
  mockState.streamCallCount = 0;
  mockState.invokeReturnsToolCalls = false;
  mockState.invokeThinkingText = '';
  mockState.invokeContent = 'The direct answer from callLlm';
  mockState.streamChunks = ['synthesis result'];
  mockState.streamShouldThrow = false;

  tmpDir = join(tmpdir(), `agent-resp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  originalCwd = process.cwd();
  process.chdir(tmpDir);

  prevOpenAiKey = process.env.OPENAI_API_KEY;
  if (!prevOpenAiKey) process.env.OPENAI_API_KEY = 'sk-test-stub';
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
  if (!prevOpenAiKey) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = prevOpenAiKey;
});

async function collectEvents(gen: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

// ---------------------------------------------------------------------------
// 1. No redundant streamCallLlm when callLlm already has the answer
// ---------------------------------------------------------------------------

describe('Agent — no redundant stream call for direct answers', () => {
  beforeEach(() => {
    mockState.invokeReturnsToolCalls = false;
  });

  it('streamCallLlm is never invoked when the model returns a text answer', async () => {
    const agent = await Agent.create({ model: 'gpt-5.4', maxIterations: 3, memoryEnabled: false });
    await collectEvents(agent.run('test query'));
    expect(mockState.streamCallCount).toBe(0);
  });

  it('done.answer matches callLlm content, not the stream chunks', async () => {
    mockState.invokeContent = 'Unique answer from invoke';
    mockState.streamChunks = ['Should not appear in answer'];

    const agent = await Agent.create({ model: 'gpt-5.4', maxIterations: 3, memoryEnabled: false });
    const events = await collectEvents(agent.run('test query'));
    const done = events.find((e) => e.type === 'done') as DoneEvent | undefined;

    expect(done?.answer).toContain('Unique answer from invoke');
    expect(done?.answer).not.toContain('Should not appear in answer');
  });

  it('answer_chunk events concatenate to the callLlm response text', async () => {
    mockState.invokeContent = 'Short answer';

    const agent = await Agent.create({ model: 'gpt-5.4', maxIterations: 3, memoryEnabled: false });
    const events = await collectEvents(agent.run('test query'));

    const chunks = events.filter((e) => e.type === 'answer_chunk') as AnswerChunkEvent[];
    const done = events.find((e) => e.type === 'done') as DoneEvent | undefined;

    const assembled = chunks.map((c) => c.chunk).join('');
    expect(assembled).toBe('Short answer');
    expect(done?.answer).toBe('Short answer');
  });

  it('done event is emitted without waiting for a second LLM call', async () => {
    // If streamCallLlm were called (the old bug), it would be a second async op.
    // With the fix we get immediate fake-streaming — done arrives right away.
    const agent = await Agent.create({ model: 'gpt-5.4', maxIterations: 3, memoryEnabled: false });
    const start = Date.now();
    await collectEvents(agent.run('test query'));
    const elapsed = Date.now() - start;

    // Should complete in well under 1 second (no real LLM calls, no second trip).
    expect(elapsed).toBeLessThan(1000);
    expect(mockState.streamCallCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. streamCallLlm IS used for max-iterations synthesis
// ---------------------------------------------------------------------------

describe('Agent — streamCallLlm used for max-iterations synthesis', () => {
  beforeEach(() => {
    mockState.invokeReturnsToolCalls = true;
    mockState.streamChunks = ['synthesized conclusion'];
  });

  it('streamCallLlm is called when max iterations is hit (synthesis path)', async () => {
    const agent = await Agent.create({ model: 'gpt-5.4', maxIterations: 2, memoryEnabled: false });
    await collectEvents(agent.run('test query'));
    expect(mockState.streamCallCount).toBeGreaterThanOrEqual(1);
  });

  it('done.answer contains synthesis output when max iterations is hit', async () => {
    mockState.streamChunks = ['synthesis output for max iterations'];
    const agent = await Agent.create({ model: 'gpt-5.4', maxIterations: 2, memoryEnabled: false });
    const events = await collectEvents(agent.run('test query'));
    const done = events.find((e) => e.type === 'done') as DoneEvent | undefined;
    expect(done?.answer).toContain('synthesis output for max iterations');
  });
});

// ---------------------------------------------------------------------------
// 3. Synthesis timeout is graceful (streamCallLlm throws)
// ---------------------------------------------------------------------------

describe('Agent — synthesis timeout graceful fallback', () => {
  beforeEach(() => {
    mockState.invokeReturnsToolCalls = true;
    mockState.streamShouldThrow = true;
  });

  it('done event is always emitted even when streamCallLlm throws', async () => {
    const agent = await Agent.create({ model: 'gpt-5.4', maxIterations: 2, memoryEnabled: false });
    const events = await collectEvents(agent.run('test query'));
    const doneEvents = events.filter((e) => e.type === 'done');
    expect(doneEvents.length).toBe(1);
  });

  it('done event is the last event emitted after synthesis failure', async () => {
    const agent = await Agent.create({ model: 'gpt-5.4', maxIterations: 2, memoryEnabled: false });
    const events = await collectEvents(agent.run('test query'));
    expect(events.at(-1)?.type).toBe('done');
  });

  it('answer_start is emitted before done even when synthesis fails', async () => {
    const agent = await Agent.create({ model: 'gpt-5.4', maxIterations: 2, memoryEnabled: false });
    const events = await collectEvents(agent.run('test query'));

    const startIdx = events.findIndex((e) => e.type === 'answer_start');
    const doneIdx = events.findIndex((e) => e.type === 'done');

    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(doneIdx).toBeGreaterThan(startIdx);
  });
});

// ---------------------------------------------------------------------------
// 4. Thinking text truncation (prevents raw JSON from flooding the terminal)
// ---------------------------------------------------------------------------

describe('Agent — thinking text truncation', () => {
  beforeEach(() => {
    // Two iterations: first with tool_calls + long thinking, second returns answer.
    let callCount = 0;
    mockState.invokeThinkingText = 'T'.repeat(1000); // 1000-char "thinking" blob

    // Override callLlm to return tool_calls on iteration 1, text on iteration 2
    mock.module('../model/llm.js', () => ({
      DEFAULT_MODEL: 'gpt-5.4',
      callLlm: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            response: {
              content: mockState.invokeThinkingText,
              tool_calls: [ST_TOOL_CALL],
              additional_kwargs: {},
            },
            usage: undefined,
          };
        }
        return {
          response: {
            content: 'Final answer',
            tool_calls: [],
            additional_kwargs: {},
          },
          usage: undefined,
        };
      },
      streamCallLlm: async function* (_p: string) {
        mockState.streamCallCount++;
        yield 'stream answer';
      },
      resolveProvider: (model: string) => ({ id: 'openai', displayName: model }),
      formatUserFacingError: (msg: string) => msg,
      isContextOverflowError: () => false,
    }));
  });

  it('thinking event message is at most 501 chars (500 + ellipsis)', async () => {
    const agent = await Agent.create({ model: 'gpt-5.4', maxIterations: 5, memoryEnabled: false });
    const events = await collectEvents(agent.run('test query'));

    const thinkingEvents = events.filter((e) => e.type === 'thinking');
    expect(thinkingEvents.length).toBeGreaterThan(0);

    for (const evt of thinkingEvents) {
      const msg = (evt as { type: 'thinking'; message: string }).message;
      expect(msg.length).toBeLessThanOrEqual(501); // 500 chars + '…'
    }
  });

  it('truncated thinking ends with ellipsis when source text exceeds 500 chars', async () => {
    const agent = await Agent.create({ model: 'gpt-5.4', maxIterations: 5, memoryEnabled: false });
    const events = await collectEvents(agent.run('test query'));

    const thinkEvt = events.find((e) => e.type === 'thinking') as
      | { type: 'thinking'; message: string }
      | undefined;

    expect(thinkEvt).toBeDefined();
    expect(thinkEvt!.message.endsWith('…')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildSourcesFooter (pure function tests)
// ---------------------------------------------------------------------------

describe('buildSourcesFooter', () => {
  let buildSourcesFooter: (urls: string[]) => string;

  beforeEach(async () => {
    ({ buildSourcesFooter } = await import('./agent.js'));
  });

  it('returns empty string for no URLs', () => {
    expect(buildSourcesFooter([])).toBe('');
  });

  it('includes all URLs as a numbered list', () => {
    const footer = buildSourcesFooter(['https://a.com', 'https://b.com']);
    expect(footer).toContain('1. https://a.com');
    expect(footer).toContain('2. https://b.com');
    expect(footer).toContain('**Sources**');
  });

  it('caps output at 10 URLs', () => {
    const urls = Array.from({ length: 15 }, (_, i) => `https://site${i}.com`);
    const footer = buildSourcesFooter(urls);
    expect(footer).toContain('10. https://site9.com');
    expect(footer).not.toContain('11.');
  });

  it('deduplicates repeated URLs', () => {
    const footer = buildSourcesFooter(['https://a.com', 'https://a.com', 'https://b.com']);
    const matches = footer.match(/https:\/\/a\.com/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('excludes Reddit URLs from the footer', () => {
    const footer = buildSourcesFooter([
      'https://reddit.com/r/Bitcoin/comments/abc',
      'https://www.reddit.com/r/investing/comments/xyz',
    ]);
    expect(footer).toBe('');
  });

  it('excludes X/Twitter URLs from the footer', () => {
    const footer = buildSourcesFooter([
      'https://x.com/user/status/123',
      'https://twitter.com/user/status/456',
    ]);
    expect(footer).toBe('');
  });

  it('includes non-social URLs while filtering social ones', () => {
    const footer = buildSourcesFooter([
      'https://reddit.com/r/Bitcoin/comments/abc',
      'https://financialmodelingprep.com/api/v3/profile/BTC',
      'https://polymarket.com/event/bitcoin-price',
    ]);
    expect(footer).not.toContain('reddit.com');
    expect(footer).toContain('financialmodelingprep.com');
    expect(footer).toContain('polymarket.com');
  });
});
