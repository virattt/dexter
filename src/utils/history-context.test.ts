import { describe, test, expect } from 'bun:test';
import {
  HISTORY_CONTEXT_MARKER,
  CURRENT_MESSAGE_MARKER,
  DEFAULT_HISTORY_LIMIT,
  type HistoryEntry,
  buildHistoryContext,
} from './history-context.js';

describe('buildHistoryContext', () => {
  test('returns current message when there are no history entries', () => {
    const context = buildHistoryContext({
      entries: [],
      currentMessage: 'What is free cash flow?',
    });

    expect(context).toBe('What is free cash flow?');
  });

  test('formats history entries with role labels and markers', () => {
    const entries: HistoryEntry[] = [
      { role: 'user', content: 'Analyze AAPL earnings.' },
      { role: 'assistant', content: 'Sure, what horizon?' },
      { role: 'user', content: '5 years.' },
    ];

    const context = buildHistoryContext({
      entries,
      currentMessage: 'Also include NVDA and MSFT.',
    });

    expect(context).toContain(HISTORY_CONTEXT_MARKER);
    expect(context).toContain(CURRENT_MESSAGE_MARKER);
    expect(context).toContain('User: Analyze AAPL earnings.');
    expect(context).toContain('Assistant: Sure, what horizon?');
    expect(context).toContain('User: 5 years.');
    expect(context).toContain('Also include NVDA and MSFT.');
  });

  test('supports custom line breaks', () => {
    const entries: HistoryEntry[] = [{ role: 'user', content: 'Hello' }];
    const context = buildHistoryContext({
      entries,
      currentMessage: 'World',
      lineBreak: '\r\n',
    });

    expect(context.includes('\r\n')).toBe(true);
  });

  test('applies DEFAULT_HISTORY_LIMIT when historyLimit is omitted', () => {
    const entries: HistoryEntry[] = [];
    const total = DEFAULT_HISTORY_LIMIT + 5;

    for (let i = 0; i < total; i++) {
      entries.push({ role: 'user', content: `Msg-${String(i).padStart(2, '0')}` });
    }

    const context = buildHistoryContext({
      entries,
      currentMessage: 'Current message',
    });

    // Oldest messages beyond the default limit should not appear (zero-pad to avoid substring collisions)
    expect(context).not.toContain('Msg-00');
    expect(context).not.toContain('Msg-01');

    // Most recent messages should still be present
    expect(context).toContain(`Msg-${String(total - 1).padStart(2, '0')}`);
    expect(context).toContain(`Msg-${String(total - 2).padStart(2, '0')}`);
  });

  test('respects an explicit historyLimit override', () => {
    const entries: HistoryEntry[] = [];

    for (let i = 0; i < 6; i++) {
      entries.push({ role: 'user', content: `Turn ${i}` });
    }

    const context = buildHistoryContext({
      entries,
      currentMessage: 'Now',
      historyLimit: 2,
    });

    // Only the last two turns should be included
    expect(context).toContain('Turn 4');
    expect(context).toContain('Turn 5');
    expect(context).not.toContain('Turn 0');
    expect(context).not.toContain('Turn 1');
    expect(context).not.toContain('Turn 2');
    expect(context).not.toContain('Turn 3');
  });

  test('disables trimming when historyLimit is <= 0', () => {
    const entries: HistoryEntry[] = [];

    for (let i = 0; i < 5; i++) {
      entries.push({ role: 'user', content: `Msg ${i}` });
    }

    const context = buildHistoryContext({
      entries,
      currentMessage: 'Now',
      historyLimit: 0,
    });

    // All messages should appear when limit is non-positive
    for (let i = 0; i < 5; i++) {
      expect(context).toContain(`Msg ${i}`);
    }
  });
})

