import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getToolRegistry } from './registry.js';

const API_KEY_ENV_VARS = [
  'EXASEARCH_API_KEY',
  'PERPLEXITY_API_KEY',
  'TAVILY_API_KEY',
  'X_BEARER_TOKEN',
];

function registeredToolNames(): string[] {
  return getToolRegistry('gpt-5.5').map((tool) => tool.name);
}

describe('getToolRegistry', () => {
  const originalCwd = process.cwd();
  let tempDir = '';
  let originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dexter-tool-registry-'));
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

  test('does not register search tools for env.example placeholder keys', () => {
    process.env.EXASEARCH_API_KEY = 'your-exa-api-key';
    process.env.PERPLEXITY_API_KEY = 'your-perplexity-api-key';
    process.env.TAVILY_API_KEY = 'your-tavily-api-key';
    process.env.X_BEARER_TOKEN = 'your-X-bearer-token';

    const names = registeredToolNames();

    expect(names).not.toContain('web_search');
    expect(names).not.toContain('x_search');
  });

  test('registers search tools when usable keys are configured', () => {
    process.env.TAVILY_API_KEY = 'tvly-test-key';
    process.env.X_BEARER_TOKEN = 'x-test-token';

    const names = registeredToolNames();

    expect(names).toContain('web_search');
    expect(names).toContain('x_search');
  });
});
