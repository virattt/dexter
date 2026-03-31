import { describe, expect, test } from 'bun:test';
import { applyComplianceGuardrails } from './guardrails.js';

describe('applyComplianceGuardrails', () => {
  test('blocks high-risk manipulation language', () => {
    const result = applyComplianceGuardrails({
      answer: 'This is risk-free and guaranteed returns if you pump this token.',
      query: 'what should i do',
      channel: 'cli',
    });
    expect(result.decision).toBe('blocked');
    expect(result.answer.toLowerCase()).toContain('cannot provide');
  });

  test('rewrites actionable advice and appends disclaimer', () => {
    const result = applyComplianceGuardrails({
      answer: 'You should buy now and go all-in on this stock.',
      query: 'should i buy',
      channel: 'whatsapp',
    });
    expect(result.decision).toBe('rewritten');
    expect(result.answer.toLowerCase()).toContain('not personalized financial advice');
    expect(result.answer.toLowerCase()).not.toContain('you should buy now');
  });

  test('flags factual claim without citation', () => {
    const result = applyComplianceGuardrails({
      answer: 'The company revenue grew 25% last year.',
      query: 'revenue growth',
      channel: 'cli',
    });
    expect(result.decision).toBe('rewritten');
    expect(result.answer).toContain('source verification');
  });

  test('allows neutral, cited research output', () => {
    const result = applyComplianceGuardrails({
      answer: 'Revenue trends are mixed across segments. Source: https://example.com/report',
      query: 'segment trends',
      channel: 'cli',
    });
    expect(result.decision).toBe('allowed');
  });
});
