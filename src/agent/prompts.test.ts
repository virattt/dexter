import { describe, test, expect } from 'bun:test';
import { buildSystemPrompt } from './prompts.js';

describe('System prompt — sequential_thinking enforcement', () => {
  test('contains mandatory sequential_thinking rule in Tool Usage Policy', () => {
    const prompt = buildSystemPrompt('gpt-5.4');
    expect(prompt).toContain('ALWAYS call sequential_thinking FIRST');
    expect(prompt).toContain('before calling ANY other tool');
  });

  test('sequential_thinking rule appears before other policy rules', () => {
    const prompt = buildSystemPrompt('gpt-5.4');
    const alwaysIdx = prompt.indexOf('ALWAYS call sequential_thinking FIRST');
    // "For stock and crypto prices" is a policy-only line (not in tool descriptions)
    const stockPolicyIdx = prompt.indexOf('For stock and crypto prices');
    expect(alwaysIdx).toBeGreaterThan(-1);
    expect(stockPolicyIdx).toBeGreaterThan(-1);
    expect(alwaysIdx).toBeLessThan(stockPolicyIdx);
  });

  test('sequential_thinking rule covers every query', () => {
    const prompt = buildSystemPrompt('gpt-5.4');
    expect(prompt).toContain('This applies to every query without exception');
  });
});
