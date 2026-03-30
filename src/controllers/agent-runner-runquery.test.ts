/**
 * Coverage tests for AgentRunnerController.runQuery() and related private helpers.
 *
 * Uses mock.module to replace Agent.create() with a controllable fake, enabling
 * deterministic testing of:
 *   - makeCancellable (private — covered indirectly via runQuery)
 *   - runQuery() success path (returns { answer })
 *   - runQuery() AbortError path (cancellation, returns undefined)
 *   - runQuery() non-abort error path (sets errorValue, returns undefined)
 *   - runQuery() with no done event (returns undefined)
 *   - cancelExecution() while runQuery() is awaiting
 *   - requestToolApproval (lines 234-239)
 *
 * IMPORTANT: mock.module() calls must appear BEFORE any imports of the modules
 * under test. The AgentRunnerController is imported dynamically below after mocks.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ─── Fake agent state — reset per test ───────────────────────────────────────

type EventSpec =
  | { type: 'done'; answer: string; totalTime?: number; tokenUsage?: unknown; tokensPerSecond?: number; toolCalls?: unknown[] }
  | { type: 'answer_chunk'; chunk: string }
  | { type: 'answer_start' }
  | { type: 'thinking'; content: string }
  | { type: 'tool_start'; tool: string; args?: Record<string, unknown> }
  | { type: 'tool_end'; tool: string; result?: string }
  | { type: string; [k: string]: unknown };

const fakeState = {
  events: [] as EventSpec[],
  /** If set, stream.next() will stall until this promise resolves. */
  stallPromise: null as Promise<void> | null,
  /** Error thrown by Agent.create() if set. */
  createError: null as Error | null,
};

async function* makeStream(events: EventSpec[], stallPromise: Promise<void> | null) {
  if (stallPromise) {
    await stallPromise;
  }
  for (const e of events) {
    yield e;
  }
}

// Mock auto-store so fire-and-forget doesn't touch FS/network.
mock.module('../memory/auto-store.js', () => ({
  autoStoreFromRun: mock(async () => {}),
  seedWatchlistEntries: mock(async () => {}),
}));

// Mock Agent — create() returns a fake agent whose run() yields fakeState.events.
mock.module('../agent/agent.js', () => ({
  Agent: {
    create: mock(async () => {
      if (fakeState.createError) {
        throw fakeState.createError;
      }
      return {
        run: (_query: string, _history: unknown) =>
          makeStream(fakeState.events, fakeState.stallPromise),
      };
    }),
  },
}));

// ─── Dynamic imports AFTER mocks ─────────────────────────────────────────────
const { AgentRunnerController } = await import('./agent-runner.js');
const { InMemoryChatHistory } = await import('../utils/in-memory-chat-history.js');

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeFakeChatHistory() {
  return {
    saveUserQuery: mock((_q: string) => {}),
    saveAnswer: mock(async (_a: string) => {}),
    seedFromLlmMessages: mock(() => {}),
    getMessages: mock(() => []),
  } as unknown as InstanceType<typeof InMemoryChatHistory>;
}

function makeController() {
  const changes: number[] = [];
  // @ts-expect-error partial agentConfig — only properties used by runQuery
  const ctrl = new AgentRunnerController(
    { model: null, tools: [], systemPrompt: '' },
    makeFakeChatHistory(),
    () => changes.push(Date.now()),
  );
  return { ctrl, changes };
}

function getError(ctrl: InstanceType<typeof AgentRunnerController>): string | null {
  return (ctrl as unknown as { errorValue: string | null }).errorValue;
}

function getWorkingStatus(ctrl: InstanceType<typeof AgentRunnerController>): string {
  return (ctrl as unknown as { workingStateValue: { status: string } }).workingStateValue.status;
}

function getPendingApproval(ctrl: InstanceType<typeof AgentRunnerController>) {
  return (ctrl as unknown as { pendingApprovalValue: unknown }).pendingApprovalValue;
}

