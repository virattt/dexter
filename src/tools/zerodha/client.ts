/**
 * Zerodha Kite Connect client helper.
 * Uses KITE_API_KEY and KITE_ACCESS_TOKEN from env, or generates session from KITE_REQUEST_TOKEN + KITE_API_SECRET.
 */
import { KiteConnect, type Connect } from 'kiteconnect';

let cachedClient: Connect | null = null;

function getEnv(key: string): string | undefined {
  return process.env[key];
}

/**
 * Returns an authenticated Kite Connect instance or null if credentials are missing.
 * Caches the client for the process lifetime.
 */
export async function getKiteClient(): Promise<Connect | null> {
  const apiKey = getEnv('KITE_API_KEY');
  if (!apiKey) return null;

  if (cachedClient) {
    return cachedClient;
  }

  const kc = new KiteConnect({ api_key: apiKey });

  const accessToken = getEnv('KITE_ACCESS_TOKEN');
  if (accessToken) {
    kc.setAccessToken(accessToken);
    cachedClient = kc;
    return kc;
  }

  const requestToken = getEnv('KITE_REQUEST_TOKEN');
  const apiSecret = getEnv('KITE_API_SECRET');
  if (requestToken && apiSecret) {
    const session = await kc.generateSession(requestToken, apiSecret);
    kc.setAccessToken(session.access_token);
    cachedClient = kc;
    return kc;
  }

  return null;
}

/**
 * Check if Zerodha Kite is configured (API key + access token or request token + secret).
 */
export function isZerodhaConfigured(): boolean {
  const apiKey = getEnv('KITE_API_KEY');
  if (!apiKey) return false;
  if (getEnv('KITE_ACCESS_TOKEN')) return true;
  if (getEnv('KITE_REQUEST_TOKEN') && getEnv('KITE_API_SECRET')) return true;
  return false;
}
