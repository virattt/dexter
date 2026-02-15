import { describe, test, expect } from 'bun:test';
import { getApiKeyNameForProvider, getProviderDisplayName } from './env.js';

describe('provider api key mapping', () => {
  test('includes all cloud providers used by model selection', () => {
    const requiredCloudProviders = [
      'openai',
      'anthropic',
      'google',
      'xai',
      'moonshot',
      'deepseek',
      'openrouter',
    ] as const;

    for (const provider of requiredCloudProviders) {
      const envVar = getApiKeyNameForProvider(provider);
      if (!envVar) {
        throw new Error(`missing api key mapping for provider: ${provider}`);
      }
    }
  });

  test('xai provider maps to XAI_API_KEY', () => {
    expect(getProviderDisplayName('xai')).toBe('xAI');
    expect(getApiKeyNameForProvider('xai')).toBe('XAI_API_KEY');
  });
});
