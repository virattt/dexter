import { describe, expect, test } from 'bun:test';
import { getChatModel } from './llm.js';

describe('OpenAI API routing', () => {
  test('uses the Responses API for the GPT-5.6 family', () => {
    const previousApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';

    try {
      for (const model of ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']) {
        const llm = getChatModel(model) as { useResponsesApi?: boolean };
        expect(llm.useResponsesApi).toBe(true);
      }
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousApiKey;
      }
    }
  });
});

describe('Atlas Cloud API routing', () => {
  test('uses the OpenAI-compatible endpoint without the provider prefix', () => {
    const previousApiKey = process.env.ATLASCLOUD_API_KEY;
    process.env.ATLASCLOUD_API_KEY = 'test-key';

    try {
      const llm = getChatModel('atlascloud:deepseek-ai/deepseek-v4-pro') as {
        model?: string;
        clientConfig?: { baseURL?: string };
      };
      expect(llm.model).toBe('deepseek-ai/deepseek-v4-pro');
      expect(llm.clientConfig?.baseURL).toBe('https://api.atlascloud.ai/v1');
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.ATLASCLOUD_API_KEY;
      } else {
        process.env.ATLASCLOUD_API_KEY = previousApiKey;
      }
    }
  });
});
