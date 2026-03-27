/**
 * Pure calculation helpers for enriched watchlist display.
 * No TUI/pi-tui imports — all functions are testable in isolation.
 */
import type { WatchlistEntry } from './watchlist-controller.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriceSnapshot {
  ticker: string;
  price: number;
  changePercent: number;
  high52Week?: number;
  low52Week?: number;
  marketCap?: number;
  name?: string;
  // For /watchlist show card
  pe?: number;
  pb?: number;
  evEbitda?: number;
  peg?: number;
  analystRating?: string;       // e.g. "buy", "hold", "sell"
  analystAvgTarget?: number;
  news?: NewsItem[];
}

export interface NewsItem {
  title: string;
  date: string;
  source?: string;
}

export interface EnrichedEntry {
  ticker: string;
  shares?: number;
  costBasis?: number;
  addedAt: string;
  price?: number;
  changePercent?: number;
  pnl?: number;
  returnPct?: number;
  currentValue?: number;
  allocPct?: number;
}

export interface PortfolioTotals {
  totalInvested: number;
  totalCurrent: number;
  totalPnl: number;
  totalReturnPct: number;
  positionCount: number;
}

/** Dependency-injected price fetcher — production uses the real API, tests use a mock. */
export type PriceFetcher = (ticker: string) => Promise<PriceSnapshot | null>;

// ---------------------------------------------------------------------------
// Pure calculations
// ---------------------------------------------------------------------------

/**
 * Returns (currentPrice - costBasis) × shares, or undefined if either is missing.
 */
export function calcPnl(entry: WatchlistEntry, price: number): number | undefined {
  if (entry.costBasis === undefined || entry.shares === undefined) return undefined;
  return (price - entry.costBasis) * entry.shares;
}

/**
 * Returns ((price / costBasis) - 1) × 100, or undefined if costBasis is missing/zero.
 */
export function calcReturn(entry: WatchlistEntry, price: number): number | undefined {
  if (entry.costBasis === undefined || entry.costBasis === 0) return undefined;
  return ((price / entry.costBasis) - 1) * 100;
}

/**
 * Aggregates portfolio totals across all entries that have both costBasis and shares
 * and have a matching price in the prices map.
 */
export function calcPortfolioTotals(
  entries: WatchlistEntry[],
  prices: Map<string, PriceSnapshot>,
): PortfolioTotals {
  let totalInvested = 0;
  let totalCurrent = 0;

  for (const e of entries) {
    if (e.costBasis === undefined || e.shares === undefined) continue;
    const snap = prices.get(e.ticker);
    if (!snap) continue;
    totalInvested += e.costBasis * e.shares;
    totalCurrent += snap.price * e.shares;
  }

  const totalPnl = totalCurrent - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalCurrent / totalInvested - 1) * 100 : 0;

  return { totalInvested, totalCurrent, totalPnl, totalReturnPct, positionCount: entries.length };
}

/**
 * Returns a Map<ticker, allocationPct> for entries that have shares and a price.
 * Watch-only tickers (no shares) are excluded from allocation.
 */
export function calcAllocations(
  entries: WatchlistEntry[],
  prices: Map<string, PriceSnapshot>,
  totals: PortfolioTotals,
): Map<string, number> {
  const allocs = new Map<string, number>();
  if (totals.totalCurrent === 0) return allocs;

  for (const e of entries) {
    if (e.shares === undefined) continue;
    const snap = prices.get(e.ticker);
    if (!snap) continue;
    const value = snap.price * e.shares;
    allocs.set(e.ticker, (value / totals.totalCurrent) * 100);
  }
  return allocs;
}

/**
 * Builds enriched entries by merging stored watchlist data with live price snapshots.
 * Entries without a matching price are returned with only their stored fields.
 */
