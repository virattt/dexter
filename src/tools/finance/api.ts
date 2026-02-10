import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.financialdatasets.ai';

function apiError(label: string, detail: string, logPrefix = 'API error'): never {
  logger.error(`${logPrefix}: ${label} — ${detail}`);
  throw new Error(`API request failed: ${detail}`);
}

export interface ApiResponse {
  data: Record<string, unknown>;
  url: string;
}

export async function callApi(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
  options?: { cacheable?: boolean }
): Promise<ApiResponse> {
  const label = describeRequest(endpoint, params);

  // Check local cache first — avoids redundant network calls for immutable data
  if (options?.cacheable) {
    const cached = readCache(endpoint, params);
    if (cached) {
      return cached;
    }
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
    apiError(label, message, 'API network error');
  }

  const statusInfo = `${response.status} ${response.statusText}`;

  let data: any;
  try {
    data = await response.json();
  } catch {
    apiError(label, `invalid JSON (${statusInfo})`, 'API parse error');
  }

  if (!response.ok) {
    const bodyMessage = data.message || data.error || '';
    const detail = bodyMessage ? `${statusInfo} — ${bodyMessage}` : statusInfo;
    apiError(label, detail);
  }

  // Persist for future requests when the caller marked the response as cacheable
  if (options?.cacheable) {
    writeCache(endpoint, params, data, url.toString());
  }

  return { data, url: url.toString() };
}

