/**
 * E2E tests for the full session persistence flow.
 *
 * These tests exercise the complete lifecycle:
 *   createSession → autosave → loadSession → seedFromLlmMessages → getRecentTurns
 *
 * They verify:
 *   1. Context is correctly restored after session load
 *   2. Context window budget is respected (≤ DEFAULT_HISTORY_LIMIT turns injected)
 *   3. priorSummary is injected as a synthetic first turn when present
 *   4. AgentRunnerController.loadHistory() restores the display history
 *
 * No real LLM or PTY is required — all LLM calls are mocked.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { DEFAULT_HISTORY_LIMIT, FULL_ANSWER_TURNS } from '../utils/history-context.js';
import { SessionController } from '../controllers/session-controller.js';
import { AgentRunnerController } from '../controllers/agent-runner.js';
import type { HistoryItem } from '../types.js';

// ─── helpers ────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'dexter-e2e-session-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function makeItems(count: number): HistoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    query: `Question ${i} about stock analysis`,
    events: [],
    answer: `Answer ${i}: detailed financial analysis result`,
    status: 'complete' as const,
    startTime: Date.now() - (count - i) * 1000,
    duration: 1500,
  }));
}

function makeChatHistory(count: number): InMemoryChatHistory {
  const h = new InMemoryChatHistory();
  for (let i = 0; i < count; i++) {
    h.seedMessage({
      query: `Question ${i} about stock analysis`,
      answer: `Answer ${i}: detailed financial analysis result`,
      summary: `Summary ${i}: stock analysis summary`,
    });
  }
  return h;
}

// ─── Session creation + save + load flow ─────────────────────────────────────

describe('E2E: session create → save → load', () => {
  it('restores the full history after load', async () => {
    const ctrl = new SessionController(tmpDir);
    await ctrl.startSession('analyze Chevron company');

    const items = makeItems(3);
    const chatHistory = makeChatHistory(3);
    ctrl.autosave(items, chatHistory);
    await new Promise((r) => setTimeout(r, 400));

    const loaded = await ctrl.loadSession(ctrl.sessionId!);
    expect(loaded).not.toBeNull();
    expect(loaded!.history).toHaveLength(3);
    expect(loaded!.llmMessages).toHaveLength(3);
  });

  it('round-trips session name and metadata correctly', async () => {
    const ctrl = new SessionController(tmpDir);
    await ctrl.startSession('compare Tesla and BYD valuation');
    ctrl.autosave(makeItems(2), makeChatHistory(2));
    await new Promise((r) => setTimeout(r, 400));

    const sessions = await ctrl.listSessions();
    expect(sessions[0].name).toContain('compare Tesla');
    expect(sessions[0].queryCount).toBe(2);
  });
});

// ─── Context limit: seedFromLlmMessages respects DEFAULT_HISTORY_LIMIT ────────

describe('E2E: context window budget on session restore', () => {
  it('injects only the last DEFAULT_HISTORY_LIMIT turns into LLM context', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({
      query: `Q${i}`,
      answer: `A${i}`,
      summary: `S${i}`,
    }));

    const h = new InMemoryChatHistory();
    h.seedFromLlmMessages(msgs);

    // Only last DEFAULT_HISTORY_LIMIT messages should be in context
    expect(h.getMessages().length).toBeLessThanOrEqual(DEFAULT_HISTORY_LIMIT);
    const stored = h.getMessages();
    expect(stored[stored.length - 1].query).toBe(`Q19`);
    expect(stored[0].query).toBe(`Q${20 - DEFAULT_HISTORY_LIMIT}`);
  });

  it('getRecentTurns uses full answers for last FULL_ANSWER_TURNS, summaries for rest', () => {
    const limit = DEFAULT_HISTORY_LIMIT;
    const msgs = Array.from({ length: limit }, (_, i) => ({
      query: `Q${i}`,
      answer: `LongAnswer${i}`,
      summary: `Short${i}`,
    }));

    const h = new InMemoryChatHistory();
    h.seedFromLlmMessages(msgs);

    const turns = h.getRecentTurns();
    // Each message = 2 turns; assistant turns alternate between summary/full
    const assistantTurns = turns.filter((t) => t.role === 'assistant');
    const recentAssistant = assistantTurns.slice(-FULL_ANSWER_TURNS);
    const olderAssistant = assistantTurns.slice(0, -FULL_ANSWER_TURNS);

    // Recent turns use full answers
    for (const t of recentAssistant) {
      expect(t.content.startsWith('LongAnswer')).toBe(true);
    }
    // Older turns use summaries
    for (const t of olderAssistant) {
      expect(t.content.startsWith('Short')).toBe(true);
    }
  });

  it('estimated token overhead of restored context is manageable', () => {
    // Conservative estimate: full answers ~500 chars, summaries ~50 chars
    // TOKEN_BUDGET = 150_000; CONTEXT_THRESHOLD = 100_000
    const estimateTokens = (s: string) => Math.ceil(s.length / 3.5);

    const msgs = Array.from({ length: DEFAULT_HISTORY_LIMIT }, (_, i) => ({
      query: `Short question ${i}`,
      answer: 'A'.repeat(500),  // 500 char full answer
      summary: 'S'.repeat(50),   // 50 char summary
    }));

    const h = new InMemoryChatHistory();
    h.seedFromLlmMessages(msgs);

    const turns = h.getRecentTurns();
    const totalChars = turns.reduce((sum, t) => sum + t.content.length, 0);
    const estimatedTokens = estimateTokens(totalChars.toString()) + totalChars / 3.5;

    // Should be well under 10k tokens (far below CONTEXT_THRESHOLD of 100k)
    expect(estimatedTokens).toBeLessThan(10_000);
  });
});

// ─── priorSummary injected as synthetic turn ─────────────────────────────────

describe('E2E: priorSummary as synthetic context', () => {
  it('priorSummary becomes the first message in LLM context', () => {
    const summary = 'Earlier in this session: Chevron was analyzed and found undervalued at P/E 10.';
    const recent = [{ query: 'What is the current price?', answer: '$155', summary: 'Price is $155' }];

    const h = new InMemoryChatHistory();
    h.seedFromLlmMessages(recent, summary);

    const msgs = h.getMessages();
    expect(msgs[0].query).toBe('[Prior session context]');
    expect(msgs[0].answer).toBe(summary);
    expect(msgs[1].query).toBe('What is the current price?');
  });

  it('priorSummary appears in getRecentTurns output', () => {
    const summary = 'Prior session analyzed Tesla EV market share.';
    const h = new InMemoryChatHistory();
    h.seedFromLlmMessages(
      [{ query: 'Follow-up Q', answer: 'Follow-up A', summary: null }],
      summary,
    );

    const turns = h.getRecentTurns();
    const allContent = turns.map((t) => t.content).join(' ');
    expect(allContent).toContain(summary);
  });

  it('with 20 messages + priorSummary, total context stays within budget', () => {
    const estimateTokens = (text: string) => Math.ceil(text.length / 3.5);

    const msgs = Array.from({ length: 20 }, (_, i) => ({
      query: `Q${i}`,
      answer: 'A'.repeat(500),
      summary: 'S'.repeat(50),
    }));
    const priorSummary = 'P'.repeat(300);

    const h = new InMemoryChatHistory();
    h.seedFromLlmMessages(msgs, priorSummary);

    const turns = h.getRecentTurns();
    const totalTokens = turns.reduce((sum, t) => sum + estimateTokens(t.content), 0);

    // DEFAULT_HISTORY_LIMIT (10) + 1 synthetic = 11 messages max → 22 turns
    // Should be well under 10k tokens
    expect(totalTokens).toBeLessThan(10_000);
    expect(turns.some((t) => t.content.includes(priorSummary))).toBe(true);
  });
});

// ─── AgentRunnerController.loadHistory() ─────────────────────────────────────

describe('E2E: AgentRunnerController.loadHistory()', () => {
  it('replaces historyValue with loaded items', () => {
    const chatHistory = new InMemoryChatHistory();
    const config = { model: 'test-model', maxIterations: 1, tools: [] };
    const runner = new AgentRunnerController(config as any, chatHistory);

    const items = makeItems(3);
    runner.loadHistory(items);

    expect(runner.history).toHaveLength(3);
    expect(runner.history[0].query).toBe('Question 0 about stock analysis');
  });

  it('history is non-processing after load (no active query)', () => {
    const chatHistory = new InMemoryChatHistory();
    const config = { model: 'test-model', maxIterations: 1, tools: [] };
    const runner = new AgentRunnerController(config as any, chatHistory);

    runner.loadHistory(makeItems(2));
    expect(runner.isProcessing).toBe(false);
  });

  it('calls onChange when history is loaded', () => {
    let changed = false;
    const chatHistory = new InMemoryChatHistory();
    const config = { model: 'test-model', maxIterations: 1, tools: [] };
    const runner = new AgentRunnerController(config as any, chatHistory, () => { changed = true; });

    runner.loadHistory(makeItems(1));
    expect(changed).toBe(true);
  });
});

// ─── Full restore flow ────────────────────────────────────────────────────────

describe('E2E: full session restore flow', () => {
  it('restores display history + LLM context in one coordinated operation', async () => {
    // Step 1: Create and save a session
    const ctrl = new SessionController(tmpDir);
    await ctrl.startSession('analyze Chevron for Q1 2026');
    const items = makeItems(5);
    const savedChatHistory = makeChatHistory(5);
    ctrl.autosave(items, savedChatHistory);
    await new Promise((r) => setTimeout(r, 400));

    // Step 2: Simulate resuming — load session
    const loaded = await ctrl.loadSession(ctrl.sessionId!);
    expect(loaded).not.toBeNull();

    // Step 3: Restore LLM context
    const freshChatHistory = new InMemoryChatHistory();
    freshChatHistory.seedFromLlmMessages(loaded!.llmMessages, loaded!.priorSummary);

    // Step 4: Restore display history in agent runner
    const config = { model: 'test-model', maxIterations: 1, tools: [] };
    const runner = new AgentRunnerController(config as any, freshChatHistory);
    runner.loadHistory(loaded!.history);

    // Verify display history
    expect(runner.history).toHaveLength(5);

    // Verify LLM context has correct turns
    const turns = freshChatHistory.getRecentTurns();
    expect(turns.length).toBeGreaterThan(0);
    const userQueries = turns.filter((t) => t.role === 'user').map((t) => t.content);
    expect(userQueries.some((q) => q.includes('Question'))).toBe(true);
  });
});
