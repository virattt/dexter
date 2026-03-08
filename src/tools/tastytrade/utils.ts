import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { tastytradeRequest } from './api.js';
import { getPositions, getBalances } from './api.js';
import { writePortfolioContent } from '../portfolio/portfolio-tool.js';
import { isKnownHLSymbol } from '../hyperliquid/hl-fd-mapping.js';

const DEXTER_DIR = join(homedir(), '.dexter');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _positionsCache: { accountNumber: string; data: unknown; ts: number } | null = null;
let _balancesCache: { accountNumber: string; data: unknown; ts: number } | null = null;
let _sessionSynced = false;

export function invalidateTastytradeCache(): void {
  _positionsCache = null;
  _balancesCache = null;
  _sessionSynced = false;
}

export async function getCachedPositions(accountNumber: string): Promise<unknown> {
  if (_positionsCache && _positionsCache.accountNumber === accountNumber && Date.now() - _positionsCache.ts < CACHE_TTL_MS) {
    return _positionsCache.data;
  }
  const res = await getPositions(accountNumber);
  _positionsCache = { accountNumber, data: res.data, ts: Date.now() };
  return res.data;
}

export async function getCachedBalances(accountNumber: string): Promise<unknown> {
  if (_balancesCache && _balancesCache.accountNumber === accountNumber && Date.now() - _balancesCache.ts < CACHE_TTL_MS) {
    return _balancesCache.data;
  }
  const res = await getBalances(accountNumber);
  _balancesCache = { accountNumber, data: res.data, ts: Date.now() };
  return res.data;
}

/**
 * On first tastytrade broker query in a session, sync positions and balances to PORTFOLIO.md.
 * Call at the start of positions, balances, and theta_scan tools.
 */
export async function ensureSessionSync(): Promise<void> {
  if (_sessionSynced) return;
  const acc = await getFirstAccountNumber();
  if (!acc) return;
  try {
    const [posRes, balRes] = await Promise.all([getPositions(acc), getBalances(acc)]);
    const positions = normalizePositions(posRes.data);
    const totalEquity = totalEquityFromBalances(balRes.data);
    const byTicker = new Map<string, { quantity: number; value: number }>();
    for (const p of positions) {
      const ticker = p.underlying !== '—' ? p.underlying : p.symbol.split(/\s+/)[0] ?? p.symbol;
      if (!ticker) continue;
      const prev = byTicker.get(ticker) ?? { quantity: 0, value: 0 };
      byTicker.set(ticker, { quantity: prev.quantity + p.quantity, value: prev.value + p.value });
    }
    const rows: { ticker: string; weight: number }[] = [];
    for (const [ticker, { value }] of byTicker.entries()) {
      const weight = totalEquity > 0 ? (value / totalEquity) * 100 : 0;
      rows.push({ ticker, weight });
    }
    rows.sort((a, b) => b.weight - a.weight);
    const portfolioPath = join(DEXTER_DIR, 'PORTFOLIO.md');
    const hasDualColumn =
      existsSync(portfolioPath) &&
      (readFileSync(portfolioPath, 'utf-8').split('\n')[0] ?? '').toLowerCase().includes('target');
    if (hasDualColumn) {
      _sessionSynced = true;
      return;
    }
    const header = '| Ticker | Weight | Layer | Tier |';
    const sep = '| --- | --- | --- | --- |';
    const body = rows.map((r) => `| ${r.ticker} | ${r.weight.toFixed(2)}% | — | — |`).join('\n');
    const markdown = [header, sep, body].join('\n');
    writePortfolioContent('default', markdown);
    _sessionSynced = true;
  } catch {
    // Non-fatal; tools will still work
  }
}

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

/**
 * Validate an order (or roll) against THETA-POLICY: allowed underlyings, no-call list, DTE range.
 * Used by strategy_preview, roll_short_option, and repair_position.
 */
export function validateOrderAgainstPolicy(params: {
  underlyings: string[];
  legs: Array<{ underlying: string; option_type: 'C' | 'P' | null; action: string; dte: number | null }>;
  policy: ThetaPolicy;
}): { allowed: boolean; violations: string[] } {
  const { underlyings, legs, policy } = params;
  const violations: string[] = [];
  const allowedSet = new Set(policy.allowedUnderlyings.map((u) => u.toUpperCase()));
  const noCallSet = new Set(policy.noCallList.map((u) => u.toUpperCase()));
  for (const u of underlyings) {
    if (u === '—') continue;
    const up = u.toUpperCase();
    if (isTickerTradableOnHyperliquid(u)) {
      violations.push(`${u} is tradable on Hyperliquid; tastytrade sleeve must have zero overlap with HL.`);
    }
    if (!allowedSet.has(up)) {
      violations.push(`Underlying ${u} is not in THETA-POLICY allowed underlyings.`);
    }
    const hasShortCall = legs.some(
      (leg) => leg.underlying.toUpperCase() === up && leg.option_type === 'C' && leg.action === 'Sell to Open'
    );
    if (hasShortCall && noCallSet.has(up)) {
      violations.push(`${u} is on the no-call list; selling calls is not allowed.`);
    }
  }
  for (const leg of legs) {
    if (leg.dte != null) {
      if (leg.dte < policy.minDte)
        violations.push(`Leg ${leg.underlying} DTE ${leg.dte} is below policy min DTE ${policy.minDte}.`);
      if (leg.dte > policy.maxDte)
        violations.push(`Leg ${leg.underlying} DTE ${leg.dte} exceeds policy max DTE ${policy.maxDte}.`);
    }
  }
  return { allowed: violations.length === 0, violations };
}

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
  const obj = data as { data?: unknown; items?: unknown[] };
  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.data)) return obj.data;
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    const inner = obj.data as { items?: unknown[] };
    if (Array.isArray(inner.items)) return inner.items;
  }
  return [];
}

