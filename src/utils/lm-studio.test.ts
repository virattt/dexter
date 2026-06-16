import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { resolveProvider } from '../providers.js';
import { getDefaultModelForProvider, getModelDisplayName, getModelsForProvider } from './model.js';
import { getLmStudioModels } from './lm-studio.js';

const originalFetch = globalThis.fetch;
const originalBaseUrl = process.env.LM_STUDIO_BASE_URL;
const originalModel = process.env.LM_STUDIO_MODEL;

/**
 * 统一恢复 LM Studio 相关环境变量，避免测试之间相互污染。
 */
function restoreLmStudioEnv() {
  if (originalBaseUrl === undefined) {
    delete process.env.LM_STUDIO_BASE_URL;
  } else {
    process.env.LM_STUDIO_BASE_URL = originalBaseUrl;
  }

  if (originalModel === undefined) {
    delete process.env.LM_STUDIO_MODEL;
  } else {
    process.env.LM_STUDIO_MODEL = originalModel;
  }
}

describe('LM Studio utilities', () => {
  beforeEach(() => {
    process.env.LM_STUDIO_BASE_URL = 'http://127.0.0.1:1234/v1';
    delete process.env.LM_STUDIO_MODEL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreLmStudioEnv();
    mock.restore();
  });

  test('resolves the lmstudio provider from its model prefix', () => {
    expect(resolveProvider('lmstudio:qwen/qwen3-8b').id).toBe('lmstudio');
    expect(getModelDisplayName('lmstudio:qwen/qwen3-8b')).toBe('qwen/qwen3-8b');
  });

  test('exposes the configured LM Studio model in provider model lists', () => {
    process.env.LM_STUDIO_MODEL = 'qwen/qwen3-8b';

    expect(getModelsForProvider('lmstudio')).toEqual([
      { id: 'qwen/qwen3-8b', displayName: 'qwen/qwen3-8b' },
    ]);
  });

  test('qualifies the default LM Studio model with its provider prefix', () => {
    process.env.LM_STUDIO_MODEL = 'qwen/qwen3-8b';

    expect(getDefaultModelForProvider('lmstudio')).toBe('lmstudio:qwen/qwen3-8b');
  });

  test('returns models from the LM Studio API when available', async () => {
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({
          data: [{ id: 'qwen/qwen3-8b' }, { id: 'deepseek/deepseek-r1-0528-qwen3-8b' }],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    await expect(getLmStudioModels()).resolves.toEqual([
      'qwen/qwen3-8b',
      'deepseek/deepseek-r1-0528-qwen3-8b',
    ]);
  });

  test('falls back to LM_STUDIO_MODEL when the API is unreachable', async () => {
    process.env.LM_STUDIO_MODEL = 'qwen/qwen3-8b';
    globalThis.fetch = mock(async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;

    await expect(getLmStudioModels()).resolves.toEqual(['qwen/qwen3-8b']);
  });
});
