import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEXTER_DIR = join(homedir(), '.dexter');
const CREDENTIALS_PATH = join(DEXTER_DIR, 'tastytrade-credentials.json');

const TOKEN_BUFFER_MS = 60 * 1000;

export interface TastytradeCredentials {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export type TastytradeOperatorState = 'not_connected' | 'read_only' | 'trading_enabled';

export interface TastytradeAuthStatus {
  configured: boolean;
  hasCredentials: boolean;
  credentialsPath: string;
  message: string;
  /** Three-state UX: not_connected, read_only (no live orders), trading_enabled (submit/cancel available). */
  operatorState: TastytradeOperatorState;
}

function getBaseUrl(): string {
  const sandbox = process.env.TASTYTRADE_SANDBOX === 'true';
  return sandbox ? 'https://api.cert.tastyworks.com' : 'https://api.tastytrade.com';
}

export function getCredentialsPath(): string {
  return CREDENTIALS_PATH;
}

/** True if TASTYTRADE_CLIENT_ID and TASTYTRADE_CLIENT_SECRET are set. */
export function hasConfiguredClient(): boolean {
  return Boolean(
    process.env.TASTYTRADE_CLIENT_ID &&
      process.env.TASTYTRADE_CLIENT_SECRET &&
      process.env.TASTYTRADE_CLIENT_ID.trim() !== '' &&
      process.env.TASTYTRADE_CLIENT_SECRET.trim() !== ''
  );
}

/** True if client is configured and credentials file exists with access_token or refresh_token. */
export function hasUsableCredentials(): boolean {
  if (!hasConfiguredClient()) return false;
  const creds = loadCredentials();
  return Boolean(creds && (creds.access_token || creds.refresh_token));
}

/** Human-readable status for CLI/setup flows. operatorState: not_connected | read_only | trading_enabled. */
export function getAuthStatus(): TastytradeAuthStatus {
  const configured = hasConfiguredClient();
  const hasCredentials = hasUsableCredentials();
  const tradingEnabled = process.env.TASTYTRADE_ORDER_ENABLED === 'true';
  if (!configured) {
    return {
      configured: false,
      hasCredentials: false,
      credentialsPath: CREDENTIALS_PATH,
      message:
        'Set TASTYTRADE_CLIENT_ID and TASTYTRADE_CLIENT_SECRET in .env (see env.example and docs/PRD-TASTYTRADE-INTEGRATION.md).',
      operatorState: 'not_connected',
    };
  }
  if (!hasCredentials) {
    return {
      configured: true,
      hasCredentials: false,
      credentialsPath: CREDENTIALS_PATH,
      message: `Add ${CREDENTIALS_PATH} with refresh_token (or access_token). Obtain via tastytrade OAuth; see docs/PRD-TASTYTRADE-INTEGRATION.md.`,
      operatorState: 'not_connected',
    };
  }
  return {
    configured: true,
    hasCredentials: true,
    credentialsPath: CREDENTIALS_PATH,
    message: tradingEnabled ? 'tastytrade auth ready (trading enabled).' : 'tastytrade auth ready (read-only).',
    operatorState: tradingEnabled ? 'trading_enabled' : 'read_only',
  };
}

export function loadCredentials(): TastytradeCredentials | null {
  if (!existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  try {
    const raw = readFileSync(CREDENTIALS_PATH, 'utf-8');
    const data = JSON.parse(raw) as TastytradeCredentials;
    if (!data.access_token && !data.refresh_token) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: TastytradeCredentials): void {
  if (!existsSync(DEXTER_DIR)) {
    mkdirSync(DEXTER_DIR, { recursive: true });
  }
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), 'utf-8');
  try {
    chmodSync(CREDENTIALS_PATH, 0o600);
  } catch {
    // Ignore on Windows or if chmod fails
  }
}

export function hasValidToken(): boolean {
  const creds = loadCredentials();
  if (!creds?.access_token && !creds?.refresh_token) return false;
  if (creds.access_token && creds.expires_at != null && Date.now() < creds.expires_at - TOKEN_BUFFER_MS) {
    return true;
  }
  return !!creds.refresh_token;
}

export async function getValidAccessToken(): Promise<string | null> {
  const creds = loadCredentials();
  if (!creds?.access_token && !creds?.refresh_token) return null;

  const now = Date.now();
  const expiresAt = creds.expires_at ?? 0;
  if (creds.access_token && expiresAt > 0 && now < expiresAt - TOKEN_BUFFER_MS) {
    return creds.access_token;
  }

  if (creds.refresh_token) {
    const newCreds = await refreshAccessToken(creds.refresh_token);
    if (newCreds) {
      saveCredentials(newCreds);
      return newCreds.access_token;
    }
  }

  return creds.access_token ?? null;
}

async function refreshAccessToken(refreshToken: string): Promise<TastytradeCredentials | null> {
  const clientId = process.env.TASTYTRADE_CLIENT_ID;
  const clientSecret = process.env.TASTYTRADE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const baseUrl = getBaseUrl();
  const tokenUrl = `${baseUrl}/oauth/token`;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }).toString();

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
      'User-Agent': 'Dexter/1.0',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const err = JSON.parse(text) as { error?: string; error_description?: string };
      throw new Error(`tastytrade refresh failed: ${err.error_description ?? err.error ?? res.statusText}`);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('tastytrade')) throw e;
      throw new Error(`tastytrade refresh failed: ${res.status} ${text}`);
    }
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const accessToken = data.access_token;
  if (!accessToken) return null;

  const expiresIn = data.expires_in ?? 15 * 60;
  return {
    access_token: accessToken,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Date.now() + expiresIn * 1000,
  };
}

/**
 * Exchange a refresh token (e.g. from tastytrade "Create Grant") for tokens and save to disk.
 * Used by CLI login flow.
 */
export async function loginWithRefreshToken(
  refreshToken: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmed = refreshToken.trim();
  if (!trimmed) return { success: false, error: 'Refresh token is empty.' };
  if (!hasConfiguredClient()) {
    return {
      success: false,
      error:
        'TASTYTRADE_CLIENT_ID and TASTYTRADE_CLIENT_SECRET must be set in .env (see env.example).',
    };
  }
  try {
    const creds = await refreshAccessToken(trimmed);
    if (!creds) return { success: false, error: 'Token exchange returned no credentials.' };
    saveCredentials(creds);
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}