export function extractFirstObject(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  const arr = extractDataArray(data);
  const first = arr[0];
  if (first && typeof first === 'object' && !Array.isArray(first)) return first as Record<string, unknown>;
  if (arr.length > 0) return null;
  if (typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      return obj.data as Record<string, unknown>;
    }
  }
  return null;
}

export function extractNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getFirstAccountNumber(): Promise<string | null> {
  const accountsRes = await tastytradeRequest<unknown>('/customers/me/accounts');
  const items = extractDataArray(accountsRes.data);
  const first = items[0] as { account?: { 'account-number'?: string }; 'account-number'?: string } | undefined;
  return first?.account?.['account-number'] ?? first?.['account-number'] ?? null;
}

export function normalizeUnderlyingTicker(symbol: string): string {
  const s = (symbol ?? '').trim();
  if (!s) return '—';
  const spaced = s.split(/\s+/)[0];
  if (spaced) return spaced.toUpperCase();
  return s.toUpperCase();
}

/** Policy violation reason when an underlying is tradable on Hyperliquid (zero-overlap rule). */
export const HL_OVERLAP_VIOLATION_REASON = 'hl_overlap_universe' as const;

/**
 * True if the ticker (normalized) is tradable on Hyperliquid.
 * Used to enforce zero overlap: tastytrade sleeve must not contain HL-tradable assets.
 */
export function isTickerTradableOnHyperliquid(ticker: string): boolean {
  const normalized = normalizeUnderlyingTicker(ticker);
  if (normalized === '—') return false;
  return isKnownHLSymbol(normalized);
}

/**
 * Check whether a ticker violates the zero-overlap rule (tastytrade vs Hyperliquid).
 * Returns { overlap: true, reason: 'hl_overlap_universe' } when the ticker is tradable on HL.
 */
export function checkHyperliquidOverlap(ticker: string): { overlap: boolean; reason?: string } {
  if (isTickerTradableOnHyperliquid(ticker)) {
    return { overlap: true, reason: HL_OVERLAP_VIOLATION_REASON };
  }
  return { overlap: false };
}

/**
 * Filter a list of underlyings to only those not tradable on Hyperliquid.
 * Used for theta policy defaults and scan universe.
 */
export function filterOutHyperliquidTickers(tickers: string[]): string[] {
  return tickers.filter((t) => !isTickerTradableOnHyperliquid(t));
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
  // Fallback defaults when no ~/.dexter/THETA-POLICY.md is present.
  // Underlyings are SOUL thesis names with liquid US equity options on tastytrade,
  // excluding any symbol tradable on Hyperliquid (zero-overlap rule).
  // HL-tradable names (AAPL, AMD, MU, PLTR, MSFT, AMZN, META, COIN, etc.) are excluded.
  const allowedCandidates = [
    'AAPL', 'AMD', 'AVGO', 'TSM', 'AMAT', 'ASML', 'LRCX', 'KLAC',
    'VRT', 'CEG', 'MU', 'ANET', 'PLTR', 'MSFT', 'AMZN', 'META', 'COIN',
  ];
  const defaults: ThetaPolicy = {
    source: 'default',
    path: THETA_POLICY_PATH,
    allowedUnderlyings: filterOutHyperliquidTickers(allowedCandidates),
    // Core Compounders from SOUL.md: block covered calls so they can't be called away.
    // Puts and spreads remain valid for entering/sizing positions.
    noCallList: ['TSM', 'ASML', 'AMAT', 'LRCX', 'KLAC', 'SNPS', 'CDNS', 'ANET', 'CEG'],
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
  const underlying = normalizeUnderlyingTicker(params.underlying);
  const { soulCoreOrAvoidTickers, portfolioTargetWeightByTicker } = params;
  const inSoul = soulCoreOrAvoidTickers.some((t) => normalizeUnderlyingTicker(t) === underlying);
  const target = params.targetWeightPct ?? portfolioTargetWeightByTicker.get(underlying);

  if (inSoul && params.isShortCall) {
    return { result: 'block', reason: `${underlying} is in SOUL.md Core/Avoid; avoid selling calls.` };
  }
  if (inSoul) {
    return { result: 'warn', reason: `${underlying} is in SOUL.md Core/Avoid; confirm before selling premium.` };
  }
  // When exposure estimate is missing/zero we skip the projected check (deterministic: no false block).
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
      const targetIdx = headerCells.indexOf('target');
      const weightIdx = headerCells.indexOf('weight');
      const weightCol = targetIdx >= 0 ? targetIdx : weightIdx;
      if (tickerIdx >= 0 && weightCol >= 0) {
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split('|').map((s) => s.trim());
          if (cells.some((c) => c === '---')) continue;
          const ticker = cells[tickerIdx]?.replace(/%$/, '').trim().toUpperCase();
          const weightStr = (cells[weightCol] ?? '').replace(/%$/, '').trim();
          if (ticker && weightStr !== '—' && weightStr !== '') {
            const weight = Number(weightStr);
            if (Number.isFinite(weight)) portfolioTargetWeightByTicker.set(ticker, weight);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return { soulCoreOrAvoidTickers, portfolioTargetWeightByTicker };
}
