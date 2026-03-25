import { describe, test, expect } from 'bun:test';
import { AIMessage } from '@langchain/core/messages';
import { extractTextContent, hasToolCalls, extractReasoningContent } from './ai-message.js';

// ===========================================================================
// extractReasoningContent (new)
// ===========================================================================

describe('extractReasoningContent', () => {
  test('returns reasoning_content string when present in additional_kwargs', () => {
    const msg = new AIMessage({
      content: 'The answer is 42.',
      additional_kwargs: { reasoning_content: 'Let me think step by step...' },
    });
    expect(extractReasoningContent(msg)).toBe('Let me think step by step...');
  });

  test('returns null when reasoning_content is absent', () => {
    const msg = new AIMessage({ content: 'Hello' });
    expect(extractReasoningContent(msg)).toBeNull();
  });

  test('returns null when reasoning_content is an empty string', () => {
    const msg = new AIMessage({
      content: 'Hello',
      additional_kwargs: { reasoning_content: '' },
    });
    expect(extractReasoningContent(msg)).toBeNull();
  });

  test('returns null when reasoning_content is only whitespace', () => {
    const msg = new AIMessage({
      content: 'Hello',
      additional_kwargs: { reasoning_content: '   \n  ' },
    });
    expect(extractReasoningContent(msg)).toBeNull();
  });

  test('returns null when reasoning_content is not a string', () => {
    const msg = new AIMessage({
      content: 'Hello',
      additional_kwargs: { reasoning_content: 42 as unknown as string },
    });
    expect(extractReasoningContent(msg)).toBeNull();
  });

  test('trims leading/trailing whitespace from reasoning content', () => {
    const msg = new AIMessage({
      content: 'Done',
      additional_kwargs: { reasoning_content: '  step 1\nstep 2  ' },
    });
    expect(extractReasoningContent(msg)).toBe('step 1\nstep 2');
  });
});

// ===========================================================================
// Existing helpers — regression guard
// ===========================================================================

describe('extractTextContent (regression)', () => {
  test('handles string content', () => {
    const msg = new AIMessage({ content: 'hello' });
    expect(extractTextContent(msg)).toBe('hello');
  });
});

describe('hasToolCalls (regression)', () => {
  test('returns false for message with no tool calls', () => {
    const msg = new AIMessage({ content: 'hi' });
    expect(hasToolCalls(msg)).toBe(false);
  });
});
