import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModelSelectionController } from './model-selection.js';
import { saveConfig } from '../utils/config.js';

const PROVIDER_API_KEY_ENV_VARS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'XAI_API_KEY',
  'MOONSHOT_API_KEY',
  'DEEPSEEK_API_KEY',
  'OPENROUTER_API_KEY',
];

describe('ModelSelectionController', () => {
  const originalCwd = process.cwd();
  let tempDir = '';
  let originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dexter-model-selection-'));
    process.chdir(tempDir);
    originalEnv = {};

    for (const key of PROVIDER_API_KEY_ENV_VARS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.chdir(originalCwd);

    for (const key of PROVIDER_API_KEY_ENV_VARS) {
      const original = originalEnv[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  test('uses the first configured provider when no model settings exist', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

    const controller = new ModelSelectionController(() => {});

    expect(controller.provider).toBe('anthropic');
    expect(controller.model).toBe('claude-sonnet-4-6');
  });

  test('ignores placeholder API keys when detecting the initial provider', () => {
    process.env.OPENAI_API_KEY = 'your-openai-api-key';
    process.env.GOOGLE_API_KEY = 'test-google-key';

    const controller = new ModelSelectionController(() => {});

    expect(controller.provider).toBe('google');
    expect(controller.model).toBe('gemini-3-flash-preview');
  });

  test('keeps saved settings ahead of environment auto-detection', () => {
    saveConfig({ provider: 'openai', modelId: 'gpt-5.5' });
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

    const controller = new ModelSelectionController(() => {});

    expect(controller.provider).toBe('openai');
    expect(controller.model).toBe('gpt-5.5');
  });
});
