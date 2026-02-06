import { readCache, writeCache, describeRequest } from './cache.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.financialdatasets.ai';

export interface ApiResponse {
  data: Record<string, unknown>;
  url: string;
}

export async function callApi(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>
): Promise<ApiResponse> {
  const label = describeRequest(endpoint, params);

  // Check local cache first — avoids redundant network calls for historical data
  const cached = readCache(endpoint, params);
  if (cached) {
    return cached;
  }

  // Read API key lazily at call time (after dotenv has loaded)
  const FINANCIAL_DATASETS_API_KEY = process.env.FINANCIAL_DATASETS_API_KEY;

  if (!FINANCIAL_DATASETS_API_KEY) {
    logger.warn(`API call without key: ${label}`);
  }

  const url = new URL(`${BASE_URL}${endpoint}`);

  // Add params to URL, handling arrays
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        'x-api-key': FINANCIAL_DATASETS_API_KEY || '',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`API network error: ${label} — ${message}`);
    throw new Error(`API request failed for ${label}: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`API error: ${label} — ${detail}`);
    throw new Error(`API request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`API parse error: ${label} — ${detail}`);
    throw new Error(`API request failed: ${detail}`);
  });

  // Cache the response for future requests (no-op for real-time endpoints)
  writeCache(endpoint, params, data, url.toString());

  return { data, url: url.toString() };
}

