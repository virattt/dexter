import { describe, it, expect } from 'bun:test';
import { THINKING_VERBS, getRandomThinkingVerb } from './thinking-verbs.js';

describe('THINKING_VERBS', () => {
  it('is a non-empty array', () => {
    expect(THINKING_VERBS.length).toBeGreaterThan(0);
  });

  it('contains only non-empty strings', () => {
    for (const v of THINKING_VERBS) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it('all verbs start with a capital letter', () => {
    for (const v of THINKING_VERBS) {
      expect(v[0]).toBe(v[0].toUpperCase());
    }
  });
});

describe('getRandomThinkingVerb', () => {
  it('returns a string', () => {
    expect(typeof getRandomThinkingVerb()).toBe('string');
  });

  it('returns a value from THINKING_VERBS', () => {
    const verb = getRandomThinkingVerb();
    expect(THINKING_VERBS).toContain(verb as typeof THINKING_VERBS[number]);
  });

  it('returns different values across multiple calls (with high probability)', () => {
    const results = new Set(Array.from({ length: 20 }, () => getRandomThinkingVerb()));
    expect(results.size).toBeGreaterThan(1);
  });
});
