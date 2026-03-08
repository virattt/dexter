import { getValidAccessToken } from './auth.js';

const MAX_CONCURRENT = 5;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

function getBaseUrl(): string {
  const sandbox = process.env.TASTYTRADE_SANDBOX === 'true';
  return sandbox ? 'https://api.cert.tastyworks.com' : 'https://api.tastytrade.com';
}

class ApiSemaphore {
  private queue: (() => void)[] = [];
  private active = 0;
  constructor(private max: number) {}
  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }
  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

const semaphore = new ApiSemaphore(MAX_CONCURRENT);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TastytradeApiResponse<T = unknown> {
  data: T;
  status: number;
}

export async function tastytradeRequest<T = unknown>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: string; query?: Record<string, string> } = {}
): Promise<TastytradeApiResponse<T>> {
  const method = options.method ?? 'GET';
  let token = await getValidAccessToken();
  if (!token) {
    throw new Error(
      'tastytrade not authenticated. Set TASTYTRADE_CLIENT_ID and TASTYTRADE_CLIENT_SECRET, then add refresh_token (or access_token) to ~/.dexter/tastytrade-credentials.json. See docs/PRD-TASTYTRADE-INTEGRATION.md.'
    );
  }

  const baseUrl = getBaseUrl();
  let pathWithQuery = path.startsWith('/') ? path : `/${path}`;
  if (options.query && Object.keys(options.query).length > 0) {
    const q = new URLSearchParams(options.query).toString();
    pathWithQuery += (pathWithQuery.includes('?') ? '&' : '?') + q;
  }
  const url = pathWithQuery.startsWith('http') ? pathWithQuery : `${baseUrl}${pathWithQuery}`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await semaphore.acquire();
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Dexter/1.0',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body,
      });

      if (res.status === 401 && attempt < MAX_RETRIES) {
        token = await getValidAccessToken();
        if (token) {
          await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
          continue;
        }
      }

      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = res.headers.get('retry-after');
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      const text = await res.text();
      let data: T;
      try {
        data = (text ? JSON.parse(text) : {}) as T;
      } catch {
        throw new Error(`tastytrade API invalid JSON: ${res.status} ${res.statusText}`);
      }

      if (!res.ok) {
        const err = data as { error?: string; message?: string };
        throw new Error(`tastytrade API ${res.status}: ${err.message ?? err.error ?? res.statusText}`);
      }

      return { data, status: res.status };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < MAX_RETRIES) {
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
      } else {
        throw lastError;
      }
    } finally {
      semaphore.release();
    }
  }

  throw lastError ?? new Error('tastytrade API request failed');
}

export async function getAccounts(): Promise<TastytradeApiResponse<unknown>> {
  return tastytradeRequest('/customers/me/accounts');
}

export async function getBalances(accountNumber: string): Promise<TastytradeApiResponse<unknown>> {
  return tastytradeRequest(`/accounts/${encodeURIComponent(accountNumber)}/balances`);
}

export async function getPositions(accountNumber: string): Promise<TastytradeApiResponse<unknown>> {
  return tastytradeRequest(`/accounts/${encodeURIComponent(accountNumber)}/positions`);
}

/** Nested option chain by underlying symbol (e.g. SPY, AAPL). Returns expirations and strikes with call/put symbols. */
export async function getOptionChain(underlyingSymbol: string): Promise<TastytradeApiResponse<unknown>> {
  const symbol = underlyingSymbol.trim().toUpperCase();
  return tastytradeRequest(`/option-chains/${encodeURIComponent(symbol)}/nested`);
}

/** Quote for one or more symbols. Pass any symbol type (equity, index, option). Batches large lists to avoid URL length limits. */
export async function getQuotes(symbols: string[], _instrumentType?: string): Promise<TastytradeApiResponse<unknown>> {
  const cleaned = symbols.map((s) => s.trim()).filter(Boolean);
  const BATCH_SIZE = 50;
  if (cleaned.length <= BATCH_SIZE) {
    return tastytradeRequest<unknown>('/market-data', { query: { symbols: cleaned.join(',') } });
  }
  const allItems: unknown[] = [];
  for (let i = 0; i < cleaned.length; i += BATCH_SIZE) {
    const batch = cleaned.slice(i, i + BATCH_SIZE);
    const res = await tastytradeRequest<unknown>('/market-data', { query: { symbols: batch.join(',') } });
    const data = res.data as { data?: { items?: unknown[] }; items?: unknown[] };
    const items = data?.data?.items ?? data?.items ?? (Array.isArray(res.data) ? res.data : []);
    allItems.push(...items);
  }
  return { data: { data: { items: allItems } } as unknown, status: 200 };
}