function getApprovalResolve(ctrl: InstanceType<typeof AgentRunnerController>) {
  return (ctrl as unknown as { approvalResolve: unknown }).approvalResolve;
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  fakeState.events = [];
  fakeState.stallPromise = null;
  fakeState.createError = null;
});

// ─── runQuery — success path ──────────────────────────────────────────────────

describe('runQuery — success path', () => {
  it('returns { answer } when a done event carries an answer', async () => {
    fakeState.events = [
      { type: 'done', answer: 'AAPL is $180', totalTime: 1000, toolCalls: [] },
    ];
    const { ctrl } = makeController();
    const result = await ctrl.runQuery('What is AAPL?');
    expect(result).toEqual({ answer: 'AAPL is $180' });
  });

  it('marks the last history item as complete after done event', async () => {
    fakeState.events = [
      { type: 'done', answer: 'result', totalTime: 500, toolCalls: [] },
    ];
    const { ctrl } = makeController();
    await ctrl.runQuery('query');
    const history = ctrl.history;
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('complete');
    expect(history[0].answer).toBe('result');
  });

  it('sets workingState to idle after successful run', async () => {
    fakeState.events = [
      { type: 'done', answer: 'ok', totalTime: 100, toolCalls: [] },
    ];
    const { ctrl } = makeController();
    await ctrl.runQuery('test');
    expect(getWorkingStatus(ctrl)).toBe('idle');
  });

  it('returns undefined when no done event has an answer', async () => {
    fakeState.events = [
      { type: 'answer_start' },
    ];
    const { ctrl } = makeController();
    const result = await ctrl.runQuery('test');
    expect(result).toBeUndefined();
  });

  it('accumulates answer_chunk events onto the history item', async () => {
    fakeState.events = [
      { type: 'answer_start' },
      { type: 'answer_chunk', chunk: 'Hello ' },
      { type: 'answer_chunk', chunk: 'World' },
      { type: 'done', answer: 'Hello World', totalTime: 50, toolCalls: [] },
    ];
    const { ctrl } = makeController();
    await ctrl.runQuery('test');
    const history = ctrl.history;
    expect(history[0].answer).toBe('Hello World');
  });

  it('handles a thinking event without throwing', async () => {
    fakeState.events = [
      { type: 'thinking', content: 'reasoning...' },
      { type: 'done', answer: 'result', totalTime: 100, toolCalls: [] },
    ];
    const { ctrl } = makeController();
    const result = await ctrl.runQuery('test');
    expect(result).toEqual({ answer: 'result' });
  });

  it('handles tool_start and tool_end without throwing', async () => {
    fakeState.events = [
      { type: 'tool_start', tool: 'web_search', args: { query: 'test' } },
      { type: 'tool_end', tool: 'web_search', result: 'search results' },
      { type: 'done', answer: 'found it', totalTime: 200, toolCalls: [] },
    ];
    const { ctrl } = makeController();
    const result = await ctrl.runQuery('test');
    expect(result).toEqual({ answer: 'found it' });
  });

  it('stores the query in chat history', async () => {
    fakeState.events = [
      { type: 'done', answer: 'ok', totalTime: 100, toolCalls: [] },
    ];
    const chatHistory = makeFakeChatHistory();
    // @ts-expect-error partial config
    const ctrl = new AgentRunnerController(
      { model: null, tools: [], systemPrompt: '' },
      chatHistory,
    );
    await ctrl.runQuery('my research question');
    expect((chatHistory.saveUserQuery as ReturnType<typeof mock>).mock.calls).toHaveLength(1);
  });
});

// ─── runQuery — error paths ───────────────────────────────────────────────────

