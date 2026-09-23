import { describe, expect, test } from 'bun:test';
import { buildContextWindowBlock, buildReminder, CONTEXT_WINDOW_GUIDANCE, FALLBACK_PROMPT } from './prompts.js';

describe('context window prompts', () => {
  test('block includes window ids, budget, and hint', () => {
    const block = buildContextWindowBlock({
      windowNumber: 2,
      currentWindowId: 'cur',
      previousWindowId: 'prev',
      tokensLeft: 1234,
      hint: '## a.md\nAAPL rev $416B',
    });
    expect(block).toBe(
      '<context_window>\n' +
      'Window number: 2\n' +
      'Current context window id: cur\n' +
      'Previous context window id: prev\n' +
      'You have 1234 tokens left in this context window.\n' +
      '\n' +
      'Notes from previous windows:\n' +
      '## a.md\nAAPL rev $416B\n' +
      '</context_window>',
    );
  });

  test('block omits previous id and hint on the first window', () => {
    const block = buildContextWindowBlock({
      windowNumber: 1,
      currentWindowId: 'cur',
      previousWindowId: null,
      tokensLeft: null,
      hint: null,
    });
    expect(block).not.toContain('Previous context window id');
    expect(block).not.toContain('Notes from previous windows');
    expect(block).toContain('You have unknown tokens left');
  });

  test('reminder fills in the remaining token count', () => {
    expect(buildReminder(6000)).toContain('only 6000 tokens remaining');
    expect(buildReminder(6000)).toContain('notes and history items will be persistent');
  });

  test('guidance and fallback name the tools the model must use', () => {
    expect(CONTEXT_WINDOW_GUIDANCE).toContain('`notes`');
    expect(CONTEXT_WINDOW_GUIDANCE).toContain('`history`');
    expect(CONTEXT_WINDOW_GUIDANCE).toContain('`get_context_remaining`');
    expect(CONTEXT_WINDOW_GUIDANCE).toContain('`new_context_window`');
    expect(FALLBACK_PROMPT).toContain('notes');
  });
});
