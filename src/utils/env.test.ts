/**
 * Tests for src/utils/env.ts
 *
 * Uses a real temp directory + process.chdir to avoid mock.module('fs') which
 * leaks into other test files in Bun 1.3.x (native module mocks are not
 * fully isolated per test-file worker).
 */
import { describe, test, expect, mock, beforeEach, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Temp directory — all .env file reads/writes go here
// ─────────────────────────────────────────────────────────────────────────────
const originalCwd = process.cwd();
const tempDir = join(tmpdir(), `dexter-env-test-${Date.now()}`);
mkdirSync(tempDir, { recursive: true });
process.chdir(tempDir);

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock @/providers (project-internal alias — safe to mock per file)
// ─────────────────────────────────────────────────────────────────────────────
mock.module('@/providers', () => ({
  getProviderById: (id: string) => {
    const providers: Record<string, { apiKeyEnvVar?: string; displayName: string }> = {
      openai: { apiKeyEnvVar: 'OPENAI_API_KEY', displayName: 'OpenAI' },
      anthropic: { apiKeyEnvVar: 'ANTHROPIC_API_KEY', displayName: 'Anthropic' },
      google: { apiKeyEnvVar: 'GOOGLE_API_KEY', displayName: 'Google' },
      ollama: { displayName: 'Ollama' }, // no API key required
    };
    return providers[id] ?? undefined;
  },
}));

const {
  checkApiKeyExists,
  checkApiKeyExistsForProvider,
  saveApiKeyToEnv,
  getApiKeyNameForProvider,
  getProviderDisplayName,
} = await import('./env.js');

// Helper: write .env content in the temp dir
function writeEnvFile(content: string) {
  writeFileSync(join(tempDir, '.env'), content, 'utf-8');
}
function removeEnvFile() {
  try { rmSync(join(tempDir, '.env')); } catch { /* already absent */ }
}

beforeEach(() => {
  removeEnvFile();
  delete process.env.TEST_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

describe('getApiKeyNameForProvider', () => {
  test('returns apiKeyEnvVar for known provider', () => {
    expect(getApiKeyNameForProvider('openai')).toBe('OPENAI_API_KEY');
  });

  test('returns undefined for unknown provider', () => {
    expect(getApiKeyNameForProvider('nonexistent')).toBeUndefined();
  });

  test('returns undefined when provider has no apiKeyEnvVar (Ollama)', () => {
    expect(getApiKeyNameForProvider('ollama')).toBeUndefined();
  });
});

describe('getProviderDisplayName', () => {
  test('returns displayName for known provider', () => {
    expect(getProviderDisplayName('openai')).toBe('OpenAI');
  });

  test('returns providerId as fallback for unknown provider', () => {
    expect(getProviderDisplayName('mystery-provider')).toBe('mystery-provider');
  });
});

describe('checkApiKeyExists', () => {
  test('returns true when env var is set to valid value', () => {
    process.env.TEST_API_KEY = 'sk-valid-key';
    expect(checkApiKeyExists('TEST_API_KEY')).toBe(true);
  });

  test('returns false when env var is not set and no .env file', () => {
    // no .env file in tempDir (removed in beforeEach)
    expect(checkApiKeyExists('TEST_API_KEY')).toBe(false);
  });

  test('returns false when env var starts with "your-"', () => {
    process.env.TEST_API_KEY = 'your-key-here';
    expect(checkApiKeyExists('TEST_API_KEY')).toBe(false);
  });

  test('returns false when env var is empty string', () => {
    process.env.TEST_API_KEY = '';
    expect(checkApiKeyExists('TEST_API_KEY')).toBe(false);
  });

  test('returns true when key found in .env file with valid value', () => {
    delete process.env.TEST_API_KEY;
    writeEnvFile('OTHER_KEY=val\nTEST_API_KEY=sk-from-file\n');
    expect(checkApiKeyExists('TEST_API_KEY')).toBe(true);
  });

  test('returns false when key in .env starts with "your-"', () => {
    delete process.env.TEST_API_KEY;
    writeEnvFile('TEST_API_KEY=your-key-here\n');
    expect(checkApiKeyExists('TEST_API_KEY')).toBe(false);
  });

  test('ignores comment lines in .env file', () => {
    delete process.env.TEST_API_KEY;
    writeEnvFile('# TEST_API_KEY=sk-in-comment\nOTHER=val\n');
    expect(checkApiKeyExists('TEST_API_KEY')).toBe(false);
  });

  test('handles .env file with key=value containing equals sign', () => {
    delete process.env.TEST_API_KEY;
    writeEnvFile('TEST_API_KEY=key=with=equals\n');
    expect(checkApiKeyExists('TEST_API_KEY')).toBe(true);
  });
});

describe('checkApiKeyExistsForProvider', () => {
  test('returns true for provider with no apiKeyEnvVar (Ollama)', () => {
    expect(checkApiKeyExistsForProvider('ollama')).toBe(true);
  });

  test('returns false for provider when API key is not set', () => {
    delete process.env.OPENAI_API_KEY;
    expect(checkApiKeyExistsForProvider('openai')).toBe(false);
  });

  test('returns true for provider when API key env var is set', () => {
    process.env.OPENAI_API_KEY = 'sk-real-key';
    expect(checkApiKeyExistsForProvider('openai')).toBe(true);
  });

  test('returns true for unknown provider (no key name)', () => {
    expect(checkApiKeyExistsForProvider('unknown-provider')).toBe(true);
  });
});

describe('saveApiKeyToEnv', () => {
  function readWrittenEnv(): string {
    return readFileSync(join(tempDir, '.env'), 'utf-8');
  }

  test('creates new .env file when none exists', () => {
    const ok = saveApiKeyToEnv('OPENAI_API_KEY', 'sk-newkey');
    expect(ok).toBe(true);
    expect(existsSync(join(tempDir, '.env'))).toBe(true);
    expect(readWrittenEnv()).toContain('OPENAI_API_KEY=sk-newkey');
  });

  test('appends key when .env exists but key is absent', () => {
    writeEnvFile('OTHER_KEY=other-value\n');
    const ok = saveApiKeyToEnv('OPENAI_API_KEY', 'sk-added');
    expect(ok).toBe(true);
    const written = readWrittenEnv();
    expect(written).toContain('OPENAI_API_KEY=sk-added');
    expect(written).toContain('OTHER_KEY=other-value');
  });

  test('updates existing key in .env file', () => {
    writeEnvFile('OPENAI_API_KEY=sk-old\nOTHER=val\n');
    const ok = saveApiKeyToEnv('OPENAI_API_KEY', 'sk-updated');
    expect(ok).toBe(true);
    const written = readWrittenEnv();
    expect(written).toContain('OPENAI_API_KEY=sk-updated');
    expect(written).not.toContain('sk-old');
    expect(written).toContain('OTHER=val');
  });

  test('preserves comment lines in .env file', () => {
    writeEnvFile('# API Keys\nOPENAI_API_KEY=sk-old\n');
    saveApiKeyToEnv('OPENAI_API_KEY', 'sk-new');
    expect(readWrittenEnv()).toContain('# API Keys');
  });

  test('returns false when .env path is unwritable', () => {
    // Write a directory where .env would be written to force EISDIR error
    mkdirSync(join(tempDir, '.env'), { recursive: true });
    const ok = saveApiKeyToEnv('OPENAI_API_KEY', 'sk-new');
    expect(ok).toBe(false);
    rmSync(join(tempDir, '.env'), { recursive: true });
  });
});
