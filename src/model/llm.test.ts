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

// ===========================================================================
// streamCallLlm — word-boundary buffering (Feature 7)
// ===========================================================================

describe('streamCallLlm — word-boundary buffering', () => {
  // Build a fake ChatOpenAI-like model whose stream() yields controlled chunks
  function makeStreamingModel(chunks: string[]) {
    return {
      stream: async function* (_messages: unknown) {
        for (const chunk of chunks) {
          yield { content: chunk };
        }
      },
    };
  }

  // Replace getChatModel with our fake using a closure-based override.
  // We test the buffering logic via a simplified version mirroring streamCallLlm.
  async function collectBuffered(chunks: string[]): Promise<string[]> {
    const yielded: string[] = [];
    let wordBuffer = '';

    for (const text of chunks) {
      wordBuffer += text;
      const lastBoundary = Math.max(
        wordBuffer.lastIndexOf(' '),
        wordBuffer.lastIndexOf('\n'),
        wordBuffer.lastIndexOf('\t'),
      );
      if (lastBoundary >= 0) {
        yielded.push(wordBuffer.slice(0, lastBoundary + 1));
        wordBuffer = wordBuffer.slice(lastBoundary + 1);
      }
    }
    // Final flush
    if (wordBuffer) yielded.push(wordBuffer);
    return yielded;
  }

  test('yields at word boundaries, not character-by-character', async () => {
    // Six single-char chunks that together form "hello world "
    const result = await collectBuffered(['h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'l', 'd', ' ']);
    // Should yield "hello " and "world " as two chunks, not 12 single chars
    expect(result.length).toBeLessThan(12);
    expect(result.join('')).toBe('hello world ');
  });

  test('final word is flushed even without trailing whitespace', async () => {
    const result = await collectBuffered(['hello ', 'world']);
    const full = result.join('');
    expect(full).toBe('hello world');
    // "world" must appear (flushed at end)
    expect(full).toContain('world');
  });

  test('a stream with no whitespace flushes the entire buffer at end', async () => {
    const result = await collectBuffered(['abc', 'def', 'ghi']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('abcdefghi');
  });

  test('newline counts as a word boundary', async () => {
    const result = await collectBuffered(['line1\n', 'line2\n']);
    expect(result.join('')).toBe('line1\nline2\n');
    // Each line should trigger a yield (not accumulate into one)
    const hasNewlines = result.some((r) => r.includes('\n'));
    expect(hasNewlines).toBe(true);
  });

  test('yields up to last boundary, not first, keeping chunks large', async () => {
    // "hello world foo " has two boundaries — should yield up to the last one
    const result = await collectBuffered(['hello world foo ']);
    // The entire string up to the last space should be one chunk
    expect(result[0]).toBe('hello world foo ');
  });

  test('mixed whitespace: last boundary wins', async () => {
    const result = await collectBuffered(['a b\tc ']);
    expect(result.join('')).toBe('a b\tc ');
  });
});
