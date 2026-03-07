import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { tastytradeRequest } from './api.js';

const THETA_POLICY_PATH = join(homedir(), '.dexter', 'THETA-POLICY.md');

export type ThetaPolicy = {
  source: 'default' | 'file';
  path: string;
  allowedUnderlyings: string[];
  noCallList: string[];
  shortDeltaMin: number;
  shortDeltaMax: number;
  minDte: number;
  maxDte: number;
  maxRiskPerTradePct: number;
  maxBuyingPowerUsagePct: number;
  excludeEarningsDays: number;
};

export type NormalizedOptionSymbol = {
  rawSymbol: string;
  underlying: string;
  optionType: 'C' | 'P' | null;
  strike: number | null;
  expirationDate: string | null;
  dte: number | null;
};

export type NormalizedPosition = {
  symbol: string;
  underlying: string;
  instrumentType: string;
  quantity: number;
  side: 'long' | 'short';
  mark: number;
  value: number;
  averageOpenPrice: number;
  strike: number | null;
  optionType: 'C' | 'P' | null;
  expirationDate: string | null;
  dte: number | null;
  delta: number | null;
  theta: number | null;
  gamma: number | null;
  vega: number | null;
};

export function extractDataArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const obj = data as { data?: unknown[]; items?: unknown[] };
  return obj.data ?? obj.items ?? [];
}

