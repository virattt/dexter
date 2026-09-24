import { describe, expect, test } from 'bun:test';
import { getChatModel } from './llm.js';

describe('OpenAI API routing', () => {
  test('uses the Responses API for the GPT-6 and GPT-5.6 families', () => {
    const previousApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';

    try {
      for (const model of ['gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol']) {
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

describe('MiniMax API routing', () => {
  test('supports configured OpenAI-compatible and Anthropic-compatible endpoints', () => {
    const previousApiKey = process.env.MINIMAX_API_KEY;
    const previousApiFormat = process.env.MINIMAX_API_FORMAT;
    const previousBaseUrl = process.env.MINIMAX_BASE_URL;
    process.env.MINIMAX_API_KEY = 'test-key';
    delete process.env.MINIMAX_API_FORMAT;
    delete process.env.MINIMAX_BASE_URL;

    try {
      const globalOpenAiLlm = getChatModel('minimax:MiniMax-M3') as {
        clientConfig?: { baseURL?: string };
        model?: string;
        modelName?: string;
      };

      expect(globalOpenAiLlm.clientConfig?.baseURL).toBe('https://api.minimax.io/v1');
      expect(globalOpenAiLlm.model ?? globalOpenAiLlm.modelName).toBe('MiniMax-M3');

      process.env.MINIMAX_BASE_URL = 'https://api.minimaxi.com/v1';

      const cnOpenAiLlm = getChatModel('minimax:MiniMax-M2.7') as {
        clientConfig?: { baseURL?: string };
      };

      expect(cnOpenAiLlm.clientConfig?.baseURL).toBe('https://api.minimaxi.com/v1');

      process.env.MINIMAX_API_FORMAT = 'anthropic';
      delete process.env.MINIMAX_BASE_URL;

      const globalAnthropicLlm = getChatModel('minimax:MiniMax-M3') as {
        apiUrl?: string;
      };

      expect(globalAnthropicLlm.apiUrl).toBe('https://api.minimax.io/anthropic');

      process.env.MINIMAX_BASE_URL = 'https://api.minimaxi.com/anthropic';

      const cnAnthropicLlm = getChatModel('minimax:MiniMax-M2.7') as {
        apiUrl?: string;
        model?: string;
        modelName?: string;
      };

      expect(cnAnthropicLlm.apiUrl).toBe('https://api.minimaxi.com/anthropic');
      expect(cnAnthropicLlm.model ?? cnAnthropicLlm.modelName).toBe('MiniMax-M2.7');
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.MINIMAX_API_KEY;
      } else {
        process.env.MINIMAX_API_KEY = previousApiKey;
      }

      if (previousApiFormat === undefined) {
        delete process.env.MINIMAX_API_FORMAT;
      } else {
        process.env.MINIMAX_API_FORMAT = previousApiFormat;
      }

      if (previousBaseUrl === undefined) {
        delete process.env.MINIMAX_BASE_URL;
      } else {
        process.env.MINIMAX_BASE_URL = previousBaseUrl;
      }
    }
  });
});
