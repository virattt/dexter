import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { ClientOptions } from 'openai';

/**
 * OpenAI Chat / Responses traffic for ChatGPT (Codex CLI) OAuth uses this host, not api.openai.com.
 * @see https://developers.openai.com/codex/auth/
 */
export const CODEX_CHATGPT_OPENAI_BASE_URL = 'https://chatgpt.com/backend-api/codex';

interface CodexAuthDotJson {
  OPENAI_API_KEY?: string | null;
  tokens?: CodexTokenData | null;
}

interface CodexTokenData {
  access_token: string;
  refresh_token?: string;
  account_id?: string | null;
  /** Serialized JWT string (Codex auth.json format). */
  id_token?: string | { raw_jwt?: string };
}

function codexHomeDir(): string {
  return process.env.CODEX_HOME ?? join(homedir(), '.codex');
}

export function getCodexAuthJsonPath(): string {
  return join(codexHomeDir(), 'auth.json');
}

export function readCodexAuthDotJson(): CodexAuthDotJson | null {
  const p = getCodexAuthJsonPath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as CodexAuthDotJson;
  } catch {
    return null;
  }
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function chatgptAccountIdFromIdTokenJwt(jwt: string): string | undefined {
  const payload = decodeJwtPayload(jwt);
  if (!payload) return undefined;
  const auth = payload['https://api.openai.com/auth'] as Record<string, unknown> | undefined;
  const id = auth?.chatgpt_account_id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function idTokenJwtFromTokens(tok: CodexTokenData): string | undefined {
  const raw = tok.id_token;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (raw && typeof raw === 'object' && typeof raw.raw_jwt === 'string') return raw.raw_jwt;
  return undefined;
}

/**
 * Platform API key only: env `OPENAI_API_KEY` or `OPENAI_API_KEY` stored by Codex (API-key login).
 * ChatGPT OAuth tokens are not valid for api.openai.com embedding routes.
 */
export function getPlatformOpenAiApiKey(): string | undefined {
  const env = process.env.OPENAI_API_KEY?.trim();
  if (env && !env.startsWith('your-')) return env;
  const auth = readCodexAuthDotJson();
  const k = auth?.OPENAI_API_KEY?.trim();
  if (k && !k.startsWith('your-')) return k;
  return undefined;
}

export type ResolvedOpenAiAuth =
  | { mode: 'platform'; apiKey: string }
  | { mode: 'codex_oauth'; accessToken: string; accountId: string };

export function resolveOpenAiAuth(): ResolvedOpenAiAuth | null {
  const platform = getPlatformOpenAiApiKey();
  if (platform) return { mode: 'platform', apiKey: platform };

  const auth = readCodexAuthDotJson();
  const tok = auth?.tokens;
  if (!tok?.access_token) return null;

  let accountId = tok.account_id?.trim() || undefined;
  if (!accountId) {
    const jwt = idTokenJwtFromTokens(tok);
    if (jwt) accountId = chatgptAccountIdFromIdTokenJwt(jwt);
  }
  if (!accountId) return null;

  return { mode: 'codex_oauth', accessToken: tok.access_token, accountId };
}

export function hasOpenAiCredentialsIncludingCodex(): boolean {
  return resolveOpenAiAuth() !== null;
}

export interface OpenAiLangChainClientOptions {
  apiKey: string;
  useResponsesApi: boolean;
  configuration?: ClientOptions;
  modelKwargs?: Record<string, unknown>;
}

/**
 * Options for {@link ChatOpenAI} when using the default OpenAI provider (env key, Codex file key, or Codex ChatGPT OAuth).
 */
export function getOpenAiLangChainClientOptions(): OpenAiLangChainClientOptions {
  const resolved = resolveOpenAiAuth();
  if (!resolved) {
    throw new Error(
      '[LLM] No OpenAI credentials: set OPENAI_API_KEY, or run `codex login` so ~/.codex/auth.json exists (set CODEX_HOME to override).',
    );
  }
  if (resolved.mode === 'platform') {
    return { apiKey: resolved.apiKey, useResponsesApi: false };
  }
  return {
    apiKey: resolved.accessToken,
    useResponsesApi: true,
    configuration: {
      baseURL: CODEX_CHATGPT_OPENAI_BASE_URL,
      defaultHeaders: {
        'ChatGPT-Account-ID': resolved.accountId,
      },
    },
    // ChatGPT Codex Responses route expects `store: false` for typical CLI-style calls.
    modelKwargs: { store: false },
  };
}
