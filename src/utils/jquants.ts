/**
 * J-Quants API client.
 *
 * Two-stage auth: refresh token → ID token (24h expiry).
 * Provides daily stock price data for Japanese equities.
 *
 * Note: J-Quants is for personal use only.
 * For SaaS deployment, replace with yfinance or another commercial data source.
 */
import { logger } from './logger.js';

const BASE_URL = 'https://api.jquants.com/v1';

// ID token cache (valid for 24 hours)
let cachedIdToken: string | null = null;
let tokenExpiresAt = 0;

// ============================================================================
// Auth
// ============================================================================

function getRefreshToken(): string {
  return process.env.JQUANTS_REFRESH_TOKEN || '';
}

async function getIdToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedIdToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedIdToken;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('[J-Quants] JQUANTS_REFRESH_TOKEN is not set');
  }

  const url = `${BASE_URL}/token/auth_refresh?refreshtoken=${refreshToken}`;

  let response: Response;
  try {
    response = await fetch(url, { method: 'POST' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[J-Quants] auth failed: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    throw new Error(`[J-Quants] auth failed: ${detail}. Check JQUANTS_REFRESH_TOKEN.`);
  }

  const data = await response.json() as { idToken?: string };
  if (!data.idToken) {
    throw new Error('[J-Quants] auth response missing idToken');
  }

  cachedIdToken = data.idToken;
  tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  logger.info('[J-Quants] ID token refreshed');

  return cachedIdToken;
}

// ============================================================================
// Public API
// ============================================================================

export interface JQuantsResponse {
  data: unknown;
  url: string;
}

export const jquants = {
  async get(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<JQuantsResponse> {
    const idToken = await getIdToken();

    const url = new URL(`${BASE_URL}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[J-Quants] network error: ${endpoint} — ${message}`);
      throw new Error(`[J-Quants] request failed for ${endpoint}: ${message}`);
    }

    if (response.status === 401) {
      // Token expired, retry once
      cachedIdToken = null;
      tokenExpiresAt = 0;
      const newToken = await getIdToken();

      response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${newToken}` },
      });
    }

    if (!response.ok) {
      const detail = `${response.status} ${response.statusText}`;
      logger.error(`[J-Quants] error: ${endpoint} — ${detail}`);
      throw new Error(`[J-Quants] request failed: ${detail}`);
    }

    const data = await response.json().catch(() => {
      throw new Error(`[J-Quants] invalid JSON response for ${endpoint}`);
    });

    return { data, url: url.toString() };
  },
};
