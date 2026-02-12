import { getSetting, setSetting } from './config.js';

const OPENAI_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const OPENAI_OAUTH_ISSUER = 'https://auth.openai.com';
const OPENAI_DEVICE_VERIFICATION_URL = `${OPENAI_OAUTH_ISSUER}/codex/device`;
const OPENAI_DEVICE_AUTH_REDIRECT_URI = `${OPENAI_OAUTH_ISSUER}/deviceauth/callback`;
const OPENAI_OAUTH_POLLING_SAFETY_MARGIN_MS = 3000;
const OPENAI_OAUTH_DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const OPENAI_OAUTH_REFRESH_SKEW_MS = 60 * 1000;

const OPENAI_OAUTH_MODELS = new Set([
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
  'gpt-5.1-codex',
  'gpt-5.2',
  'gpt-5.2-codex',
  'gpt-5.3-codex',
]);

export type OpenAIAuthMode = 'api_key' | 'oauth';

interface OpenAIOAuthRecord {
  refresh: string;
  access: string;
  expires: number;
  accountId?: string;
}

export interface OpenAIOAuthCredentials {
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
  accountId?: string;
}

interface OpenAIDeviceAuthStartResponse {
  device_auth_id: string;
  user_code: string;
  interval: string;
}

interface OpenAIDeviceAuthTokenResponse {
  authorization_code: string;
  code_verifier: string;
}

interface OpenAITokenResponse {
  id_token?: string;
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

interface IdTokenClaims {
  chatgpt_account_id?: string;
  organizations?: Array<{ id: string }>;
  'https://api.openai.com/auth'?: {
    chatgpt_account_id?: string;
  };
}

export interface OpenAIDeviceAuthSession {
  verificationUrl: string;
  userCode: string;
  intervalMs: number;
  deviceAuthId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOpenAIOAuthRecord(): OpenAIOAuthRecord | null {
  const raw = getSetting<unknown>('openaiOAuth', null);
  if (!isRecord(raw)) {
    return null;
  }

  const refresh = raw.refresh;
  const access = raw.access;
  const expires = raw.expires;
  const accountId = raw.accountId;

  if (typeof refresh !== 'string' || !refresh.trim()) {
    return null;
  }
  if (typeof access !== 'string' || !access.trim()) {
    return null;
  }
  if (typeof expires !== 'number' || !Number.isFinite(expires)) {
    return null;
  }

  return {
    refresh,
    access,
    expires,
    ...(typeof accountId === 'string' && accountId.trim() ? { accountId } : {}),
  };
}

function toCredentials(record: OpenAIOAuthRecord): OpenAIOAuthCredentials {
  return {
    refreshToken: record.refresh,
    accessToken: record.access,
    expiresAt: record.expires,
    ...(record.accountId ? { accountId: record.accountId } : {}),
  };
}

function toRecord(credentials: OpenAIOAuthCredentials): OpenAIOAuthRecord {
  return {
    refresh: credentials.refreshToken,
    access: credentials.accessToken,
    expires: credentials.expiresAt,
    ...(credentials.accountId ? { accountId: credentials.accountId } : {}),
  };
}

export function getOpenAIAuthMode(): OpenAIAuthMode {
  const mode = getSetting<string>('openaiAuthMode', 'api_key');
  return mode === 'oauth' ? 'oauth' : 'api_key';
}

export function setOpenAIAuthMode(mode: OpenAIAuthMode): boolean {
  return setSetting('openaiAuthMode', mode);
}

export function isOpenAIOAuthModelSupported(modelId: string): boolean {
  return OPENAI_OAUTH_MODELS.has(modelId);
}

export function loadOpenAIOAuthCredentials(): OpenAIOAuthCredentials | null {
  const record = readOpenAIOAuthRecord();
  if (!record) {
    return null;
  }
  return toCredentials(record);
}

export function hasOpenAIOAuthCredentials(): boolean {
  const credentials = loadOpenAIOAuthCredentials();
  return Boolean(credentials?.refreshToken);
}

export function saveOpenAIOAuthCredentials(credentials: OpenAIOAuthCredentials): boolean {
  return setSetting('openaiOAuth', toRecord(credentials));
}

function parseJwtClaims(token: string): IdTokenClaims | undefined {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return undefined;
  }

  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload) as IdTokenClaims;
  } catch {
    return undefined;
  }
}

function extractAccountIdFromClaims(claims: IdTokenClaims): string | undefined {
  return (
    claims.chatgpt_account_id
    ?? claims['https://api.openai.com/auth']?.chatgpt_account_id
    ?? claims.organizations?.[0]?.id
  );
}

function extractAccountId(tokens: OpenAITokenResponse): string | undefined {
  if (tokens.id_token) {
    const claims = parseJwtClaims(tokens.id_token);
    if (claims) {
      const accountId = extractAccountIdFromClaims(claims);
      if (accountId) {
        return accountId;
      }
    }
  }

  const accessClaims = parseJwtClaims(tokens.access_token);
  return accessClaims ? extractAccountIdFromClaims(accessClaims) : undefined;
}

function parsePositivePollingInterval(interval: string): number {
  const parsed = Number.parseInt(interval, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5000;
  }
  return parsed * 1000;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return String(error);
}

