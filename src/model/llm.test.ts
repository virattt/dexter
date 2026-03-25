import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock @langchain/ollama so we can inspect constructor args without Ollama running
// ---------------------------------------------------------------------------
const mockChatOllamaInstances: Array<{ model: string; think?: boolean }> = [];

mock.module('@langchain/ollama', () => ({
  ChatOllama: class MockChatOllama {
    constructor(args: { model: string; think?: boolean }) {
      mockChatOllamaInstances.push({ model: args.model, think: args.think });
    }
  },
  OllamaEmbeddings: class { constructor() {} },
}));

// Stub the other providers so getChatModel doesn't throw for missing API keys
mock.module('@langchain/openai', () => ({
  ChatOpenAI: class { constructor() {} },
  OpenAIEmbeddings: class { constructor() {} },
}));
mock.module('@langchain/anthropic', () => ({
  ChatAnthropic: class { constructor() {} },
}));
mock.module('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: class { constructor() {} },
  GoogleGenerativeAIEmbeddings: class { constructor() {} },
}));

const { isThinkingModel, getChatModel } = await import('./llm.js');

beforeEach(() => {
  mockChatOllamaInstances.length = 0;
});

// ===========================================================================
// isThinkingModel
// ===========================================================================

describe('isThinkingModel', () => {
  test('returns true for qwen3 models', () => {
    expect(isThinkingModel('qwen3:4b')).toBe(true);
    expect(isThinkingModel('qwen3:8b')).toBe(true);
    expect(isThinkingModel('qwen3:14b')).toBe(true);
    expect(isThinkingModel('qwen3:235b-a22b')).toBe(true);
  });

  test('returns true for ollama: prefixed qwen3 models', () => {
    expect(isThinkingModel('ollama:qwen3:4b')).toBe(true);
  });

  test('returns true for deepseek-r1 models', () => {
    expect(isThinkingModel('deepseek-r1:8b')).toBe(true);
    expect(isThinkingModel('deepseek-r1:32b')).toBe(true);
    expect(isThinkingModel('ollama:deepseek-r1:70b')).toBe(true);
  });

  test('returns true for qwq models', () => {
    expect(isThinkingModel('qwq:32b')).toBe(true);
    expect(isThinkingModel('ollama:qwq:32b')).toBe(true);
  });

  test('returns false for non-thinking Ollama models', () => {
    expect(isThinkingModel('llama3.1:8b')).toBe(false);
    expect(isThinkingModel('mistral:7b')).toBe(false);
    expect(isThinkingModel('phi4:14b')).toBe(false);
    expect(isThinkingModel('ollama:llama3.1:8b')).toBe(false);
  });

  test('returns false for non-Ollama model names', () => {
    expect(isThinkingModel('gpt-5.4')).toBe(false);
    expect(isThinkingModel('claude-sonnet-4-5')).toBe(false);
    expect(isThinkingModel('gemini-3')).toBe(false);
  });
});

// ===========================================================================
// getChatModel — think flag passed to ChatOllama
// ===========================================================================

describe('getChatModel — Ollama think flag', () => {
  test('passes think:true for qwen3 model', () => {
    getChatModel('ollama:qwen3:4b');
    expect(mockChatOllamaInstances[0]?.think).toBe(true);
  });

  test('passes think:true for deepseek-r1 model', () => {
    getChatModel('ollama:deepseek-r1:8b');
    expect(mockChatOllamaInstances[0]?.think).toBe(true);
  });

  test('does NOT pass think:true for llama3', () => {
    getChatModel('ollama:llama3.1:8b');
    expect(mockChatOllamaInstances[0]?.think).toBeUndefined();
  });

  test('strips ollama: prefix before passing model to ChatOllama', () => {
    getChatModel('ollama:qwen3:4b');
    expect(mockChatOllamaInstances[0]?.model).toBe('qwen3:4b');
  });
});
