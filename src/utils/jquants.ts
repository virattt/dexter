/**
 * J-Quants API v2 client.
 *
 * Auth: x-api-key header (API key from dashboard).
 * Provides daily stock price data for Japanese equities.
 *
 * Note: J-Quants is for personal use only.
 * For SaaS deployment, replace with yfinance or another commercial data source.
 */
import { logger } from './logger.js';

const BASE_URL = 'https://api.jquants.com/v2';

// ============================================================================
// Auth
// ============================================================================

function getApiKey(): string {
  return process.env.JQUANTS_API_KEY || '';
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
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('[J-Quants] JQUANTS_API_KEY is not set');
    }

    const url = new URL(`${BASE_URL}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { 'x-api-key': apiKey },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[J-Quants] network error: ${endpoint} — ${message}`);
      throw new Error(`[J-Quants] request failed for ${endpoint}: ${message}`);
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
