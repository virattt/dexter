import { createHmac } from 'node:crypto';

export type Market = 'spot' | 'futures';

const BASE_URLS: Record<Market, { live: string; testnet: string }> = {
  spot: { live: 'https://api.binance.com', testnet: 'https://testnet.binance.vision' },
  futures: { live: 'https://fapi.binance.com', testnet: 'https://testnet.binancefuture.com' },
};

/** Testnet is the default; live trading requires BINANCE_TESTNET=false explicitly. */
export function isTestnet(): boolean {
  return process.env.BINANCE_TESTNET?.trim().toLowerCase() !== 'false';
}

/** Hard per-order notional cap (USDT) enforced before any order is sent. */
export function maxOrderUsdt(): number {
  const v = Number(process.env.BINANCE_MAX_ORDER_USDT);
  return Number.isFinite(v) && v > 0 ? v : 100;
}

export function hasBinanceKeys(): boolean {
  return Boolean(process.env.BINANCE_API_KEY?.trim() && process.env.BINANCE_API_SECRET?.trim());
}

export function sign(query: string, secret: string): string {
  return createHmac('sha256', secret).update(query).digest('hex');
}

type Params = Record<string, string | number | boolean | undefined>;

export class BinanceError extends Error {
  constructor(public readonly code: number | undefined, message: string) {
    super(`Binance error${code !== undefined ? ` ${code}` : ''}: ${message}`);
  }
}

interface RequestOptions {
  market: Market;
  method?: 'GET' | 'POST' | 'DELETE';
  path: string;
  params?: Params;
  signed?: boolean;
  /** Public market data only: always hit mainnet (testnet history is synthetic/sparse). */
  forceLive?: boolean;
}

export async function binanceRequest<T = unknown>(opts: RequestOptions): Promise<T> {
  const { market, method = 'GET', path, params = {}, signed = false, forceLive = false } = opts;
  const base = BASE_URLS[market][isTestnet() && !forceLive ? 'testnet' : 'live'];

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) search.set(k, String(v));
  }

  const headers: Record<string, string> = {};
  if (signed) {
    const key = process.env.BINANCE_API_KEY?.trim();
    const secret = process.env.BINANCE_API_SECRET?.trim();
    if (!key || !secret) throw new BinanceError(undefined, 'BINANCE_API_KEY / BINANCE_API_SECRET are not set.');
    search.set('timestamp', String(Date.now()));
    search.set('recvWindow', '10000');
    search.set('signature', sign(search.toString(), secret));
    headers['X-MBX-APIKEY'] = key;
  }

  const qs = search.toString();
  const res = await fetch(`${base}${path}${qs ? `?${qs}` : ''}`, { method, headers });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    const e = body as { code?: number; msg?: string };
    throw new BinanceError(e?.code, e?.msg ?? `HTTP ${res.status}`);
  }
  return body as T;
}

// ---------- Market data ----------

const INTERVAL_MS: Record<string, number> = {
  '1m': 60e3,
  '5m': 300e3,
  '15m': 900e3,
  '30m': 1800e3,
  '1h': 3600e3,
  '2h': 7200e3,
  '4h': 14400e3,
  '1d': 86400e3,
  '1w': 604800e3,
};

export function intervalMs(interval: string): number {
  const ms = INTERVAL_MS[interval];
  if (!ms) throw new BinanceError(undefined, `Unsupported interval ${interval}.`);
  return ms;
}

/** Page backwards through mainnet klines (1000/request) to collect `total` candles. */
export async function getKlinesHistory(market: Market, symbol: string, interval: string, total: number): Promise<Candle[]> {
  const path = market === 'spot' ? '/api/v3/klines' : '/fapi/v1/klines';
  const out: Candle[] = [];
  let endTime: number | undefined;
  while (out.length < total) {
    const rows = await binanceRequest<unknown[][]>({
      market,
      path,
      forceLive: true,
      params: { symbol, interval, limit: Math.min(1000, total - out.length), endTime },
    });
    if (rows.length === 0) break;
    out.unshift(
      ...rows.map((r) => ({
        openTime: Number(r[0]),
        open: Number(r[1]),
        high: Number(r[2]),
        low: Number(r[3]),
        close: Number(r[4]),
        volume: Number(r[5]),
      })),
    );
    endTime = Number(rows[0][0]) - 1;
  }
  return out;
}

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getKlines(market: Market, symbol: string, interval: string, limit = 300): Promise<Candle[]> {
  const path = market === 'spot' ? '/api/v3/klines' : '/fapi/v1/klines';
  const rows = await binanceRequest<unknown[][]>({ market, path, params: { symbol, interval, limit } });
  return rows.map((r) => ({
    openTime: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
}

export async function getLastPrice(market: Market, symbol: string): Promise<number> {
  const path = market === 'spot' ? '/api/v3/ticker/price' : '/fapi/v1/ticker/price';
  const r = await binanceRequest<{ price: string }>({ market, path, params: { symbol } });
  return Number(r.price);
}

export interface SymbolRules {
  tickSize: number;
  stepSize: number;
  minQty: number;
  minNotional: number;
}

export async function getSymbolRules(market: Market, symbol: string): Promise<SymbolRules> {
  const path = market === 'spot' ? '/api/v3/exchangeInfo' : '/fapi/v1/exchangeInfo';
  const info = await binanceRequest<{ symbols: Array<{ symbol: string; filters: Array<Record<string, string>> }> }>({
    market,
    path,
    params: market === 'spot' ? { symbol } : undefined,
  });
  const s = info.symbols.find((x) => x.symbol === symbol);
  if (!s) throw new BinanceError(undefined, `Unknown symbol ${symbol} on ${market}.`);
  const f = (type: string) => s.filters.find((x) => x.filterType === type) ?? {};
  return {
    tickSize: Number(f('PRICE_FILTER').tickSize ?? 0.01),
    stepSize: Number(f('LOT_SIZE').stepSize ?? 0.001),
    minQty: Number(f('LOT_SIZE').minQty ?? 0),
    minNotional: Number(f('MIN_NOTIONAL').notional ?? f('NOTIONAL').minNotional ?? f('MIN_NOTIONAL').minNotional ?? 5),
  };
}

/** Round DOWN to a multiple of `step`, returned as a string without float noise. */
export function roundToStep(value: number, step: number): string {
  const decimals = (step.toString().split('.')[1] ?? '').replace(/0+$/, '').length;
  const stepped = Math.floor(value / step + 1e-9) * step;
  return stepped.toFixed(decimals);
}
