import { afterEach, describe, expect, test } from 'bun:test';
import { getChatModel } from './llm.js';

describe('getChatModel', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  test('rejects placeholder API keys before creating an OpenAI client', () => {
    process.env.OPENAI_API_KEY = 'your-openai-api-key';

    expect(() => getChatModel('gpt-5.5')).toThrow(/OPENAI_API_KEY is not set/);
  });
});
