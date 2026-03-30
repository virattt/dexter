import { describe, test, expect } from 'bun:test';
import {
  buildHistoryContext,
  HISTORY_CONTEXT_MARKER,
  CURRENT_MESSAGE_MARKER,
  DEFAULT_HISTORY_LIMIT,
  FULL_ANSWER_TURNS,
} from './history-context.js';

describe('constants', () => {
  test('HISTORY_CONTEXT_MARKER is a non-empty string', () => {
    expect(typeof HISTORY_CONTEXT_MARKER).toBe('string');
    expect(HISTORY_CONTEXT_MARKER.length).toBeGreaterThan(0);
  });

  test('CURRENT_MESSAGE_MARKER is a non-empty string', () => {
    expect(typeof CURRENT_MESSAGE_MARKER).toBe('string');
    expect(CURRENT_MESSAGE_MARKER.length).toBeGreaterThan(0);
  });

  test('DEFAULT_HISTORY_LIMIT is a positive number', () => {
    expect(DEFAULT_HISTORY_LIMIT).toBeGreaterThan(0);
  });

  test('FULL_ANSWER_TURNS is a positive number', () => {
    expect(FULL_ANSWER_TURNS).toBeGreaterThan(0);
  });
});

describe('buildHistoryContext', () => {
  test('returns currentMessage directly when entries is empty', () => {
    const result = buildHistoryContext({ entries: [], currentMessage: 'hello' });
    expect(result).toBe('hello');
  });

  test('wraps history + current message when entries present', () => {
    const result = buildHistoryContext({
      entries: [{ role: 'user', content: 'previous question' }],
      currentMessage: 'new question',
    });
    expect(result).toContain(HISTORY_CONTEXT_MARKER);
    expect(result).toContain(CURRENT_MESSAGE_MARKER);
    expect(result).toContain('new question');
    expect(result).toContain('previous question');
  });

  test('formats user entries with "User:" prefix', () => {
    const result = buildHistoryContext({
      entries: [{ role: 'user', content: 'my question' }],
      currentMessage: 'follow up',
    });
    expect(result).toContain('User: my question');
  });

  test('formats assistant entries with "Assistant:" prefix', () => {
    const result = buildHistoryContext({
      entries: [{ role: 'assistant', content: 'my answer' }],
      currentMessage: 'thanks',
    });
    expect(result).toContain('Assistant: my answer');
  });

  test('separates multiple entries with double line breaks', () => {
    const result = buildHistoryContext({
      entries: [
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1' },
      ],
      currentMessage: 'q2',
    });
    expect(result).toContain('User: q1\n\nAssistant: a1');
  });

  test('uses custom lineBreak when provided', () => {
    const result = buildHistoryContext({
      entries: [{ role: 'user', content: 'q' }],
      currentMessage: 'current',
      lineBreak: '<br>',
    });
    expect(result).toContain('<br>');
    expect(result).not.toContain('\n');
  });

  test('puts HISTORY_CONTEXT_MARKER before history and CURRENT_MESSAGE_MARKER before current', () => {
    const result = buildHistoryContext({
      entries: [{ role: 'user', content: 'q' }],
      currentMessage: 'current',
    });
    const historyPos = result.indexOf(HISTORY_CONTEXT_MARKER);
    const currentPos = result.indexOf(CURRENT_MESSAGE_MARKER);
    const currentMsgPos = result.lastIndexOf('current');
    expect(historyPos).toBeLessThan(currentPos);
    expect(currentPos).toBeLessThan(currentMsgPos);
  });
});