async function throwForStatus(response: Response, prefix: string): Promise<never> {
  let details = '';
  try {
    details = (await response.text()).trim();
  } catch {
    details = '';
  }

  if (details.length > 200) {
    details = details.slice(0, 200);
  }

  throw new Error(details ? `${prefix} (${response.status}): ${details}` : `${prefix} (${response.status})`);
}

async function exchangeAuthorizationCode(
  authorizationCode: string,
  codeVerifier: string,
): Promise<OpenAITokenResponse> {
  const response = await fetch(`${OPENAI_OAUTH_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: OPENAI_DEVICE_AUTH_REDIRECT_URI,
      client_id: OPENAI_OAUTH_CLIENT_ID,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    await throwForStatus(response, 'OpenAI OAuth token exchange failed');
  }

  return response.json() as Promise<OpenAITokenResponse>;
}

async function refreshAccessToken(refreshToken: string): Promise<OpenAITokenResponse> {
  const response = await fetch(`${OPENAI_OAUTH_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: OPENAI_OAUTH_CLIENT_ID,
    }).toString(),
  });

  if (!response.ok) {
    await throwForStatus(response, 'OpenAI OAuth token refresh failed');
  }

  return response.json() as Promise<OpenAITokenResponse>;
}

function mapTokenResponse(
  tokenResponse: OpenAITokenResponse,
  fallbackAccountId?: string,
): OpenAIOAuthCredentials {
  const accountId = extractAccountId(tokenResponse) || fallbackAccountId;
  return {
    refreshToken: tokenResponse.refresh_token,
    accessToken: tokenResponse.access_token,
    expiresAt: Date.now() + (tokenResponse.expires_in ?? 3600) * 1000,
    ...(accountId ? { accountId } : {}),
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('OpenAI OAuth cancelled.');
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  if (signal.aborted) {
    return Promise.reject(new Error('OpenAI OAuth cancelled.'));
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      reject(new Error('OpenAI OAuth cancelled.'));
    };

    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function startOpenAIDeviceAuth(userAgent = 'dexter-ts'): Promise<OpenAIDeviceAuthSession> {
  const response = await fetch(`${OPENAI_OAUTH_ISSUER}/api/accounts/deviceauth/usercode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    },
    body: JSON.stringify({
      client_id: OPENAI_OAUTH_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    await throwForStatus(response, 'Failed to initiate OpenAI OAuth');
  }

  const data = await response.json() as OpenAIDeviceAuthStartResponse;
  if (!data?.device_auth_id || !data?.user_code) {
    throw new Error('Invalid OpenAI OAuth device authorization response.');
  }

  return {
    verificationUrl: OPENAI_DEVICE_VERIFICATION_URL,
    userCode: data.user_code,
    intervalMs: parsePositivePollingInterval(data.interval),
    deviceAuthId: data.device_auth_id,
  };
}

interface PollDeviceAuthOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  userAgent?: string;
}

export async function pollOpenAIDeviceAuth(
  session: OpenAIDeviceAuthSession,
  options: PollDeviceAuthOptions = {},
): Promise<OpenAIOAuthCredentials> {
  const timeoutMs = options.timeoutMs ?? OPENAI_OAUTH_DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();

  while (true) {
    throwIfAborted(options.signal);

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('OpenAI OAuth timed out.');
    }

    const response = await fetch(`${OPENAI_OAUTH_ISSUER}/api/accounts/deviceauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': options.userAgent ?? 'dexter-ts',
      },
      body: JSON.stringify({
        device_auth_id: session.deviceAuthId,
        user_code: session.userCode,
      }),
    });

    if (response.ok) {
      const deviceAuthToken = await response.json() as OpenAIDeviceAuthTokenResponse;
      if (!deviceAuthToken.authorization_code || !deviceAuthToken.code_verifier) {
        throw new Error('Invalid OpenAI OAuth device token response.');
      }

      const tokenResponse = await exchangeAuthorizationCode(
        deviceAuthToken.authorization_code,
        deviceAuthToken.code_verifier,
      );
      return mapTokenResponse(tokenResponse);
    }

    if (response.status !== 403 && response.status !== 404) {
      await throwForStatus(response, 'OpenAI OAuth authorization failed');
    }

    try {
      await sleep(session.intervalMs + OPENAI_OAUTH_POLLING_SAFETY_MARGIN_MS, options.signal);
    } catch (error) {
      throw new Error(normalizeErrorMessage(error));
    }
  }
}

interface GetValidOpenAIOAuthCredentialsOptions {
  forceRefresh?: boolean;
  minTtlMs?: number;
}

export async function getValidOpenAIOAuthCredentials(
  options: GetValidOpenAIOAuthCredentialsOptions = {},
): Promise<OpenAIOAuthCredentials | null> {
  const current = loadOpenAIOAuthCredentials();
  if (!current) {
    return null;
  }

  const minTtlMs = options.minTtlMs ?? OPENAI_OAUTH_REFRESH_SKEW_MS;
  const stillValid = current.accessToken && current.expiresAt > Date.now() + minTtlMs;

  if (!options.forceRefresh && stillValid) {
    return current;
  }

  const refreshed = await refreshAccessToken(current.refreshToken);
  const updated = mapTokenResponse(refreshed, current.accountId);

  if (!saveOpenAIOAuthCredentials(updated)) {
    throw new Error('Failed to persist refreshed OpenAI OAuth credentials.');
  }

  return updated;
}
