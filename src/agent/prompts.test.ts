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

describe('System prompt — financial data fallback policy', () => {
  test('includes Financial Data Fallback Policy section', () => {
    const prompt = buildSystemPrompt('gpt-5.4');
    expect(prompt).toContain('Financial Data Fallback Policy');
  });

  test('instructs agent to try web_search when financial tools fail', () => {
    const prompt = buildSystemPrompt('gpt-5.4');
    expect(prompt).toContain('ALWAYS try web_search next');
    expect(prompt).toContain('do NOT give up');
  });

  test('mentions international/European tickers as a known failure case', () => {
    const prompt = buildSystemPrompt('gpt-5.4');
    expect(prompt).toContain('European');
    expect(prompt).toContain('international');
  });

  test('instructs web_fetch as second step after web_search', () => {
    const prompt = buildSystemPrompt('gpt-5.4');
    expect(prompt).toContain('web_fetch');
  });

  test('fallback policy appears after Tool Usage Policy', () => {
    const prompt = buildSystemPrompt('gpt-5.4');
    const toolPolicyIdx = prompt.indexOf('## Tool Usage Policy');
    const fallbackIdx = prompt.indexOf('## Financial Data Fallback Policy');
    expect(toolPolicyIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeGreaterThan(toolPolicyIdx);
  });
});
