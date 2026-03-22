import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  getAzureAdTokenProvider,
  getAzureOpenAIBaseUrl,
  normalizeAzureOpenAIBaseUrl,
  resolveAzureScope,
} from './azure-auth.js';

const originalAzureBaseUrl = process.env.AZURE_OPENAI_BASE_URL;
const originalOpenAiBaseUrl = process.env.OPENAI_BASE_URL;
const originalAzureScope = process.env.AZURE_OPENAI_SCOPE;

describe('azure auth helpers', () => {
  beforeEach(() => {
    delete process.env.AZURE_OPENAI_BASE_URL;
    delete process.env.OPENAI_BASE_URL;
  });

  afterEach(() => {
    if (typeof originalAzureBaseUrl === 'string') {
      process.env.AZURE_OPENAI_BASE_URL = originalAzureBaseUrl;
    } else {
      delete process.env.AZURE_OPENAI_BASE_URL;
    }

    if (typeof originalOpenAiBaseUrl === 'string') {
      process.env.OPENAI_BASE_URL = originalOpenAiBaseUrl;
    } else {
      delete process.env.OPENAI_BASE_URL;
    }

    if (typeof originalAzureScope === 'string') {
      process.env.AZURE_OPENAI_SCOPE = originalAzureScope;
    } else {
      delete process.env.AZURE_OPENAI_SCOPE;
    }
  });

  test('normalizeAzureOpenAIBaseUrl strips /responses and trailing slashes', () => {
    const normalized = normalizeAzureOpenAIBaseUrl(
      'https://example.services.ai.azure.com/api/projects/proj/openai/v1/responses/',
    );

    expect(normalized).toBe('https://example.services.ai.azure.com/api/projects/proj/openai/v1');
  });

  test('getAzureOpenAIBaseUrl prefers AZURE_OPENAI_BASE_URL over OPENAI_BASE_URL', () => {
    process.env.AZURE_OPENAI_BASE_URL = 'https://preferred.example.com/openai/v1/';
    process.env.OPENAI_BASE_URL = 'https://fallback.example.com/openai/v1/';

    expect(getAzureOpenAIBaseUrl()).toBe('https://preferred.example.com/openai/v1');
  });

  test('getAzureOpenAIBaseUrl falls back to OPENAI_BASE_URL', () => {
    process.env.OPENAI_BASE_URL = 'https://fallback.example.com/openai/v1/responses';

    expect(getAzureOpenAIBaseUrl()).toBe('https://fallback.example.com/openai/v1');
  });

  test('getAzureOpenAIBaseUrl throws when no base URL is configured', () => {
    expect(() => getAzureOpenAIBaseUrl()).toThrow(/AZURE_OPENAI_BASE_URL/);
  });

  test('resolveAzureScope selects Azure AI scope for Foundry project endpoints', () => {
    const scope = resolveAzureScope(
      'https://example.services.ai.azure.com/api/projects/my-project/openai/v1',
    );

    expect(scope).toBe('https://ai.azure.com/.default');
  });

  test('resolveAzureScope defaults to cognitive services scope for non-project endpoints', () => {
    const scope = resolveAzureScope('https://example.openai.azure.com/openai/v1');

    expect(scope).toBe('https://cognitiveservices.azure.com/.default');
  });

  test('resolveAzureScope honors AZURE_OPENAI_SCOPE override', () => {
    process.env.AZURE_OPENAI_SCOPE = 'https://custom.scope/.default';

    expect(resolveAzureScope('https://example.services.ai.azure.com/api/projects/x/openai/v1')).toBe(
      'https://custom.scope/.default',
    );
  });

  test('getAzureAdTokenProvider returns a stable cached provider function', () => {
    const tokenProviderA = getAzureAdTokenProvider();
    const tokenProviderB = getAzureAdTokenProvider();

    expect(tokenProviderA).toBe(tokenProviderB);
  });
});