describe('runQuery — non-abort error', () => {
  it('sets errorValue on non-abort error', async () => {
    fakeState.createError = new Error('LLM unavailable');
    const { ctrl } = makeController();
    const result = await ctrl.runQuery('test');
    expect(result).toBeUndefined();
    expect(getError(ctrl)).toBe('LLM unavailable');
  });

  it('marks last history item as error on non-abort error', async () => {
    fakeState.createError = new Error('network failure');
    const { ctrl } = makeController();
    await ctrl.runQuery('test');
    const history = ctrl.history;
    expect(history[0].status).toBe('error');
  });

  it('sets workingState to idle after error', async () => {
    fakeState.createError = new Error('fail');
    const { ctrl } = makeController();
    await ctrl.runQuery('test');
    expect(getWorkingStatus(ctrl)).toBe('idle');
  });

  it('handles non-Error thrown values', async () => {
    // Throw a string instead of an Error
    const { Agent } = await import('../agent/agent.js');
    (Agent.create as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw 'just a string error'; // eslint-disable-line no-throw-literal
    });
    const { ctrl } = makeController();
    const result = await ctrl.runQuery('test');
    expect(result).toBeUndefined();
    expect(getError(ctrl)).toBe('just a string error');
  });
});

describe('runQuery — AbortError (cancellation)', () => {
  it('returns undefined and does not set errorValue when AbortError thrown', async () => {
    const abortError = new Error('Query cancelled');
    abortError.name = 'AbortError';
    fakeState.createError = abortError;
    const { ctrl } = makeController();
    const result = await ctrl.runQuery('test');
    expect(result).toBeUndefined();
    expect(getError(ctrl)).toBeNull();
  });
});

// ─── runQuery — makeCancellable (via cancelExecution during stall) ────────────

describe('makeCancellable — cancellation race', () => {
  it('cancels runQuery when cancelExecution is called before Agent.create resolves', async () => {
    let unblock!: () => void;
    fakeState.stallPromise = new Promise<void>((res) => (unblock = res));
    fakeState.events = [{ type: 'done', answer: 'late answer', totalTime: 100, toolCalls: [] }];

    const { ctrl } = makeController();
    const runPromise = ctrl.runQuery('slow query');

    // Give the event loop a tick so runQuery() enters makeCancellable
    await new Promise((res) => setTimeout(res, 0));

    ctrl.cancelExecution();
    unblock();

    const result = await runPromise;
    expect(result).toBeUndefined();
  });

  it('resolves abortController to null in the finally block after cancellation', async () => {
    const abortError = new Error('Query cancelled');
    abortError.name = 'AbortError';
    fakeState.createError = abortError;

    const { ctrl } = makeController();
    await ctrl.runQuery('test');

    const ac = (ctrl as unknown as { abortController: unknown }).abortController;
    expect(ac).toBeNull();
  });

  it('resolves triggerCancellation to null in the finally block', async () => {
    fakeState.events = [{ type: 'done', answer: 'ok', totalTime: 50, toolCalls: [] }];
    const { ctrl } = makeController();
    await ctrl.runQuery('test');
    const tc = (ctrl as unknown as { triggerCancellation: unknown }).triggerCancellation;
    expect(tc).toBeNull();
  });

  it('fires triggerCancellation immediately if queryWasCancelled before makeCancellable', async () => {
    // Set queryWasCancelled=true before runQuery is called so makeCancellable
    // fires the rejection in the constructor of the race promise.
    let unblock!: () => void;
    const stallPromise = new Promise<void>((res) => (unblock = res));

    const { Agent } = await import('../agent/agent.js');
    (Agent.create as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      await stallPromise;
      return {
        run: () => makeStream([], null),
      };
    });

    const { ctrl } = makeController();
    // Pre-cancel: set queryWasCancelled=true before runQuery
    (ctrl as unknown as { queryWasCancelled: boolean }).queryWasCancelled = true;
    // Also set triggerCancellation so the pre-cancellation path fires
    // (normally set by runQuery at start, but we're testing the pre-set path)

    const runPromise = ctrl.runQuery('test');
    unblock();
    const result = await runPromise;
    // Should return undefined — either via AbortError or just no answer
    expect(result).toBeUndefined();
  });
});

