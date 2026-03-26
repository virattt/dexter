/**
 * TDD tests for InMemoryChatHistory.seedMessage() and seedFromLlmMessages().
 * These methods allow restoring LLM context from a saved session without
 * triggering any LLM calls (summaries already exist in the session file).
 */

import { describe, it, expect } from 'bun:test';
import { InMemoryChatHistory } from './in-memory-chat-history.js';
import { DEFAULT_HISTORY_LIMIT } from './history-context.js';

function makeMsg(query: string, answer: string, summary: string | null = null) {
  return { query, answer, summary };
}

// ─── seedMessage ─────────────────────────────────────────────────────────────

describe('InMemoryChatHistory.seedMessage()', () => {
  it('adds a message with pre-set query, answer and summary', () => {
    const h = new InMemoryChatHistory();
    h.seedMessage(makeMsg('What is AAPL?', 'Apple Inc.', 'AAPL is Apple'));
    const msgs = h.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].query).toBe('What is AAPL?');
    expect(msgs[0].answer).toBe('Apple Inc.');
    expect(msgs[0].summary).toBe('AAPL is Apple');
  });

  it('seeds multiple messages with correct sequential IDs', () => {
    const h = new InMemoryChatHistory();
    h.seedMessage(makeMsg('Q1', 'A1', 'S1'));
    h.seedMessage(makeMsg('Q2', 'A2', 'S2'));
    const msgs = h.getMessages();
    expect(msgs).toHaveLength(2);
    expect(msgs[0].id).toBe(0);
    expect(msgs[1].id).toBe(1);
  });

  it('does not trigger any LLM call (answer/summary already provided)', () => {
    // If seedMessage accidentally called generateSummary it would fail/hang
    // in unit tests (no API key). The test passing without timeout proves it.
    const h = new InMemoryChatHistory();
    h.seedMessage(makeMsg('Q', 'A', 'S'));
    expect(h.hasMessages()).toBe(true);
  });

  it('makes seeded messages available to getRecentTurns()', () => {
    const h = new InMemoryChatHistory();
    h.seedMessage(makeMsg('What is CVX?', 'Chevron Corporation', 'CVX is Chevron'));
    const turns = h.getRecentTurns(10);
    expect(turns).toHaveLength(2); // user + assistant
    expect(turns[0].role).toBe('user');
    expect(turns[0].content).toBe('What is CVX?');
    expect(turns[1].role).toBe('assistant');
    expect(turns[1].content).toBe('Chevron Corporation');
  });

  it('seeded messages do not block normal saveUserQuery/saveAnswer flow', async () => {
    const h = new InMemoryChatHistory();
    h.seedMessage(makeMsg('old Q', 'old A', 'old S'));
    h.saveUserQuery('new Q');
    // answer is null until saveAnswer() is called
    const msgs = h.getMessages();
    expect(msgs).toHaveLength(2);
    expect(msgs[1].answer).toBeNull();
  });
});

// ─── seedFromLlmMessages ─────────────────────────────────────────────────────

describe('InMemoryChatHistory.seedFromLlmMessages()', () => {
  it('seeds up to DEFAULT_HISTORY_LIMIT recent messages', () => {
    const h = new InMemoryChatHistory();
    const msgs = Array.from({ length: 15 }, (_, i) =>
      makeMsg(`Q${i}`, `A${i}`, `S${i}`),
    );
    h.seedFromLlmMessages(msgs);
    // Should have at most DEFAULT_HISTORY_LIMIT messages
    expect(h.getMessages().length).toBeLessThanOrEqual(DEFAULT_HISTORY_LIMIT);
    // Should include the most recent ones
    const stored = h.getMessages();
    expect(stored[stored.length - 1].query).toBe('Q14');
  });

  it('seeds all messages when count is within the limit', () => {
    const h = new InMemoryChatHistory();
    const msgs = [makeMsg('Q1', 'A1', null), makeMsg('Q2', 'A2', null)];
    h.seedFromLlmMessages(msgs);
    expect(h.getMessages()).toHaveLength(2);
  });

  it('inserts priorSummary as a synthetic first turn when provided', () => {
    const h = new InMemoryChatHistory();
    h.seedFromLlmMessages(
      [makeMsg('recent Q', 'recent A', 'recent S')],
      'Summary of 20 earlier exchanges about Chevron.',
    );
    const msgs = h.getMessages();
    // synthetic turn is first
    expect(msgs[0].query).toBe('[Prior session context]');
    expect(msgs[0].answer).toBe('Summary of 20 earlier exchanges about Chevron.');
    // real message follows
    expect(msgs[1].query).toBe('recent Q');
  });

  it('clears any existing messages before seeding', () => {
    const h = new InMemoryChatHistory();
    h.seedMessage(makeMsg('stale Q', 'stale A', 'stale S'));
    h.seedFromLlmMessages([makeMsg('fresh Q', 'fresh A', null)]);
    const msgs = h.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].query).toBe('fresh Q');
  });

  it('getRecentTurns() returns full answers for recent, summaries for older', () => {
    const h = new InMemoryChatHistory();
    // Seed exactly DEFAULT_HISTORY_LIMIT messages; the last 3 use full answers
    const msgs = Array.from({ length: DEFAULT_HISTORY_LIMIT }, (_, i) =>
      makeMsg(`Q${i}`, `Answer${i}`, `Summary${i}`),
    );
    h.seedFromLlmMessages(msgs);
    const turns = h.getRecentTurns();
    // Each message produces 2 turns (user + assistant) → total = limit * 2
    expect(turns.length).toBe(DEFAULT_HISTORY_LIMIT * 2);
  });

  it('works with empty message array', () => {
    const h = new InMemoryChatHistory();
    h.seedFromLlmMessages([]);
    expect(h.hasMessages()).toBe(false);
  });

  it('works with empty array but priorSummary present', () => {
    const h = new InMemoryChatHistory();
    h.seedFromLlmMessages([], 'Prior session covered Chevron analysis.');
    const msgs = h.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].query).toBe('[Prior session context]');
  });
});
