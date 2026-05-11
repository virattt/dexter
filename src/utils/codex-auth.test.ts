import { describe, expect, test } from 'bun:test';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getPlatformOpenAiApiKey,
  resolveOpenAiAuth,
  CODEX_CHATGPT_OPENAI_BASE_URL,
} from './codex-auth.js';

describe('codex-auth', () => {
  test('JWT payload yields chatgpt_account_id for OAuth account resolution', () => {
    const payload = {
      'https://api.openai.com/auth': { chatgpt_account_id: 'workspace-abc' },
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const jwt = `x.${b64}.y`;

    const dir = join(tmpdir(), `dexter-codex-test-${Date.now()}`);
    mkdirSync(join(dir, '.codex'), { recursive: true });
    const authPath = join(dir, '.codex', 'auth.json');
    writeFileSync(
      authPath,
      JSON.stringify({
        tokens: {
          access_token: 'at-test',
          refresh_token: 'rt',
          id_token: jwt,
        },
      }),
      'utf-8',
    );

    const prev = process.env.CODEX_HOME;
    const prevOpenai = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.CODEX_HOME = join(dir, '.codex');

    try {
      const r = resolveOpenAiAuth();
      expect(r).toEqual({
        mode: 'codex_oauth',
        accessToken: 'at-test',
        accountId: 'workspace-abc',
      });
    } finally {
      if (prev === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prev;
      if (prevOpenai === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prevOpenai;
      try {
        unlinkSync(authPath);
      } catch {
        /* ignore */
      }
    }
  });

  test('platform key from env takes precedence over auth file', () => {
    const dir = join(tmpdir(), `dexter-codex-test2-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const authPath = join(dir, 'auth.json');
    writeFileSync(
      authPath,
      JSON.stringify({ OPENAI_API_KEY: 'from-file', tokens: { access_token: 'x', account_id: 'a' } }),
      'utf-8',
    );

    const prevHome = process.env.CODEX_HOME;
    const prevKey = process.env.OPENAI_API_KEY;
    process.env.CODEX_HOME = dir;
    process.env.OPENAI_API_KEY = 'from-env';

    try {
      expect(getPlatformOpenAiApiKey()).toBe('from-env');
      const r = resolveOpenAiAuth();
      expect(r).toEqual({ mode: 'platform', apiKey: 'from-env' });
    } finally {
      if (prevHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prevHome;
      if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prevKey;
      try {
        unlinkSync(authPath);
      } catch {
        /* ignore */
      }
    }
  });

  test('CODEX_CHATGPT_OPENAI_BASE_URL matches ChatGPT Codex backend path', () => {
    expect(CODEX_CHATGPT_OPENAI_BASE_URL).toBe('https://chatgpt.com/backend-api/codex');
  });
});
