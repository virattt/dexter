import { describe, test, expect } from 'bun:test';
import { buildSystemPrompt, buildIterationPrompt } from './prompts.js';

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
    expect(prompt).toContain('initial planning only');
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

describe('buildIterationPrompt — error fallback nudge', () => {
  test('injects IMPORTANT nudge when structured JSON error field is present', () => {
    const result = buildIterationPrompt('analyse AAPL', '{"error": "premium-only access required"}');
    expect(result).toContain('IMPORTANT');
    expect(result).toContain('web_search');
  });

  test('injects IMPORTANT nudge on HTTP 4xx status in tool result', () => {
    const result = buildIterationPrompt('get price', '{"status": 403, "message": "Forbidden"}');
    expect(result).toContain('IMPORTANT');
  });

  test('injects IMPORTANT nudge on fmp-premium marker in tool result', () => {
    const result = buildIterationPrompt('get revenue', '{"routing": "fmp-premium", "data": null}');
    expect(result).toContain('IMPORTANT');
  });

  test('does NOT inject nudge when web_search result contains "not found on exchange" in title', () => {
    const legitimateResult = JSON.stringify({
      results: [{ title: 'Vestas Wind not found on NYSE, listed on Nasdaq Copenhagen', url: 'bloomberg.com' }],
    });
    const result = buildIterationPrompt('analyse VWS.CO', legitimateResult);
    expect(result).not.toContain('IMPORTANT');
  });

  test('does NOT inject nudge when tool results are clean', () => {
    const cleanResult = '{"data": {"revenue": "17.3B EUR", "margin": "4.3%"}}';
    const result = buildIterationPrompt('analyse Vestas', cleanResult);
    expect(result).not.toContain('IMPORTANT');
  });

  test('does NOT inject nudge when tool results are empty string', () => {
    const result = buildIterationPrompt('simple query', '');
    expect(result).not.toContain('IMPORTANT');
  });

  test('always includes continuation instruction', () => {
    const result = buildIterationPrompt('query', '');
    expect(result).toContain('Continue working toward answering the query');
  });
});

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
    expect(prompt).toContain('initial planning only');
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
