import { describe, expect, test } from 'bun:test';
import { getChatModel, getFastModel } from './llm.js';
import { getProviderById, resolveProvider } from '../providers.js';
import { getModelDisplayName } from '../utils/model.js';

const withKey = <T>(fn: () => T): T => {
  const previous = process.env.ORCAROUTER_API_KEY;
  process.env.ORCAROUTER_API_KEY = 'sk-orca-test-key';
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.ORCAROUTER_API_KEY;
    } else {
      process.env.ORCAROUTER_API_KEY = previous;
    }
  }
};

describe('OrcaRouter provider', () => {
  test('routes the orcarouter: prefix to its own registry entry', () => {
    const provider = resolveProvider('orcarouter:anthropic/claude-sonnet-5');

    expect(provider.id).toBe('orcarouter');
    expect(provider.displayName).toBe('OrcaRouter');
    expect(provider.apiKeyEnvVar).toBe('ORCAROUTER_API_KEY');
  });

  test('does not shadow the unprefixed OpenAI default', () => {
    expect(resolveProvider('gpt-5.6-sol').id).toBe('openai');
    expect(resolveProvider('openrouter:openai/gpt-4o').id).toBe('openrouter');
  });

  test('uses the OrcaRouter base URL and strips the prefix from the model id', () => {
    withKey(() => {
      const llm = getChatModel('orcarouter:openai/gpt-5.6-sol') as {
        model?: string;
        clientConfig?: { baseURL?: string };
      };

      expect(llm.model).toBe('openai/gpt-5.6-sol');
      expect(llm.clientConfig?.baseURL).toBe('https://api.orcarouter.ai/v1');
    });
  });

  test('fails with a clear message when the API key is missing', () => {
    const previous = process.env.ORCAROUTER_API_KEY;
    delete process.env.ORCAROUTER_API_KEY;
    try {
      expect(() => getChatModel('orcarouter:openai/gpt-5.6-sol')).toThrow(
        'ORCAROUTER_API_KEY'
      );
    } finally {
      if (previous !== undefined) process.env.ORCAROUTER_API_KEY = previous;
    }
  });

  test('exposes a fast model for lightweight tasks', () => {
    expect(getFastModel('orcarouter', 'orcarouter:openai/gpt-5.6-sol')).toBe(
      'orcarouter:openai/gpt-5.4-mini'
    );
  });

  test('strips the prefix when displaying a routed model id', () => {
    expect(getModelDisplayName('orcarouter:anthropic/claude-sonnet-5')).toBe(
      'anthropic/claude-sonnet-5'
    );
  });

  test('ships catalog hints for the free-form model prompt', () => {
    const provider = getProviderById('orcarouter');

    expect(provider?.modelCatalogUrl).toBe('www.orcarouter.ai');
    expect(provider?.modelExamples?.length).toBeGreaterThan(0);
  });
});
