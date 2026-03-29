import { describe, expect, test } from 'vitest';
import { getDefaultModelForProvider, getModelDisplayName } from '@/utils/model';
import { resolveProvider } from '@/providers';

describe('codex provider wiring', () => {
  test('resolves codex-prefixed models to the codex provider', () => {
    expect(resolveProvider('codex:gpt-5.4').id).toBe('codex');
    expect(resolveProvider('codex:gpt-5.3-codex').displayName).toBe('Codex');
  });

  test('exposes codex as a selectable provider with a default model', () => {
    expect(getDefaultModelForProvider('codex')).toBe('codex:gpt-5.4');
  });

  test('formats codex model names for display', () => {
    expect(getModelDisplayName('codex:gpt-5.4')).toBe('GPT 5.4 via Codex');
  });
});
