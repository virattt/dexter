import { describe, expect, test } from 'bun:test';
import { resolveProvider } from './providers.js';

describe('resolveProvider', () => {
  test('uses explicit provider before model prefix routing', () => {
    const provider = resolveProvider('deepseek-v4-flash', 'openai');

    expect(provider.id).toBe('openai');
  });

  test('falls back to model prefix routing without override', () => {
    const provider = resolveProvider('deepseek-v4-flash');

    expect(provider.id).toBe('deepseek');
  });

  test('ignores unknown provider override', () => {
    const provider = resolveProvider('claude-sonnet-4-5', 'unknown-provider');

    expect(provider.id).toBe('anthropic');
  });
});
