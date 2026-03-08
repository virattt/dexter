/**
 * Finnhub free-tier API for fallback when Financial Datasets is unavailable.
 * PRD: docs/PRD-FINNHUB-SUBAGENTS.md
 * Rate limit: 60 calls/min. Use for get_stock_price, get_stock_prices, get_company_news only.
 */

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const MAX_CONCURRENT = 2;
const RATE_LIMIT_PER_MIN = 60;

function getApiKey(): string | undefined {
  const key = process.env.FINNHUB_API_KEY?.trim();
  return key || undefined;
}

export function hasFinnhubKey(): boolean {
  return !!getApiKey();
}

const semaphore = { active: 0, queue: [] as (() => void)[] };
function acquire(): Promise<void> {
  if (semaphore.active < MAX_CONCURRENT) {
    semaphore.active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    semaphore.queue.push(() => {
      semaphore.active++;
      resolve();
    });
  });
}
function release(): void {
  semaphore.active--;
  const next = semaphore.queue.shift();
  if (next) next();
}

async function fetchFinnhub<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T> {
  const key = getApiKey();
  if (!key) throw new Error('FINNHUB_API_KEY not set');
  const url = new URL(`${FINNHUB_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  url.searchParams.set('token', key);
  await acquire();
  try {
    const res = await fetch(url.toString(), { headers: { 'User-Agent': 'Dexter/1.0' } });
    if (res.status === 429) throw new Error('Finnhub rate limited (429)');
    if (!res.ok) throw new Error(`Finnhub ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    release();
  }
}

/** Finnhub quote: c=current, h,l,o, pc=previous close, t=timestamp */
interface FinnhubQuote {
  c?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
}

/** FD-like snapshot for get_stock_price */
export function normalizeQuoteToSnapshot(
  ticker: string,
  q: FinnhubQuote,
): Record<string, unknown> {
  return {
    ticker,
    open: q.o ?? null,
    high: q.h ?? null,
    low: q.l ?? null,
    close: q.c ?? null,
    previous_close: q.pc ?? null,
    volume: null,
    timestamp: q.t ?? null,
    source: 'finnhub',
  };
}

export async function getQuote(ticker: string): Promise<Record<string, unknown>> {
  const q = await fetchFinnhub<FinnhubQuote>('/quote', { symbol: ticker });
  return normalizeQuoteToSnapshot(ticker, q);
}

/** Finnhub candle: o,h,l,c,v,t arrays (same length) */
interface FinnhubCandle {
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
  v?: number[];
  t?: number[];
  s?: string;
}

/** FD-like prices array for get_stock_prices */
export function normalizeCandlesToPrices(
  ticker: string,
  c: FinnhubCandle,
): Record<string, unknown>[] {
  const len = c.t?.length ?? 0;
  if (len === 0) return [];
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < len; i++) {
    const ts = c.t![i];
    const date = ts ? new Date(ts * 1000).toISOString().slice(0, 10) : '';
    out.push({
      ticker,
      date,
      open: c.o?.[i] ?? null,
      high: c.h?.[i] ?? null,
      low: c.l?.[i] ?? null,
      close: c.c?.[i] ?? null,
      volume: c.v?.[i] ?? null,
      source: 'finnhub',
    });
  }
  return out;
}

export async function getCandles(
  ticker: string,
  resolution: 'D' | 'W' | 'M',
  from: string,
  to: string,
): Promise<Record<string, unknown>[]> {
  const fromUnix = Math.floor(new Date(from + 'T00:00:00Z').getTime() / 1000);
  const toUnix = Math.ceil(new Date(to + 'T23:59:59Z').getTime() / 1000);
  const c = await fetchFinnhub<FinnhubCandle>('/stock/candle', {
    symbol: ticker,
    resolution,
    from: fromUnix,
    to: toUnix,
  });
  if (c.s === 'no_data') return [];
  return normalizeCandlesToPrices(ticker, c);
}

/** Finnhub company-news item */
interface FinnhubNewsItem {
  headline?: string;
  source?: string;
  url?: string;
  summary?: string;
  datetime?: number;
}

/** FD-like news item */
function normalizeNewsItem(item: FinnhubNewsItem): Record<string, unknown> {
  const date = item.datetime
    ? new Date(item.datetime * 1000).toISOString().slice(0, 10)
    : null;
  return {
    title: item.headline ?? '',
    source: item.source ?? '',
    url: item.url ?? '',
    summary: item.summary ?? '',
    published_at: date,
    source_provider: 'finnhub',
  };
}

export async function getCompanyNews(
  ticker: string,
  from: string,
  to: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const data = await fetchFinnhub<FinnhubNewsItem[]>('/company-news', {
    symbol: ticker,
    from,
    to,
  });
  const items = Array.isArray(data) ? data.slice(0, limit) : [];
  return items.map(normalizeNewsItem);
}

/**
 * True if the error is from FD and is retryable with a fallback (network, 429, 4xx/5xx, or missing key).
 */
export function isFdRetryableWithFallback(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('Financial Datasets API') || msg.includes('request failed')) {
    if (msg.includes('network error') || msg.includes('429')) return true;
    if (/\b[45]\d{2}\b/.test(msg)) return true;
  }
  return false;
}
