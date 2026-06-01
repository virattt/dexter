import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEmbeddingClient } from './embeddings.js';

const API_KEY_ENV_VARS = [
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'OLLAMA_BASE_URL',
];

describe('createEmbeddingClient', () => {
  const originalCwd = process.cwd();
  let tempDir = '';
  let originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dexter-embeddings-'));
    process.chdir(tempDir);
    originalEnv = {};

    for (const key of API_KEY_ENV_VARS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.chdir(originalCwd);

    for (const key of API_KEY_ENV_VARS) {
      const original = originalEnv[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  test('does not create an OpenAI embedding client from a placeholder key', () => {
    process.env.OPENAI_API_KEY = 'your-openai-api-key';

    const client = createEmbeddingClient({ provider: 'openai' });

    expect(client).toBeNull();
  });

  test('auto provider ignores placeholder OpenAI key and uses Gemini when configured', () => {
    process.env.OPENAI_API_KEY = 'your-openai-api-key';
    process.env.GOOGLE_API_KEY = 'google-test-key';

    const client = createEmbeddingClient({ provider: 'auto' });

    expect(client?.provider).toBe('gemini');
  });
});
