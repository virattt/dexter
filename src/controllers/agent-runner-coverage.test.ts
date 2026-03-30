/**
 * Additional coverage tests for AgentRunnerController.
 *
 * Covers the public API (setThinkEnabled, loadHistory, setError, respondToApproval,
 * cancelExecution, isProcessing) and all handleEvent case branches not exercised
 * by the existing parallel-tool tests.
 */

import { describe, it, expect, mock } from 'bun:test';
import { AgentRunnerController } from './agent-runner.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import type { HistoryItem } from '../types.js';
import type {
  AnswerChunkEvent,
  DoneEvent,
  ToolStartEvent,
} from '../agent/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeChatHistory() {
  return {
    saveUserQuery: mock((_q: string) => {}),
    saveAnswer: mock(async (_a: string) => {}),
    seedFromLlmMessages: mock(() => {}),
    getMessages: mock(() => []),
  } as unknown as InMemoryChatHistory;
}

function makeController(chatHistory?: InMemoryChatHistory) {
  const changes: number[] = [];
  // @ts-expect-error partial agentConfig — only testing non-runQuery paths
  const ctrl = new AgentRunnerController(
    { model: null, tools: [], systemPrompt: '' },
    chatHistory ?? makeFakeChatHistory(),
    () => changes.push(Date.now()),
  );
  return { ctrl, changes };
}

function seedProcessingItem(ctrl: AgentRunnerController, partial: Partial<HistoryItem> = {}) {
  (ctrl as unknown as { historyValue: HistoryItem[] }).historyValue = [
    {
      id: 'test-item',
      query: 'test query',
      events: [],
      answer: '',
      status: 'processing',
      startTime: Date.now(),
      ...partial,
    },
  ];
}

function getHistory(ctrl: AgentRunnerController): HistoryItem[] {
  return (ctrl as unknown as { historyValue: HistoryItem[] }).historyValue;
}

async function fire(ctrl: AgentRunnerController, event: object) {
  await (ctrl as unknown as { handleEvent: (e: unknown) => Promise<void> }).handleEvent(event);
}

// ---------------------------------------------------------------------------
// setThinkEnabled
// ---------------------------------------------------------------------------

