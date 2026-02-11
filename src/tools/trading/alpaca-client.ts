import { logger } from '../../utils/logger.js';

const PAPER_BASE_URL = 'https://paper-api.alpaca.markets';
const LIVE_BASE_URL = 'https://api.alpaca.markets';

export interface AlpacaResponse {
  data: Record<string, unknown> | Record<string, unknown>[];
  url: string;
}

/**
 * Check if Alpaca is configured in paper (simulated) mode.
 * Defaults to paper mode when ALPACA_PAPER is unset or not explicitly "false".
 */
export function isPaperMode(): boolean {
  return process.env.ALPACA_PAPER !== 'false';
}

/**
 * Get the base URL for the Alpaca API based on paper/live mode.
 */
function getBaseUrl(): string {
  return isPaperMode() ? PAPER_BASE_URL : LIVE_BASE_URL;
}

/**
 * Call the Alpaca REST API.
 *
 * @param method - HTTP method (GET, POST, DELETE, PATCH)
 * @param endpoint - API endpoint (e.g., /v2/account)
 * @param body - Optional request body for POST/PATCH
 * @returns Response data and URL
 */
export async function callAlpacaApi(
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
  endpoint: string,
  body?: Record<string, unknown>
): Promise<AlpacaResponse> {
  // Read API keys lazily at call time (after dotenv has loaded)
  const apiKey = process.env.ALPACA_API_KEY;
  const secretKey = process.env.ALPACA_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('[Alpaca API] ALPACA_API_KEY and ALPACA_SECRET_KEY must be set');
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  const label = `${method} ${endpoint}`;

  const headers: Record<string, string> = {
    'APCA-API-KEY-ID': apiKey,
    'APCA-API-SECRET-KEY': secretKey,
    'Content-Type': 'application/json',
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Alpaca API] network error: ${label} — ${message}`);
    throw new Error(`[Alpaca API] request failed for ${label}: ${message}`);
  }

  // DELETE returns 204 No Content on success
  if (method === 'DELETE' && response.status === 204) {
    return { data: { success: true }, url };
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {}
    logger.error(`[Alpaca API] error: ${label} — ${detail} ${errorBody}`);
    throw new Error(`[Alpaca API] request failed: ${detail}${errorBody ? ` — ${errorBody}` : ''}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[Alpaca API] parse error: ${label} — ${detail}`);
    throw new Error(`[Alpaca API] request failed: ${detail}`);
  });

  return { data, url };
}