export function buildEnrichedEntries(
  entries: WatchlistEntry[],
  prices: Map<string, PriceSnapshot>,
): EnrichedEntry[] {
  const totals = calcPortfolioTotals(entries, prices);
  const allocs = calcAllocations(entries, prices, totals);

  return entries.map((e) => {
    const snap = prices.get(e.ticker);
    if (!snap) {
      return { ticker: e.ticker, shares: e.shares, costBasis: e.costBasis, addedAt: e.addedAt };
    }

    return {
      ticker: e.ticker,
      shares: e.shares,
      costBasis: e.costBasis,
      addedAt: e.addedAt,
      price: snap.price,
      changePercent: snap.changePercent,
      pnl: calcPnl(e, snap.price),
      returnPct: calcReturn(e, snap.price),
      currentValue: e.shares !== undefined ? snap.price * e.shares : undefined,
      allocPct: allocs.get(e.ticker),
    };
  });
}

// ---------------------------------------------------------------------------
// Snapshot display data (pure — no TUI imports)
// ---------------------------------------------------------------------------

export interface SnapshotDisplayData {
  /** Entries that have cost basis + shares + a live price → fully calculated. */
  positionEntries: EnrichedEntry[];
  /** Entries that have a live price but no cost basis (watch-only). */
  watchOnlyEntries: EnrichedEntry[];
  /** Aggregated portfolio totals (investments, P&L, return %). */
  totals: PortfolioTotals;
  /** True when there is literally nothing to display (no prices at all). */
  hasNoData: boolean;
  /** Best performer by returnPct (or undefined if fewer than 2 positions). */
  best: EnrichedEntry | undefined;
  /** Worst performer by returnPct (or undefined if fewer than 2 positions). */
  worst: EnrichedEntry | undefined;
}

/**
 * Pure helper that separates the data-preparation logic from TUI rendering.
 * Used by buildSnapshotPanel in cli.ts and unit-tested independently.
 */
export function buildSnapshotDisplayData(
  entries: WatchlistEntry[],
  prices: Map<string, PriceSnapshot>,
): SnapshotDisplayData {
  const totals = calcPortfolioTotals(entries, prices);
  const enriched = buildEnrichedEntries(entries, prices);

  const positionEntries = enriched.filter((e) => e.allocPct !== undefined);
  const watchOnlyEntries = enriched.filter(
    (e) => e.allocPct === undefined && e.price !== undefined,
  );

  const ranked = positionEntries
    .filter((e) => e.returnPct !== undefined)
    .sort((a, b) => (b.returnPct ?? 0) - (a.returnPct ?? 0));

  return {
    positionEntries,
    watchOnlyEntries,
    totals,
    hasNoData: positionEntries.length === 0 && watchOnlyEntries.length === 0,
    best:  ranked.length >= 2 ? ranked[0] : undefined,
    worst: ranked.length >= 2 ? ranked[ranked.length - 1] : undefined,
  };
}

/**
 * Renders a proportional ASCII bar for a given percentage.
 * e.g. buildAsciiBar(25, 20) → "█████░░░░░░░░░░░░░░░"
 */
export function buildAsciiBar(pct: number, totalWidth: number): string {
  const filled = Math.round((pct / 100) * totalWidth);
  const empty = totalWidth - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

// ---------------------------------------------------------------------------
// Async price fetching
// ---------------------------------------------------------------------------

/**
 * Fetches prices for all tickers in parallel using the injected fetcher.
 * Tickers that return null or throw are silently skipped (graceful degradation).
 */
export async function fetchLivePrices(
  tickers: string[],
  fetcher: PriceFetcher,
): Promise<Map<string, PriceSnapshot>> {
  const results = await Promise.allSettled(tickers.map((t) => fetcher(t)));
  const map = new Map<string, PriceSnapshot>();

  for (let i = 0; i < tickers.length; i++) {
    const r = results[i]!;
    if (r.status === 'fulfilled' && r.value !== null) {
      map.set(tickers[i]!, r.value);
    }
  }
  return map;
}
