/**
 * TDD tests for SessionController — session lifecycle management.
 * Uses an isolated tmp directory and a mock summarizer (no real LLM).
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { DEFAULT_HISTORY_LIMIT } from '../utils/history-context.js';
import { loadSession } from '../utils/session-store.js';
import { SessionController } from './session-controller.js';
import type { HistoryItem } from '../types.js';

// ─── helpers ────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'dexter-session-ctrl-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function makeHistory(count: number): HistoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    query: `Q${i}`,
    events: [],
    answer: `A${i}`,
    status: 'complete' as const,
  }));
}

function makeChatHistory(count: number): InMemoryChatHistory {
  const h = new InMemoryChatHistory();
  for (let i = 0; i < count; i++) {
    h.seedMessage({ query: `Q${i}`, answer: `A${i}`, summary: `S${i}` });
  }
  return h;
}

// ─── startSession ────────────────────────────────────────────────────────────

describe('SessionController.startSession()', () => {
  it('creates a session and exposes its ID', async () => {
    const ctrl = new SessionController(tmpDir);
    await ctrl.startSession('analyze Chevron company');
    expect(ctrl.sessionId).not.toBeNull();
    expect(typeof ctrl.sessionId).toBe('string');
  });

  it('session name contains first words of the query', async () => {
    const ctrl = new SessionController(tmpDir);
    await ctrl.startSession('analyze Tesla valuation');
    const sessions = await ctrl.listSessions();
    expect(sessions[0].name).toContain('analyze Tesla');
  });

  it('multiple starts create independent sessions', async () => {
    const ctrl = new SessionController(tmpDir);
    await ctrl.startSession('first session');
    const id1 = ctrl.sessionId;
    await ctrl.startSession('second session');
    const id2 = ctrl.sessionId;
    expect(id1).not.toBe(id2);
  });
});

// ─── autosave ────────────────────────────────────────────────────────────────

describe('SessionController.autosave()', () => {
  it('persists history after debounce delay', async () => {
    const ctrl = new SessionController(tmpDir);
    await ctrl.startSession('test session');
    const history = makeHistory(2);
    const chatHistory = makeChatHistory(2);

    ctrl.autosave(history, chatHistory);
    // Wait longer than the 250ms debounce
    await new Promise((r) => setTimeout(r, 400));

    const loaded = await loadSession(ctrl.sessionId!, tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.history).toHaveLength(2);
    expect(loaded!.llmMessages).toHaveLength(2);
    expect(loaded!.queryCount).toBe(2);
  });

  it('debounces — only the last call within 250ms fires', async () => {
    const ctrl = new SessionController(tmpDir);
    await ctrl.startSession('debounce test');
    const chatHistory = makeChatHistory(1);

    // Fire 3 saves rapidly
    ctrl.autosave(makeHistory(1), chatHistory);
    ctrl.autosave(makeHistory(2), chatHistory);
    ctrl.autosave(makeHistory(3), chatHistory);
    await new Promise((r) => setTimeout(r, 400));

    const loaded = await loadSession(ctrl.sessionId!, tmpDir);
    // Only the final save (3 items) should have landed
    expect(loaded!.history).toHaveLength(3);
  });

  it('triggers priorSummary generation when crossing DEFAULT_HISTORY_LIMIT boundary', async () => {
    const mockSummarizer = mock(async (_msgs: any[]) => 'Compact prior summary');
    const ctrl = new SessionController(tmpDir, mockSummarizer);
    await ctrl.startSession('long session');

    // Cross the boundary: go from 10 to 11 messages
    const belowLimit = makeHistory(DEFAULT_HISTORY_LIMIT);
    const aboveLimit = makeHistory(DEFAULT_HISTORY_LIMIT + 1);
    const chatHistory = makeChatHistory(DEFAULT_HISTORY_LIMIT + 1);

    ctrl.autosave(belowLimit, makeChatHistory(DEFAULT_HISTORY_LIMIT));
    await new Promise((r) => setTimeout(r, 400));

    ctrl.autosave(aboveLimit, chatHistory);
    // Wait for debounce + async summarizer
    await new Promise((r) => setTimeout(r, 600));

    expect(mockSummarizer).toHaveBeenCalledTimes(1);
  });

  it('stores priorSummary in the saved file once generated', async () => {
    const mockSummarizer = mock(async () => 'Generated session summary');
    const ctrl = new SessionController(tmpDir, mockSummarizer);
    await ctrl.startSession('summary test');

    const count = DEFAULT_HISTORY_LIMIT + 2;
    ctrl.autosave(makeHistory(count), makeChatHistory(count));
    await new Promise((r) => setTimeout(r, 600));

    // Trigger another save so the (now-ready) priorSummary is written
    ctrl.autosave(makeHistory(count), makeChatHistory(count));
    await new Promise((r) => setTimeout(r, 400));

    const loaded = await loadSession(ctrl.sessionId!, tmpDir);
    expect(loaded!.priorSummary).toBe('Generated session summary');
  });
});

// ─── loadSession ─────────────────────────────────────────────────────────────

describe('SessionController.loadSession()', () => {
  it('returns null for unknown ID', async () => {
    const ctrl = new SessionController(tmpDir);
    expect(await ctrl.loadSession('nonexistent')).toBeNull();
  });

  it('returns the full session file for a valid ID', async () => {
    const ctrl = new SessionController(tmpDir);
    await ctrl.startSession('load me');
    ctrl.autosave(makeHistory(1), makeChatHistory(1));
    await new Promise((r) => setTimeout(r, 400));

    const loaded = await ctrl.loadSession(ctrl.sessionId!);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toContain('load me');
  });
});

// ─── listSessions ────────────────────────────────────────────────────────────

describe('SessionController.listSessions()', () => {
  it('returns empty array when no sessions exist', async () => {
    const ctrl = new SessionController(tmpDir);
    expect(await ctrl.listSessions()).toEqual([]);
  });

  it('lists created sessions newest-first', async () => {
    const ctrl = new SessionController(tmpDir);
    await ctrl.startSession('first');
    await new Promise((r) => setTimeout(r, 5));
    await ctrl.startSession('second');
    const sessions = await ctrl.listSessions();
    expect(sessions[0].name).toContain('second');
    expect(sessions[1].name).toContain('first');
  });
});
