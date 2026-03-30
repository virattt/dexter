import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

/**
 * Twelve Data API client for forex, indices, and commodities market data.
 * https://twelvedata.com/docs
 */

const BASE_URL = 'https://api.twelvedata.com';

export interface ApiResponse {
  data: Record<string, unknown>;
  url: string;
}

function getApiKey(): string {
  return process.env.TWELVE_DATA_API_KEY || '';
}

async function executeRequest(
  url: string,
  label: string,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Twelve Data API] network error: ${label} — ${message}`);
    throw new Error(`[Twelve Data API] request failed for ${label}: ${message}`);
  }

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[Twelve Data API] error: ${label} — ${detail}`);
    throw new Error(`[Twelve Data API] request failed: ${detail}`);
  }

  const data = await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[Twelve Data API] parse error: ${label} — ${detail}`);
    throw new Error(`[Twelve Data API] request failed: ${detail}`);
  });

  // Twelve Data returns { status: "error", message: "..." } on logical errors
  if (data && typeof data === 'object' && (data as Record<string, unknown>).status === 'error') {
    const msg = (data as Record<string, unknown>).message || 'Unknown error';
    throw new Error(`[Twelve Data API] ${msg}`);
  }

  return data as Record<string, unknown>;
}

export const api = {
  async get(
    endpoint: string,
    params: Record<string, string | number | undefined>,
    options?: { cacheable?: boolean },
  ): Promise<ApiResponse> {
    const label = describeRequest(endpoint, params);

    if (options?.cacheable) {
      const cached = readCache(endpoint, params);
      if (cached) {
        return cached;
      }
    }

    const url = new URL(`${BASE_URL}${endpoint}`);
    const apiKey = getApiKey();
    if (apiKey) {
      url.searchParams.append('apikey', apiKey);
    }

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }

    const data = await executeRequest(url.toString(), label);

    if (options?.cacheable) {
      writeCache(endpoint, params, data, url.toString());
    }

    // Strip API key from returned URL for security
    const cleanUrl = new URL(url.toString());
    cleanUrl.searchParams.delete('apikey');

    return { data, url: cleanUrl.toString() };
  },
};

/**
 * Fintokei instrument symbols mapping.
 * Maps common names to broker symbols used on Fintokei (MT4/MT5 format).
 */
export const FINTOKEI_INSTRUMENTS = {
  // FX Majors
  'EUR/USD': { symbol: 'EUR/USD', type: 'forex', pipSize: 0.0001, category: 'FX Major' },
  'GBP/USD': { symbol: 'GBP/USD', type: 'forex', pipSize: 0.0001, category: 'FX Major' },
  'USD/JPY': { symbol: 'USD/JPY', type: 'forex', pipSize: 0.01, category: 'FX Major' },
  'USD/CHF': { symbol: 'USD/CHF', type: 'forex', pipSize: 0.0001, category: 'FX Major' },
  'AUD/USD': { symbol: 'AUD/USD', type: 'forex', pipSize: 0.0001, category: 'FX Major' },
  'USD/CAD': { symbol: 'USD/CAD', type: 'forex', pipSize: 0.0001, category: 'FX Major' },
  'NZD/USD': { symbol: 'NZD/USD', type: 'forex', pipSize: 0.0001, category: 'FX Major' },
  // FX Minors / Crosses
  'EUR/GBP': { symbol: 'EUR/GBP', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'EUR/JPY': { symbol: 'EUR/JPY', type: 'forex', pipSize: 0.01, category: 'FX Minor' },
  'GBP/JPY': { symbol: 'GBP/JPY', type: 'forex', pipSize: 0.01, category: 'FX Minor' },
  'EUR/AUD': { symbol: 'EUR/AUD', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'EUR/CAD': { symbol: 'EUR/CAD', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'EUR/CHF': { symbol: 'EUR/CHF', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'GBP/AUD': { symbol: 'GBP/AUD', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'GBP/CAD': { symbol: 'GBP/CAD', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'GBP/CHF': { symbol: 'GBP/CHF', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'AUD/JPY': { symbol: 'AUD/JPY', type: 'forex', pipSize: 0.01, category: 'FX Minor' },
  'AUD/CAD': { symbol: 'AUD/CAD', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'AUD/CHF': { symbol: 'AUD/CHF', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'AUD/NZD': { symbol: 'AUD/NZD', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'NZD/JPY': { symbol: 'NZD/JPY', type: 'forex', pipSize: 0.01, category: 'FX Minor' },
  'NZD/CAD': { symbol: 'NZD/CAD', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'NZD/CHF': { symbol: 'NZD/CHF', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'CAD/JPY': { symbol: 'CAD/JPY', type: 'forex', pipSize: 0.01, category: 'FX Minor' },
  'CAD/CHF': { symbol: 'CAD/CHF', type: 'forex', pipSize: 0.0001, category: 'FX Minor' },
  'CHF/JPY': { symbol: 'CHF/JPY', type: 'forex', pipSize: 0.01, category: 'FX Minor' },
  // Stock Indices
  'JP225': { symbol: 'NIKKEI/JPY', type: 'index', pipSize: 1, category: 'Index' },
  'US30': { symbol: 'DJI', type: 'index', pipSize: 1, category: 'Index' },
  'US500': { symbol: 'SPX', type: 'index', pipSize: 0.1, category: 'Index' },
  'NAS100': { symbol: 'IXIC', type: 'index', pipSize: 0.1, category: 'Index' },
  'GER40': { symbol: 'GDAXI', type: 'index', pipSize: 0.1, category: 'Index' },
  'UK100': { symbol: 'UKX', type: 'index', pipSize: 0.1, category: 'Index' },
  'FRA40': { symbol: 'FCHI', type: 'index', pipSize: 0.1, category: 'Index' },
  'AUS200': { symbol: 'AXJO', type: 'index', pipSize: 0.1, category: 'Index' },
  'HK50': { symbol: 'HSI', type: 'index', pipSize: 1, category: 'Index' },
  // Commodities
  'XAUUSD': { symbol: 'XAU/USD', type: 'commodity', pipSize: 0.01, category: 'Commodity' },
  'XAGUSD': { symbol: 'XAG/USD', type: 'commodity', pipSize: 0.001, category: 'Commodity' },
  'USOIL': { symbol: 'CL', type: 'commodity', pipSize: 0.01, category: 'Commodity' },
  'UKOIL': { symbol: 'BZ', type: 'commodity', pipSize: 0.01, category: 'Commodity' },
} as const;

export type FintokeiInstrument = keyof typeof FINTOKEI_INSTRUMENTS;

/**
 * Resolve a user-friendly instrument name to its API symbol.
 */
export function resolveSymbol(input: string): { apiSymbol: string; instrument: (typeof FINTOKEI_INSTRUMENTS)[FintokeiInstrument] } | null {
  const normalized = input.trim().toUpperCase().replace(/\s+/g, '');

  // Direct match
  if (normalized in FINTOKEI_INSTRUMENTS) {
    const key = normalized as FintokeiInstrument;
    return { apiSymbol: FINTOKEI_INSTRUMENTS[key].symbol, instrument: FINTOKEI_INSTRUMENTS[key] };
  }

  // Try with slash for forex pairs (e.g., EURUSD -> EUR/USD)
  if (normalized.length === 6 && !normalized.includes('/')) {
    const withSlash = `${normalized.slice(0, 3)}/${normalized.slice(3)}` as FintokeiInstrument;
    if (withSlash in FINTOKEI_INSTRUMENTS) {
      return { apiSymbol: FINTOKEI_INSTRUMENTS[withSlash].symbol, instrument: FINTOKEI_INSTRUMENTS[withSlash] };
    }
  }

  // Common aliases
  const aliases: Record<string, FintokeiInstrument> = {
    'GOLD': 'XAUUSD',
    'SILVER': 'XAGUSD',
    'OIL': 'USOIL',
    'NIKKEI': 'JP225',
    'NIKKEI225': 'JP225',
    'DOW': 'US30',
    'DOWJONES': 'US30',
    'SP500': 'US500',
    'S&P500': 'US500',
    'NASDAQ': 'NAS100',
    'NASDAQ100': 'NAS100',
    'DAX': 'GER40',
    'DAX40': 'GER40',
    'FTSE': 'UK100',
    'FTSE100': 'UK100',
    'CAC40': 'FRA40',
    'CAC': 'FRA40',
    'ASX200': 'AUS200',
    'HANGSENG': 'HK50',
    'WTI': 'USOIL',
    'BRENT': 'UKOIL',
  };

  if (normalized in aliases) {
    const key = aliases[normalized];
    return { apiSymbol: FINTOKEI_INSTRUMENTS[key].symbol, instrument: FINTOKEI_INSTRUMENTS[key] };
  }

  return null;
}