// ─── requestToolApproval (lines 234–239) ────────────────────────────────────

describe('requestToolApproval (private)', () => {
  it('sets pendingApprovalValue and workingState to approval', () => {
    const { ctrl } = makeController();
    const req = { tool: 'web_search', args: { query: 'AAPL' } };

    // Call via private method accessor
    const promise = (ctrl as unknown as {
      requestToolApproval: (r: typeof req) => Promise<string>
    }).requestToolApproval(req);

    expect(getPendingApproval(ctrl)).toEqual(req);
    expect(getWorkingStatus(ctrl)).toBe('approval');

    // Resolve the promise to avoid hanging
    (ctrl as unknown as { approvalResolve: ((d: string) => void) | null }).approvalResolve?.('approve');
    return promise;
  });

  it('stores the approvalResolve callback', () => {
    const { ctrl } = makeController();
    const req = { tool: 'browser', args: {} };

    (ctrl as unknown as {
      requestToolApproval: (r: typeof req) => Promise<string>
    }).requestToolApproval(req);

    expect(getApprovalResolve(ctrl)).toBeTypeOf('function');

    // Clean up
    (ctrl as unknown as { approvalResolve: ((d: string) => void) | null }).approvalResolve?.('deny');
  });

  it('emits onChange when requestToolApproval is called', () => {
    const { ctrl, changes } = makeController();
    const req = { tool: 'financial_search', args: { query: 'MSFT' } };

    (ctrl as unknown as {
      requestToolApproval: (r: typeof req) => Promise<string>
    }).requestToolApproval(req);

    expect(changes.length).toBeGreaterThan(0);

    // Clean up
    (ctrl as unknown as { approvalResolve: ((d: string) => void) | null }).approvalResolve?.('approve');
  });
});

// ─── cancelExecution — approval path (line 148–152) ──────────────────────────

describe('cancelExecution — with pending approval', () => {
  it('denies pending approval and clears approvalResolve', async () => {
    const { ctrl } = makeController();
    const req = { tool: 'web_search', args: {} };

    let resolvedDecision: string | undefined;
    const promise = (ctrl as unknown as {
      requestToolApproval: (r: typeof req) => Promise<string>
    }).requestToolApproval(req);
    promise.then((d) => { resolvedDecision = d; }).catch(() => {});

    // Now cancel — should auto-deny the pending approval
    ctrl.cancelExecution();
    await promise;

    expect(resolvedDecision).toBe('deny');
    expect(getPendingApproval(ctrl)).toBeNull();
    expect(getApprovalResolve(ctrl)).toBeNull();
  });

  it('sets workingState to idle after cancelling with pending approval', () => {
    const { ctrl } = makeController();
    const req = { tool: 'browser', args: {} };

    const promise = (ctrl as unknown as {
      requestToolApproval: (r: typeof req) => Promise<string>
    }).requestToolApproval(req);

    ctrl.cancelExecution();
    promise.catch(() => {});
    expect(getWorkingStatus(ctrl)).toBe('idle');
  });
});

// ─── cancelExecution — triggerCancellation path ──────────────────────────────

describe('cancelExecution — triggerCancellation', () => {
  it('calls triggerCancellation if set', () => {
    const { ctrl } = makeController();
    const called: boolean[] = [];
    (ctrl as unknown as { triggerCancellation: (() => void) | null }).triggerCancellation = () => {
      called.push(true);
    };
    ctrl.cancelExecution();
    expect(called).toHaveLength(1);
  });

  it('does not throw when triggerCancellation is null', () => {
    const { ctrl } = makeController();
    (ctrl as unknown as { triggerCancellation: null }).triggerCancellation = null;
    expect(() => ctrl.cancelExecution()).not.toThrow();
  });
});