export function extractFirstObject(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  if (typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>;
  const first = extractDataArray(data)[0];
  return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
}

export function extractNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getFirstAccountNumber(): Promise<string | null> {
  const accountsRes = await tastytradeRequest<unknown>('/customers/me/accounts');
  const first = extractDataArray(accountsRes.data)[0] as { 'account-number'?: string } | undefined;
  return first?.['account-number'] ?? null;
}

export function normalizeUnderlyingTicker(symbol: string): string {
  const s = (symbol ?? '').trim();
  if (!s) return '—';
  const spaced = s.split(/\s+/)[0];
  if (spaced) return spaced.toUpperCase();
  return s.toUpperCase();
}

export function parseOptionSymbol(symbol: string): NormalizedOptionSymbol {
  const raw = (symbol ?? '').trim().toUpperCase();
  if (!raw) {
    return {
      rawSymbol: '',
      underlying: '—',
      optionType: null,
      strike: null,
      expirationDate: null,
      dte: null,
    };
  }

  const spacedParts = raw.split(/\s+/);
  const spacedBody = spacedParts.length >= 2 ? spacedParts[1] : null;
  const spacedMatch = spacedBody?.match(/^(\d{6})([CP])(\d{8})$/);
  const compactMatch = raw.match(/^([A-Z.\-]{1,10})(\d{6})([CP])(\d{8})$/);

  let underlying = normalizeUnderlyingTicker(raw);
  let expirationDate: string | null = null;
  let dte: number | null = null;
  let optionType: 'C' | 'P' | null = null;
  let strike: number | null = null;

  if (spacedMatch) {
    underlying = spacedParts[0];
    const [, yymmdd, cp, strikeRaw] = spacedMatch;
    expirationDate = formatExpiration(yymmdd);
    dte = daysToExpiration(expirationDate);
    optionType = cp as 'C' | 'P';
    strike = Number(strikeRaw) / 1000;
  } else if (compactMatch) {
    const [, root, yymmdd, cp, strikeRaw] = compactMatch;
    underlying = root;
    expirationDate = formatExpiration(yymmdd);
    dte = daysToExpiration(expirationDate);
    optionType = cp as 'C' | 'P';
    strike = Number(strikeRaw) / 1000;
  }

  return {
    rawSymbol: raw,
    underlying,
    optionType,
    strike,
    expirationDate,
    dte,
  };
}

function formatExpiration(yymmdd: string): string {
  const yy = yymmdd.slice(0, 2);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  return `20${yy}-${mm}-${dd}`;
}

function daysToExpiration(expirationDate: string | null): number | null {
  if (!expirationDate) return null;
  const expiry = new Date(`${expirationDate}T16:00:00Z`).getTime();
  if (Number.isNaN(expiry)) return null;
  const diff = expiry - Date.now();
  return Math.max(0, Math.round(diff / (24 * 60 * 60 * 1000)));
}

export function normalizePositions(data: unknown): NormalizedPosition[] {
  return extractDataArray(data)
    .map((entry) => {
      const pos = entry as Record<string, unknown>;
      const rawSymbol =
        (pos.symbol ?? pos['instrument-symbol'] ?? pos['underlying-symbol'] ?? pos.underlying_symbol ?? '') as string;
      const parsed = parseOptionSymbol(rawSymbol);
      const quantity = extractNumber(pos.quantity ?? pos['quantity-direction'] ?? pos['quantity']);
      const side = quantity < 0 ? 'short' : 'long';
      const value = extractNumber(
        pos.equity ?? pos['market-value'] ?? pos.market_value ?? pos.value ?? pos.mark_price ?? pos.mark
      );
      const mark = extractNumber(pos.mark ?? pos.mark_price ?? pos['mark-price'] ?? pos.average_price);
      return {
        symbol: rawSymbol,
        underlying: parsed.underlying,
        instrumentType: String(pos['instrument-type'] ?? pos.instrument_type ?? (parsed.optionType ? 'Equity Option' : 'Equity')),
        quantity,
        side,
        mark,
        value,
        averageOpenPrice: extractNumber(pos['average-open-price'] ?? pos.average_open_price ?? pos.average_price),
        strike: parsed.strike,
        optionType: parsed.optionType,
        expirationDate: parsed.expirationDate,
        dte: parsed.dte,
        delta: valueOrNull(pos.delta),
        theta: valueOrNull(pos.theta),
        gamma: valueOrNull(pos.gamma),
        vega: valueOrNull(pos.vega),
      } satisfies NormalizedPosition;
    })
    .filter((position) => position.symbol);
}

function valueOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function totalEquityFromBalances(data: unknown): number {
  const item = extractFirstObject(data);
  if (!item) return 0;
  return extractNumber(
    item.net_liquidating_value ?? item['net-liquidating-value'] ?? item.equity ?? item.account_value
  );
}

export function availableBuyingPowerFromBalances(data: unknown): number {
  const item = extractFirstObject(data);
  if (!item) return 0;
  return extractNumber(
    item.derivative_buying_power ?? item['derivative-buying-power'] ?? item.buying_power ?? item['buying-power']
  );
}

export function loadThetaPolicy(): ThetaPolicy {
  const defaults: ThetaPolicy = {
    source: 'default',
    path: THETA_POLICY_PATH,
    allowedUnderlyings: ['SPX', 'SPY', 'QQQ', 'IWM'],
    noCallList: [],
    shortDeltaMin: 0.1,
    shortDeltaMax: 0.2,
    minDte: 0,
    maxDte: 45,
    maxRiskPerTradePct: 0.03,
    maxBuyingPowerUsagePct: 0.5,
    excludeEarningsDays: 2,
  };

  if (!existsSync(THETA_POLICY_PATH)) return defaults;

  try {
    const content = readFileSync(THETA_POLICY_PATH, 'utf-8');
    return {
      ...defaults,
      source: 'file',
      allowedUnderlyings: parseCsvLine(content, /allowed underlyings?\s*:\s*(.+)/i) ?? defaults.allowedUnderlyings,
      noCallList: parseCsvLine(content, /(no-call list|no calls?)\s*:\s*(.+)/i, 2) ?? defaults.noCallList,
      shortDeltaMin: parseRange(content, /short delta range\s*:\s*([0-9.]+)\s*-\s*([0-9.]+)/i)?.[0] ?? defaults.shortDeltaMin,
      shortDeltaMax: parseRange(content, /short delta range\s*:\s*([0-9.]+)\s*-\s*([0-9.]+)/i)?.[1] ?? defaults.shortDeltaMax,
      minDte: parseRange(content, /dte range\s*:\s*([0-9.]+)\s*-\s*([0-9.]+)/i)?.[0] ?? defaults.minDte,
      maxDte: parseRange(content, /dte range\s*:\s*([0-9.]+)\s*-\s*([0-9.]+)/i)?.[1] ?? defaults.maxDte,
      maxRiskPerTradePct:
        parsePercent(content, /max risk per trade\s*:\s*([0-9.]+)\s*%?/i) ?? defaults.maxRiskPerTradePct,
      maxBuyingPowerUsagePct:
        parsePercent(content, /max buying power usage\s*:\s*([0-9.]+)\s*%?/i) ?? defaults.maxBuyingPowerUsagePct,
      excludeEarningsDays:
        parseNumber(content, /exclude earnings days\s*:\s*([0-9.]+)/i) ?? defaults.excludeEarningsDays,
    };
  } catch {
    return defaults;
  }
}

function parseCsvLine(content: string, pattern: RegExp, valueGroup = 1): string[] | null {
  const match = content.match(pattern);
  if (!match?.[valueGroup]) return null;
  return match[valueGroup]
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
}

function parseRange(content: string, pattern: RegExp): [number, number] | null {
  const match = content.match(pattern);
  if (!match?.[1] || !match?.[2]) return null;
  return [extractNumber(match[1]), extractNumber(match[2])];
}

function parsePercent(content: string, pattern: RegExp): number | null {
  const value = parseNumber(content, pattern);
  if (value == null) return null;
  return value > 1 ? value / 100 : value;
}

function parseNumber(content: string, pattern: RegExp): number | null {
  const match = content.match(pattern);
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}
