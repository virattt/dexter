import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

function getBaseUrl(): string {
  const sandbox = process.env.TASTYTRADE_SANDBOX === 'true';
  return sandbox ? 'https://api.cert.tastyworks.com' : 'https://api.tastytrade.com';
}

export function getCredentialsPath(): string {
  return CREDENTIALS_PATH;
}

export function loadCredentials(): TastytradeCredentials | null {
  if (!existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  try {
    const raw = readFileSync(CREDENTIALS_PATH, 'utf-8');
    const data = JSON.parse(raw) as TastytradeCredentials;
    if (!data.access_token) return null;
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
}

export function hasValidToken(): boolean {
  const creds = loadCredentials();
  if (!creds?.access_token) return false;
  if (creds.expires_at != null && Date.now() >= creds.expires_at - TOKEN_BUFFER_MS) {
    return !!creds.refresh_token;
  }
  return true;
}

export async function getValidAccessToken(): Promise<string | null> {
  const creds = loadCredentials();
  if (!creds?.access_token) return null;

  const now = Date.now();
  const expiresAt = creds.expires_at ?? 0;
  if (expiresAt > 0 && now < expiresAt - TOKEN_BUFFER_MS) {
    return creds.access_token;
  }

  if (creds.refresh_token) {
    const newCreds = await refreshAccessToken(creds.refresh_token);
    if (newCreds) {
      saveCredentials(newCreds);
      return newCreds.access_token;
    }
  }

  return creds.access_token;
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