/** Symbol search by prefix or phrase. */
export async function symbolSearch(query: string): Promise<TastytradeApiResponse<unknown>> {
  const q = encodeURIComponent(query.trim());
  return tastytradeRequest(`/symbols/search?prefix=${q}`);
}

/** Live (and recent) orders for an account. Includes working, filled, and cancelled from last 24h. */
export async function getLiveOrders(accountNumber: string): Promise<TastytradeApiResponse<unknown>> {
  return tastytradeRequest(`/accounts/${encodeURIComponent(accountNumber)}/orders/live`);
}

/** Dry run: validate order and get buying power/fee impact without submitting. */
export async function orderDryRun(accountNumber: string, order: unknown): Promise<TastytradeApiResponse<unknown>> {
  const body = JSON.stringify(order);
  return tastytradeRequest(`/accounts/${encodeURIComponent(accountNumber)}/orders`, {
    method: 'POST',
    body,
    query: { dry_run: 'true' },
  });
}

/** Submit order to the market. Only when TASTYTRADE_ORDER_ENABLED=true. */
export async function submitOrder(accountNumber: string, order: unknown): Promise<TastytradeApiResponse<unknown>> {
  const body = JSON.stringify(order);
  return tastytradeRequest(`/accounts/${encodeURIComponent(accountNumber)}/orders`, { method: 'POST', body });
}

/** Cancel an open order by id. */
export async function cancelOrder(accountNumber: string, orderId: string): Promise<TastytradeApiResponse<unknown>> {
  return tastytradeRequest(`/accounts/${encodeURIComponent(accountNumber)}/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
  });
}

/** Transaction history for an account. Optional filters: start_date, end_date (YYYY-MM-DD), type (e.g. Trade, Money Movement). */
export async function getTransactions(
  accountNumber: string,
  params?: { start_date?: string; end_date?: string; type?: string }
): Promise<TastytradeApiResponse<unknown>> {
  const query: Record<string, string> = {};
  if (params?.start_date) query['start-date'] = params.start_date;
  if (params?.end_date) query['end-date'] = params.end_date;
  if (params?.type) query['type'] = params.type;
  return tastytradeRequest(`/accounts/${encodeURIComponent(accountNumber)}/transactions`, {
    query: Object.keys(query).length > 0 ? query : undefined,
  });
}

/** List the user's private watchlists. */
export async function getWatchlists(): Promise<TastytradeApiResponse<unknown>> {
  return tastytradeRequest('/watchlists');
}

/** Get a single private watchlist by name. */
export async function getWatchlist(name: string): Promise<TastytradeApiResponse<unknown>> {
  return tastytradeRequest(`/watchlists/${encodeURIComponent(name)}`);
}

/** Create a new private watchlist. Body: { name, "watchlist-entries"?: [{ symbol, "instrument-type" }], "group-name"?, "order-index"? }. */
export async function createWatchlist(body: {
  name: string;
  'watchlist-entries'?: Array<{ symbol: string; 'instrument-type'?: string }>;
  'group-name'?: string;
  'order-index'?: number;
}): Promise<TastytradeApiResponse<unknown>> {
  const payload = {
    name: body.name,
    'watchlist-entries': body['watchlist-entries'] ?? [],
    'group-name': body['group-name'] ?? 'default',
    'order-index': body['order-index'] ?? 9999,
  };
  return tastytradeRequest('/watchlists', { method: 'POST', body: JSON.stringify(payload) });
}

/** Update an existing private watchlist (full replace of watchlist-entries). */
export async function updateWatchlist(
  name: string,
  body: { 'watchlist-entries': Array<{ symbol: string; 'instrument-type'?: string }>; 'group-name'?: string; 'order-index'?: number }
): Promise<TastytradeApiResponse<unknown>> {
  const payload = {
    'watchlist-entries': body['watchlist-entries'],
    'group-name': body['group-name'] ?? 'default',
    'order-index': body['order-index'] ?? 9999,
  };
  return tastytradeRequest(`/watchlists/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(payload) });
}

/** Delete a private watchlist by name. */
export async function deleteWatchlist(name: string): Promise<TastytradeApiResponse<unknown>> {
  return tastytradeRequest(`/watchlists/${encodeURIComponent(name)}`, { method: 'DELETE' });
}
