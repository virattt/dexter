import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { getOllamaModels } from './ollama.js';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  delete process.env.OLLAMA_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(response: unknown, ok = true) {
  globalThis.fetch = mock(async () => ({
    ok,
    json: async () => response,
  })) as unknown as typeof fetch;
}

describe('getOllamaModels', () => {
  test('returns model names from successful API response', async () => {
    mockFetch({
      models: [
        { name: 'llama3.2', modified_at: '2024-01-01', size: 1000 },
        { name: 'mistral:latest', modified_at: '2024-01-02', size: 2000 },
      ],
    });

    const models = await getOllamaModels();
    expect(models).toEqual(['llama3.2', 'mistral:latest']);
  });

  test('uses default base URL when OLLAMA_BASE_URL is not set', async () => {
    let capturedUrl = '';
    globalThis.fetch = mock(async (url: string) => {
      capturedUrl = url;
      return { ok: true, json: async () => ({ models: [] }) };
    }) as unknown as typeof fetch;

    await getOllamaModels();
    expect(capturedUrl).toBe('http://localhost:11434/api/tags');
  });

  test('uses OLLAMA_BASE_URL env var when set', async () => {
    process.env.OLLAMA_BASE_URL = 'http://custom:8888';
    let capturedUrl = '';
    globalThis.fetch = mock(async (url: string) => {
      capturedUrl = url;
      return { ok: true, json: async () => ({ models: [] }) };
    }) as unknown as typeof fetch;

    await getOllamaModels();
    expect(capturedUrl).toBe('http://custom:8888/api/tags');
    delete process.env.OLLAMA_BASE_URL;
  });

  test('returns empty array when response is not ok', async () => {
    mockFetch({}, false);
    const models = await getOllamaModels();
    expect(models).toEqual([]);
  });

  test('returns empty array when fetch throws (Ollama not running)', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    const models = await getOllamaModels();
    expect(models).toEqual([]);
  });

  test('returns empty array when models key is missing', async () => {
    mockFetch({});
    const models = await getOllamaModels();
    expect(models).toEqual([]);
  });

  test('filters out non-string model names', async () => {
    mockFetch({
      models: [
        { name: 'valid-model', modified_at: '2024-01-01', size: 1000 },
        { name: null, modified_at: '2024-01-02', size: 0 },
        { modified_at: '2024-01-03', size: 0 }, // no name field
      ],
    });

    const models = await getOllamaModels();
    expect(models).toEqual(['valid-model']);
  });

  test('returns empty array for empty models list', async () => {
    mockFetch({ models: [] });
    const models = await getOllamaModels();
    expect(models).toEqual([]);
  });
});
