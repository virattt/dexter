import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { tastytradeRequest } from './api.js';

const DEXTER_DIR = join(homedir(), '.dexter');
const THETA_POLICY_PATH = join(DEXTER_DIR, 'THETA-POLICY.md');
const SOUL_PATH = join(DEXTER_DIR, 'SOUL.md');
const PORTFOLIO_MD_PATH = join(DEXTER_DIR, 'PORTFOLIO.md');

export interface SoulPortfolioContext {
  soulCoreOrAvoidTickers: string[];
  portfolioTargetWeightByTicker: Map<string, number>;
}

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
  const arr = extractDataArray(data);
  const first = arr[0];
  if (first && typeof first === 'object' && !Array.isArray(first)) return first as Record<string, unknown>;
  if (arr.length === 0 && typeof data === 'object' && !Array.isArray(data)) return null;
  if (typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>;
  return null;
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

const FINANCIAL_DATASETS_BASE = 'https://api.financialdatasets.ai';

/**
 * Fetch upcoming earnings-related dates for a ticker (e.g. next fiscal period end or report date).
 * Uses Financial Datasets /analyst-estimates/ fiscal_period as a proxy when FINANCIAL_DATASETS_API_KEY is set.
 * Returns empty array if no key, ticker is an index, or parse fails.
 */
export async function getUpcomingEarningsDates(ticker: string): Promise<Date[]> {
  const apiKey = process.env.FINANCIAL_DATASETS_API_KEY;
  if (!apiKey?.trim()) return [];

  const url = `${FINANCIAL_DATASETS_BASE}/analyst-estimates/?ticker=${encodeURIComponent(ticker)}&period=quarterly`;
  try {
    const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
    if (!res.ok) return [];
    const data = (await res.json()) as { analyst_estimates?: Array<{ fiscal_period?: string }> };
    const estimates = data.analyst_estimates ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates: Date[] = [];
    for (const item of estimates) {
      const period = item.fiscal_period;
      if (!period || typeof period !== 'string') continue;
      const d = new Date(period);
      if (!Number.isFinite(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      if (d >= today) dates.push(d);
    }
    dates.sort((a, b) => a.getTime() - b.getTime());
    return dates.slice(0, 4);
  } catch {
    return [];
  }
}

/**
 * True if the ticker has an earnings (or fiscal period) date within windowDays of today.
 * Used to exclude underlyings from theta scan when policy requests earnings exclusion.
 */
export async function hasEarningsInWindow(ticker: string, windowDays: number): Promise<boolean> {
  if (windowDays <= 0) return false;
  const dates = await getUpcomingEarningsDates(ticker);
  if (dates.length === 0) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  for (const d of dates) {
    const dist = Math.abs(d.getTime() - today.getTime());
    if (dist <= windowMs) return true;
  }
  return false;
}

export type PortfolioFitResult = 'pass' | 'warn' | 'block';

/**
 * Compute a hard portfolio-fit result for a theta candidate or preview.
 * block: e.g. selling calls on SOUL Core/Avoid tickers.
 * warn: short premium on Core/Avoid (confirm), or trade would push exposure above target.
 * pass: within policy and no conflict.
 */
export function computePortfolioFit(params: {
  underlying: string;
  soulCoreOrAvoidTickers: string[];
  portfolioTargetWeightByTicker: Map<string, number>;
  currentWeightPct?: number;
  tradeExposurePct?: number;
  targetWeightPct?: number;
  isShortCall?: boolean;
}): { result: PortfolioFitResult; reason: string } {
  const { underlying, soulCoreOrAvoidTickers, portfolioTargetWeightByTicker } = params;
  const inSoul = soulCoreOrAvoidTickers.includes(underlying);
  const target = params.targetWeightPct ?? portfolioTargetWeightByTicker.get(underlying);

  if (inSoul && params.isShortCall) {
    return { result: 'block', reason: `${underlying} is in SOUL.md Core/Avoid; avoid selling calls.` };
  }
  if (inSoul) {
    return { result: 'warn', reason: `${underlying} is in SOUL.md Core/Avoid; confirm before selling premium.` };
  }
  if (target != null && params.currentWeightPct != null && params.tradeExposurePct != null) {
    const projected = params.currentWeightPct + params.tradeExposurePct;
    if (projected > target * 1.05) {
      return {
        result: 'warn',
        reason: `Projected ${underlying} exposure ${projected.toFixed(1)}% would exceed PORTFOLIO target ${target}%.`,
      };
    }
  }
  if (target != null) {
    return { result: 'pass', reason: `PORTFOLIO.md target for ${underlying}: ${target}%.` };
  }
  return { result: 'pass', reason: 'No SOUL/PORTFOLIO constraint for this ticker.' };
}

/** Load SOUL.md and PORTFOLIO.md for portfolio-aware theta checks. Returns tickers to avoid (core/avoid) and target weights from PORTFOLIO.md. */
export function loadSoulPortfolioContext(): SoulPortfolioContext {
  const soulCoreOrAvoidTickers: string[] = [];
  const portfolioTargetWeightByTicker = new Map<string, number>();

  if (existsSync(SOUL_PATH)) {
    try {
      const soul = readFileSync(SOUL_PATH, 'utf-8');
      const coreSection = soul.match(/Core Compounders[\s\S]*?(?=^##|\n\n\n|$)/im);
      const avoidSection = soul.match(/Avoid[^\n]*[\s\S]*?(?=^##|\n\n\n|$)/im);
      const sections = [coreSection?.[0] ?? '', avoidSection?.[0] ?? ''].join('\n');
      const bulletLines = sections.split('\n').filter((l) => /^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l));
      const tickerLike = /\b([A-Z]{2,5})\b/g;
      for (const line of bulletLines) {
        let m: RegExpExecArray | null;
        while ((m = tickerLike.exec(line)) !== null) {
          const t = m[1];
          if (!soulCoreOrAvoidTickers.includes(t)) soulCoreOrAvoidTickers.push(t);
        }
      }
    } catch {
      // ignore
    }
  }

  if (existsSync(PORTFOLIO_MD_PATH)) {
    try {
      const content = readFileSync(PORTFOLIO_MD_PATH, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim().startsWith('|'));
      const headerCells = lines[0]?.split('|').map((s) => s.trim().toLowerCase()) ?? [];
      const tickerIdx = headerCells.indexOf('ticker');
      const weightIdx = headerCells.indexOf('weight');
      if (tickerIdx >= 0 && weightIdx >= 0) {
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split('|').map((s) => s.trim());
          if (cells.some((c) => c === '---')) continue;
          const ticker = cells[tickerIdx]?.replace(/%$/, '').trim().toUpperCase();
          const weightStr = cells[weightIdx]?.replace(/%$/, '').trim();
          const weight = Number(weightStr);
          if (ticker && Number.isFinite(weight)) portfolioTargetWeightByTicker.set(ticker, weight);
        }
      }
    } catch {
      // ignore
    }
  }

  return { soulCoreOrAvoidTickers, portfolioTargetWeightByTicker };
}
