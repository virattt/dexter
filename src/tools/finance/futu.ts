import { logger } from '../../utils/logger.js';

/**
 * Futu OpenD bridge client.
 *
 * The Futu OpenD gateway (futu-api, Python-only) is exposed locally by
 * futu-bridge/server.py as a REST API. This client maps Dexter's market-data
 * endpoints onto that bridge and returns the JSON unchanged (the bridge
 * already shapes it as {snapshot} / {prices} / {tickers}).
 */

const BRIDGE = (process.env.FUTU_BRIDGE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');

function bridgePath(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, String(x)));
    else q.append(k, String(v));
  }
  const query = q.toString();

  switch (endpoint) {
    case '/prices/snapshot/':
      return `/prices/snapshot?${query}`;
    case '/prices/':
      return `/prices?${query}`;
    case '/prices/snapshot/tickers/':
      return `/prices/snapshot/tickers?${query}`;
    case '/crypto/prices/snapshot/':
      return `/crypto/prices/snapshot?${query}`;
    case '/crypto/prices/':
      return `/crypto/prices?${query}`;
    case '/crypto/prices/tickers/':
      return `/crypto/prices/tickers?${query}`;
    default:
      throw new Error(`[Futu bridge] unsupported endpoint: ${endpoint}`);
  }
}

export interface FutuResponse {
  data: Record<string, unknown>;
  url: string;
}

export async function futuRequest(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
): Promise<FutuResponse> {
  const path = bridgePath(endpoint, params);
  const url = `${BRIDGE}${path}`;
  const label = `${endpoint} ${JSON.stringify(params)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[Futu bridge] cannot reach ${BRIDGE} (${label}): ${message}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`[Futu bridge] ${response.status} ${response.statusText} — ${text}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  if (json && typeof json.error === 'string') {
    logger.error(`[Futu bridge] upstream error: ${json.error}`);
    throw new Error(`[Futu bridge] ${json.error}`);
  }

  return { data: json, url };
}