describe('AgentRunnerController — setThinkEnabled', () => {
  it('sets thinkEnabled to true in agentConfig', () => {
    const { ctrl } = makeController();
    ctrl.setThinkEnabled(true);
    const cfg = (ctrl as unknown as { agentConfig: { thinkEnabled?: boolean } }).agentConfig;
    expect(cfg.thinkEnabled).toBe(true);
  });

  it('sets thinkEnabled to false in agentConfig', () => {
    const { ctrl } = makeController();
    ctrl.setThinkEnabled(false);
    const cfg = (ctrl as unknown as { agentConfig: { thinkEnabled?: boolean } }).agentConfig;
    expect(cfg.thinkEnabled).toBe(false);
  });

  it('sets thinkEnabled to undefined in agentConfig', () => {
    const { ctrl } = makeController();
    ctrl.setThinkEnabled(undefined);
    const cfg = (ctrl as unknown as { agentConfig: { thinkEnabled?: boolean } }).agentConfig;
    expect(cfg.thinkEnabled).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// loadHistory
// ---------------------------------------------------------------------------

describe('AgentRunnerController — loadHistory', () => {
  it('replaces historyValue with the given items', () => {
    const { ctrl } = makeController();
    const items: HistoryItem[] = [
      { id: 'a', query: 'q1', events: [], answer: 'ans', status: 'complete', startTime: 1 },
    ];
    ctrl.loadHistory(items);
    expect(ctrl.history).toHaveLength(1);
    expect(ctrl.history[0].id).toBe('a');
  });

  it('stores a copy (mutation of input does not affect stored history)', () => {
    const { ctrl } = makeController();
    const items: HistoryItem[] = [
      { id: 'b', query: 'q2', events: [], answer: '', status: 'complete', startTime: 1 },
    ];
    ctrl.loadHistory(items);
    items.push({ id: 'c', query: 'q3', events: [], answer: '', status: 'complete', startTime: 2 });
    expect(ctrl.history).toHaveLength(1);
  });

  it('emits onChange after loading', () => {
    const { ctrl, changes } = makeController();
    ctrl.loadHistory([]);
    expect(changes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// setError
// ---------------------------------------------------------------------------

describe('AgentRunnerController — setError', () => {
  it('sets error to the given string', () => {
    const { ctrl } = makeController();
    ctrl.setError('something went wrong');
    expect(ctrl.error).toBe('something went wrong');
  });

  it('clears error when called with null', () => {
    const { ctrl } = makeController();
    ctrl.setError('err');
    ctrl.setError(null);
    expect(ctrl.error).toBeNull();
  });

  it('emits onChange', () => {
    const { ctrl, changes } = makeController();
    const before = changes.length;
    ctrl.setError('err');
    expect(changes.length).toBeGreaterThan(before);
  });
});

// ---------------------------------------------------------------------------
// respondToApproval
// ---------------------------------------------------------------------------

describe('AgentRunnerController — respondToApproval', () => {
  it('does nothing when approvalResolve is null (no pending approval)', () => {
    const { ctrl } = makeController();
    expect(() => ctrl.respondToApproval('approve')).not.toThrow();
    expect(ctrl.pendingApproval).toBeNull();
  });

  it('sets workingState to thinking when decision is approve', () => {
    const { ctrl } = makeController();
    const resolveFn = mock((_d: string) => {});
    (ctrl as unknown as { approvalResolve: typeof resolveFn }).approvalResolve = resolveFn;
    (ctrl as unknown as { pendingApprovalValue: object }).pendingApprovalValue = {
      tool: 't',
      args: {},
    };
    ctrl.respondToApproval('approve');
    expect(ctrl.workingState.status).toBe('thinking');
    expect(ctrl.pendingApproval).toBeNull();
  });

  it('does NOT set workingState to thinking when decision is deny', () => {
    const { ctrl } = makeController();
    (ctrl as unknown as { workingStateValue: object }).workingStateValue = { status: 'idle' };
    const resolveFn = mock((_d: string) => {});
    (ctrl as unknown as { approvalResolve: typeof resolveFn }).approvalResolve = resolveFn;
    (ctrl as unknown as { pendingApprovalValue: object }).pendingApprovalValue = {
      tool: 't',
      args: {},
    };
    ctrl.respondToApproval('deny');
    expect(ctrl.workingState.status).toBe('idle');
  });

  it('calls approvalResolve with the decision', () => {
    const { ctrl } = makeController();
    const resolveFn = mock((_d: string) => {});
    (ctrl as unknown as { approvalResolve: typeof resolveFn }).approvalResolve = resolveFn;
    (ctrl as unknown as { pendingApprovalValue: object }).pendingApprovalValue = {
      tool: 't',
      args: {},
    };
    ctrl.respondToApproval('approve_session');
    expect(resolveFn).toHaveBeenCalledWith('approve_session');
  });
});

// ---------------------------------------------------------------------------
// cancelExecution
// ---------------------------------------------------------------------------

describe('AgentRunnerController — cancelExecution', () => {
  it('does not throw when no query is running', () => {
    const { ctrl } = makeController();
    expect(() => ctrl.cancelExecution()).not.toThrow();
  });

  it('sets workingState to idle after cancel', () => {
    const { ctrl } = makeController();
    (ctrl as unknown as { workingStateValue: object }).workingStateValue = { status: 'thinking' };
    ctrl.cancelExecution();
    expect(ctrl.workingState.status).toBe('idle');
  });

  it('emits onChange after cancel', () => {
    const { ctrl, changes } = makeController();
    const before = changes.length;
    ctrl.cancelExecution();
    expect(changes.length).toBeGreaterThan(before);
  });
});

// ---------------------------------------------------------------------------
// isProcessing getter
// ---------------------------------------------------------------------------

describe('AgentRunnerController — isProcessing', () => {
  it('returns false when history is empty', () => {
    const { ctrl } = makeController();
    expect(ctrl.isProcessing).toBe(false);
  });

  it('returns true when last item has status processing', () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    expect(ctrl.isProcessing).toBe(true);
  });

  it('returns false when last item has status complete', () => {
    const { ctrl } = makeController();
    (ctrl as unknown as { historyValue: HistoryItem[] }).historyValue = [
      { id: 'x', query: 'q', events: [], answer: 'a', status: 'complete', startTime: 1 },
    ];
    expect(ctrl.isProcessing).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleEvent — progress
// ---------------------------------------------------------------------------

describe('AgentRunnerController — handleEvent: progress', () => {
  it('updates iteration in thinking workingState', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    (ctrl as unknown as { workingStateValue: object }).workingStateValue = { status: 'thinking' };
    await fire(ctrl, { type: 'progress', iteration: 3, maxIterations: 10 });
    const ws = ctrl.workingState as { status: string; iteration: number; maxIterations: number };
    expect(ws.status).toBe('thinking');
    expect(ws.iteration).toBe(3);
    expect(ws.maxIterations).toBe(10);
  });

  it('updates iteration in tool workingState', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    (ctrl as unknown as { workingStateValue: object }).workingStateValue = {
      status: 'tool',
      toolName: 'some_tool',
    };
    await fire(ctrl, { type: 'progress', iteration: 2, maxIterations: 5 });
    const ws = ctrl.workingState as { status: string; iteration: number };
    expect(ws.status).toBe('tool');
    expect(ws.iteration).toBe(2);
  });

  it('transitions to thinking when not already thinking or tool', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    (ctrl as unknown as { workingStateValue: object }).workingStateValue = { status: 'idle' };
    await fire(ctrl, { type: 'progress', iteration: 1, maxIterations: 10 });
    const ws = ctrl.workingState as { status: string; iteration: number };
    expect(ws.status).toBe('thinking');
    expect(ws.iteration).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// handleEvent — thinking
// ---------------------------------------------------------------------------

describe('AgentRunnerController — handleEvent: thinking', () => {
  it('sets workingState to thinking and adds an event', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    (ctrl as unknown as { workingStateValue: object }).workingStateValue = {
      status: 'tool',
      iteration: 2,
      maxIterations: 5,
    };
    await fire(ctrl, { type: 'thinking', content: 'reasoning...' });
    expect(ctrl.workingState.status).toBe('thinking');
    const item = getHistory(ctrl)[0];
    const thinkingEvents = item.events.filter((e) => e.event.type === 'thinking');
    expect(thinkingEvents).toHaveLength(1);
    expect(thinkingEvents[0].completed).toBe(true);
  });

  it('preserves iteration and maxIterations from previous thinking state', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    (ctrl as unknown as { workingStateValue: object }).workingStateValue = {
      status: 'thinking',
      iteration: 4,
      maxIterations: 10,
    };
    await fire(ctrl, { type: 'thinking', content: 'still reasoning' });
    const ws = ctrl.workingState as { iteration: number; maxIterations: number };
    expect(ws.iteration).toBe(4);
    expect(ws.maxIterations).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// handleEvent — tool_progress
// ---------------------------------------------------------------------------

describe('AgentRunnerController — handleEvent: tool_progress', () => {
  it('adds progressMessage to the matching incomplete tool_start entry', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    await fire(ctrl, { type: 'tool_start', tool: 'web_search', args: {} } as ToolStartEvent);
    await fire(ctrl, { type: 'tool_progress', tool: 'web_search', message: 'fetching page 1' });
    const item = getHistory(ctrl)[0];
    const entry = item.events.find(
      (e) => e.event.type === 'tool_start' && (e.event as ToolStartEvent).tool === 'web_search',
    );
    expect(entry?.progressMessage).toBe('fetching page 1');
  });

  it('does not affect already-completed tool entries', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    await fire(ctrl, { type: 'tool_start', tool: 'web_search', args: {} } as ToolStartEvent);
    await fire(ctrl, {
      type: 'tool_end',
      tool: 'web_search',
      args: {},
      result: 'ok',
      duration: 100,
    });
    await fire(ctrl, { type: 'tool_progress', tool: 'web_search', message: 'too late' });
    const item = getHistory(ctrl)[0];
    const entry = item.events.find(
      (e) => e.event.type === 'tool_start' && (e.event as ToolStartEvent).tool === 'web_search',
    );
    expect(entry?.progressMessage).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handleEvent — tool_approval + tool_denied
// ---------------------------------------------------------------------------

describe('AgentRunnerController — handleEvent: tool_approval / tool_denied', () => {
  it('adds completed event for tool_approval', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    await fire(ctrl, { type: 'tool_approval', tool: 'edit_file', args: {} });
    const item = getHistory(ctrl)[0];
    const entry = item.events.find((e) => e.event.type === 'tool_approval');
    expect(entry).toBeDefined();
    expect(entry!.completed).toBe(true);
  });

  it('adds completed event for tool_denied', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    await fire(ctrl, { type: 'tool_denied', tool: 'edit_file', args: {} });
    const item = getHistory(ctrl)[0];
    const entry = item.events.find((e) => e.event.type === 'tool_denied');
    expect(entry).toBeDefined();
    expect(entry!.completed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleEvent — tool_limit + context_cleared
// ---------------------------------------------------------------------------

describe('AgentRunnerController — handleEvent: tool_limit / context_cleared', () => {
  it('adds completed event for tool_limit', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    await fire(ctrl, { type: 'tool_limit', limit: 10 });
    const item = getHistory(ctrl)[0];
    const entry = item.events.find((e) => e.event.type === 'tool_limit');
    expect(entry).toBeDefined();
    expect(entry!.completed).toBe(true);
  });

  it('adds completed event for context_cleared', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    await fire(ctrl, { type: 'context_cleared', keptItems: 3 });
    const item = getHistory(ctrl)[0];
    const entry = item.events.find((e) => e.event.type === 'context_cleared');
    expect(entry).toBeDefined();
    expect(entry!.completed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleEvent — answer_start + answer_chunk + done
// ---------------------------------------------------------------------------

describe('AgentRunnerController — handleEvent: answer_start / answer_chunk / done', () => {
  it('answer_start sets workingState to idle', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl);
    (ctrl as unknown as { workingStateValue: object }).workingStateValue = { status: 'thinking' };
    await fire(ctrl, { type: 'answer_start' });
    expect(ctrl.workingState.status).toBe('idle');
  });

  it('answer_chunk appends chunk to the last item answer', async () => {
    const { ctrl } = makeController();
    seedProcessingItem(ctrl, { answer: '' });
    await fire(ctrl, { type: 'answer_chunk', chunk: 'Hello' } as AnswerChunkEvent);
    await fire(ctrl, { type: 'answer_chunk', chunk: ' world' } as AnswerChunkEvent);
    const item = getHistory(ctrl)[0];
    expect(item.answer).toBe('Hello world');
  });

  it('done event marks item complete with final answer', async () => {
    const fakeChatHistory = makeFakeChatHistory();
    const { ctrl } = makeController(fakeChatHistory);
    seedProcessingItem(ctrl);
    const doneEv: DoneEvent = {
      type: 'done',
      answer: 'Final answer',
      totalTime: 1234,
      tokenUsage: { input: 100, output: 50 },
      tokensPerSecond: 42,
      toolCalls: [],
    };
    await fire(ctrl, doneEv);
    const item = getHistory(ctrl)[0];
    expect(item.status).toBe('complete');
    expect(item.answer).toBe('Final answer');
    expect(item.duration).toBe(1234);
    expect(ctrl.workingState.status).toBe('idle');
  });

  it('done event calls chatHistory.saveAnswer', async () => {
    const fakeChatHistory = makeFakeChatHistory();
    const { ctrl } = makeController(fakeChatHistory);
    seedProcessingItem(ctrl);
    await fire(ctrl, {
      type: 'done',
      answer: 'Stored answer',
      totalTime: 100,
      tokenUsage: { input: 10, output: 5 },
      tokensPerSecond: 20,
      toolCalls: [],
    } as DoneEvent);
    expect(fakeChatHistory.saveAnswer).toHaveBeenCalledWith('Stored answer');
  });

  it('done event with empty answer does not call saveAnswer', async () => {
    const fakeChatHistory = makeFakeChatHistory();
    const { ctrl } = makeController(fakeChatHistory);
    seedProcessingItem(ctrl);
    await fire(ctrl, {
      type: 'done',
      answer: '',
      totalTime: 100,
      tokenUsage: { input: 10, output: 5 },
      tokensPerSecond: 0,
      toolCalls: [],
    } as DoneEvent);
    expect(fakeChatHistory.saveAnswer).not.toHaveBeenCalled();
  });
});
