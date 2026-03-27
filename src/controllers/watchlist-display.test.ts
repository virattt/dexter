/**
 * Tests for watchlist display calculation helpers.
 * All pure functions — no I/O, no API calls.
 */
import { describe, expect, it } from 'bun:test';
import {
  buildAsciiBar,
  buildEnrichedEntries,
  calcAllocations,
  calcPnl,
  calcPortfolioTotals,
  calcReturn,
  fetchLivePrices,
} from './watchlist-display.js';
import type { PriceSnapshot } from './watchlist-display.js';
import type { WatchlistEntry } from './watchlist-controller.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeEntry = (ticker: string, costBasis?: number, shares?: number): WatchlistEntry => ({
  ticker,
  costBasis,
  shares,
  addedAt: '2026-03-01',
});

const makeSnap = (ticker: string, price: number, changePercent: number): PriceSnapshot => ({
  ticker,
  price,
  changePercent,
});

// ---------------------------------------------------------------------------
// calcPnl()
// ---------------------------------------------------------------------------
describe('calcPnl()', () => {
  it('returns (price - costBasis) × shares for a gain', () => {
    expect(calcPnl(makeEntry('AAPL', 150, 10), 160)).toBe(100);
  });

  it('returns negative value when price < costBasis', () => {
    expect(calcPnl(makeEntry('AAPL', 200, 10), 180)).toBe(-200);
  });

  it('returns undefined when costBasis is missing', () => {
    expect(calcPnl(makeEntry('AAPL', undefined, 10), 160)).toBeUndefined();
  });

  it('returns undefined when shares is missing', () => {
    expect(calcPnl(makeEntry('AAPL', 150, undefined), 160)).toBeUndefined();
  });

  it('returns zero when price equals costBasis', () => {
    expect(calcPnl(makeEntry('AAPL', 100, 10), 100)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calcReturn()
// ---------------------------------------------------------------------------
describe('calcReturn()', () => {
  it('returns correct percentage for a gain', () => {
    expect(calcReturn(makeEntry('AAPL', 100, 10), 150)).toBeCloseTo(50, 5);
  });

  it('returns negative percentage for a loss', () => {
    expect(calcReturn(makeEntry('AAPL', 200, 10), 150)).toBeCloseTo(-25, 5);
  });

  it('returns undefined when costBasis is missing', () => {
    expect(calcReturn(makeEntry('AAPL', undefined, 10), 150)).toBeUndefined();
  });

  it('returns undefined when costBasis is zero (avoid division by zero)', () => {
    expect(calcReturn(makeEntry('AAPL', 0, 10), 150)).toBeUndefined();
  });

  it('returns 0 when price equals costBasis', () => {
    expect(calcReturn(makeEntry('AAPL', 100, 10), 100)).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// calcPortfolioTotals()
// ---------------------------------------------------------------------------
describe('calcPortfolioTotals()', () => {
  it('computes totals across multiple fully-defined positions', () => {
    const entries = [makeEntry('AAPL', 100, 10), makeEntry('MSFT', 200, 5)];
    const prices = new Map([
      ['AAPL', makeSnap('AAPL', 120, 1)],
      ['MSFT', makeSnap('MSFT', 250, 2)],
    ]);
    const t = calcPortfolioTotals(entries, prices);
    expect(t.totalInvested).toBe(2000); // 100*10 + 200*5
    expect(t.totalCurrent).toBe(2450);  // 120*10 + 250*5
    expect(t.totalPnl).toBe(450);
    expect(t.totalReturnPct).toBeCloseTo(22.5, 4);
    expect(t.positionCount).toBe(2);
  });

  it('skips watch-only entries (no costBasis or shares)', () => {
    const entries = [makeEntry('AAPL'), makeEntry('MSFT', 200, 5)];
    const prices = new Map([
      ['AAPL', makeSnap('AAPL', 120, 1)],
      ['MSFT', makeSnap('MSFT', 250, 2)],
    ]);
    const t = calcPortfolioTotals(entries, prices);
    expect(t.totalInvested).toBe(1000); // only MSFT
    expect(t.totalCurrent).toBe(1250);
  });

  it('skips entries whose ticker has no price data', () => {
    const entries = [makeEntry('AAPL', 100, 10)];
    const prices = new Map<string, PriceSnapshot>();
    const t = calcPortfolioTotals(entries, prices);
    expect(t.totalInvested).toBe(0);
    expect(t.totalCurrent).toBe(0);
    expect(t.totalReturnPct).toBe(0);
  });

  it('returns zero totalReturnPct when totalInvested is 0', () => {
    const t = calcPortfolioTotals([], new Map());
    expect(t.totalReturnPct).toBe(0);
  });

  it('positionCount reflects total watchlist size including watch-only', () => {
    const entries = [makeEntry('AAPL'), makeEntry('MSFT', 100, 5)];
    const t = calcPortfolioTotals(entries, new Map());
    expect(t.positionCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// calcAllocations()
// ---------------------------------------------------------------------------
describe('calcAllocations()', () => {
  it('returns correct allocation percentages summing to 100', () => {
    const entries = [makeEntry('AAPL', 100, 10), makeEntry('MSFT', 100, 10)];
    const prices = new Map([
      ['AAPL', makeSnap('AAPL', 100, 0)],
      ['MSFT', makeSnap('MSFT', 300, 0)],
    ]);
    const totals = calcPortfolioTotals(entries, prices);
    const allocs = calcAllocations(entries, prices, totals);
    expect(allocs.get('AAPL')).toBeCloseTo(25, 4);
    expect(allocs.get('MSFT')).toBeCloseTo(75, 4);
  });

  it('excludes watch-only tickers (no shares) from allocation', () => {
    const entries = [makeEntry('AAPL'), makeEntry('MSFT', 100, 10)];
    const prices = new Map([
      ['AAPL', makeSnap('AAPL', 200, 0)],
      ['MSFT', makeSnap('MSFT', 100, 0)],
    ]);
    const totals = calcPortfolioTotals(entries, prices);
    const allocs = calcAllocations(entries, prices, totals);
    expect(allocs.has('AAPL')).toBe(false);
    expect(allocs.get('MSFT')).toBeCloseTo(100, 4);
  });

  it('returns empty map when totals.totalCurrent is 0', () => {
    const entries = [makeEntry('AAPL', 100, 10)];
    const prices = new Map<string, PriceSnapshot>();
    const totals = calcPortfolioTotals(entries, prices);
    const allocs = calcAllocations(entries, prices, totals);
    expect(allocs.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildEnrichedEntries()
// ---------------------------------------------------------------------------
describe('buildEnrichedEntries()', () => {
  it('enriches a position entry with all calculated fields', () => {
    const entries = [makeEntry('AAPL', 100, 10)];
    const prices = new Map([['AAPL', makeSnap('AAPL', 150, 1.5)]]);
    const enriched = buildEnrichedEntries(entries, prices);

    expect(enriched[0]!.price).toBe(150);
    expect(enriched[0]!.changePercent).toBe(1.5);
    expect(enriched[0]!.pnl).toBe(500);
    expect(enriched[0]!.returnPct).toBeCloseTo(50, 4);
    expect(enriched[0]!.currentValue).toBe(1500);
  });

  it('returns entry with no enriched fields when ticker not in prices map', () => {
    const entries = [makeEntry('AAPL', 100, 10)];
    const prices = new Map<string, PriceSnapshot>();
    const enriched = buildEnrichedEntries(entries, prices);

    expect(enriched[0]!.price).toBeUndefined();
    expect(enriched[0]!.pnl).toBeUndefined();
    expect(enriched[0]!.returnPct).toBeUndefined();
  });

  it('sets allocPct to 100 for a single position', () => {
    const entries = [makeEntry('AAPL', 100, 10)];
    const prices = new Map([['AAPL', makeSnap('AAPL', 100, 0)]]);
    const enriched = buildEnrichedEntries(entries, prices);
    expect(enriched[0]!.allocPct).toBeCloseTo(100, 4);
  });

  it('watch-only ticker (no shares) has undefined currentValue and allocPct', () => {
    const entries = [makeEntry('AAPL')]; // no shares
    const prices = new Map([['AAPL', makeSnap('AAPL', 150, 1)]]);
    const enriched = buildEnrichedEntries(entries, prices);

    expect(enriched[0]!.price).toBe(150); // price still shown
    expect(enriched[0]!.currentValue).toBeUndefined();
    expect(enriched[0]!.allocPct).toBeUndefined();
  });

  it('pnl and returnPct are undefined for watch-only tickers', () => {
    const entries = [makeEntry('AAPL')]; // no costBasis
    const prices = new Map([['AAPL', makeSnap('AAPL', 150, 1)]]);
    const enriched = buildEnrichedEntries(entries, prices);

    expect(enriched[0]!.pnl).toBeUndefined();
    expect(enriched[0]!.returnPct).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildAsciiBar()
// ---------------------------------------------------------------------------
describe('buildAsciiBar()', () => {
  it('fills the full bar at 100%', () => {
    expect(buildAsciiBar(100, 20)).toBe('█'.repeat(20));
  });

  it('fills exactly half at 50%', () => {
    expect(buildAsciiBar(50, 20)).toBe('█'.repeat(10) + '░'.repeat(10));
  });

  it('returns empty bar at 0%', () => {
    expect(buildAsciiBar(0, 20)).toBe('░'.repeat(20));
  });

  it('rounds non-round percentages', () => {
    const bar = buildAsciiBar(33, 9);
    const filledCount = (bar.match(/█/g) ?? []).length;
    expect(filledCount).toBe(3); // round(33/100 * 9) = round(2.97) = 3
  });

  it('handles width of 1', () => {
    expect(buildAsciiBar(50, 1)).toMatch(/^[█░]$/);
  });
});

// ---------------------------------------------------------------------------
// fetchLivePrices()
// ---------------------------------------------------------------------------
describe('fetchLivePrices()', () => {
  it('fetches all tickers in parallel and returns a Map', async () => {
    const fetcher = async (ticker: string) => makeSnap(ticker, 100, 1);
    const map = await fetchLivePrices(['AAPL', 'MSFT'], fetcher);

    expect(map.size).toBe(2);
    expect(map.get('AAPL')?.price).toBe(100);
    expect(map.get('MSFT')?.price).toBe(100);
  });

  it('skips tickers where fetcher returns null', async () => {
    const fetcher = async (ticker: string): Promise<PriceSnapshot | null> =>
      ticker === 'AAPL' ? null : makeSnap(ticker, 100, 1);
    const map = await fetchLivePrices(['AAPL', 'MSFT'], fetcher);

    expect(map.size).toBe(1);
    expect(map.has('AAPL')).toBe(false);
    expect(map.get('MSFT')?.price).toBe(100);
  });

  it('skips tickers where fetcher throws', async () => {
    const fetcher = async (ticker: string): Promise<PriceSnapshot | null> => {
      if (ticker === 'AAPL') throw new Error('API error');
      return makeSnap(ticker, 100, 1);
    };
    const map = await fetchLivePrices(['AAPL', 'MSFT'], fetcher);

    expect(map.size).toBe(1);
    expect(map.has('AAPL')).toBe(false);
    expect(map.get('MSFT')?.ticker).toBe('MSFT');
  });

  it('returns empty map for empty ticker list', async () => {
    const fetcher = async (_ticker: string): Promise<PriceSnapshot | null> => null;
    const map = await fetchLivePrices([], fetcher);
    expect(map.size).toBe(0);
  });

  it('each ticker in the map matches the correct snapshot', async () => {
    const prices: Record<string, number> = { AAPL: 200, MSFT: 300, NVDA: 800 };
    const fetcher = async (ticker: string) => makeSnap(ticker, prices[ticker]!, 0);
    const map = await fetchLivePrices(['AAPL', 'MSFT', 'NVDA'], fetcher);

    expect(map.get('AAPL')?.price).toBe(200);
    expect(map.get('MSFT')?.price).toBe(300);
    expect(map.get('NVDA')?.price).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// buildSnapshotDisplayData()
// ---------------------------------------------------------------------------
import { buildSnapshotDisplayData } from './watchlist-display.js';

describe('buildSnapshotDisplayData()', () => {
  // ── Watch-only (no cost basis) ─────────────────────────────────────────────

  it('places entries with prices but no cost basis in watchOnlyEntries', () => {
    const entries = [makeEntry('AMD'), makeEntry('VALE')];
    const prices = new Map([
      ['AMD',  makeSnap('AMD',  219.85, 1.2)],
      ['VALE', makeSnap('VALE',  14.95, -0.5)],
    ]);
    const result = buildSnapshotDisplayData(entries, prices);

    expect(result.watchOnlyEntries).toHaveLength(2);
    expect(result.positionEntries).toHaveLength(0);
    expect(result.hasNoData).toBe(false);
  });

  it('does NOT set hasNoData when watch-only prices are available', () => {
    const entries = [makeEntry('AMD')];
    const prices = new Map([['AMD', makeSnap('AMD', 219.85, 1.2)]]);
    const { hasNoData } = buildSnapshotDisplayData(entries, prices);
    expect(hasNoData).toBe(false);
  });

  it('sets hasNoData only when no entry has a price', () => {
    const entries = [makeEntry('AMD'), makeEntry('VALE')];
    const prices = new Map<string, PriceSnapshot>(); // all fetches failed
    const { hasNoData } = buildSnapshotDisplayData(entries, prices);
    expect(hasNoData).toBe(true);
  });

  it('sets hasNoData for an empty watchlist', () => {
    const { hasNoData } = buildSnapshotDisplayData([], new Map());
    expect(hasNoData).toBe(true);
  });

  // ── Full positions (cost basis + shares) ──────────────────────────────────

  it('places entries with cost basis + shares in positionEntries', () => {
    const entries = [makeEntry('AAPL', 150, 10), makeEntry('MSFT', 300, 5)];
    const prices = new Map([
      ['AAPL', makeSnap('AAPL', 200, 1)],
      ['MSFT', makeSnap('MSFT', 350, 2)],
    ]);
    const result = buildSnapshotDisplayData(entries, prices);

    expect(result.positionEntries).toHaveLength(2);
    expect(result.watchOnlyEntries).toHaveLength(0);
    expect(result.hasNoData).toBe(false);
  });

  it('computes portfolio totals for position entries', () => {
    const entries = [makeEntry('AAPL', 100, 10)];
    const prices = new Map([['AAPL', makeSnap('AAPL', 150, 0)]]);
    const { totals } = buildSnapshotDisplayData(entries, prices);

    expect(totals.totalInvested).toBe(1000);
    expect(totals.totalCurrent).toBe(1500);
    expect(totals.totalPnl).toBe(500);
  });

  // ── Best / worst ──────────────────────────────────────────────────────────

  it('exposes best and worst performer when 2+ positions exist', () => {
    const entries = [makeEntry('AAPL', 100, 10), makeEntry('MSFT', 100, 10), makeEntry('NVDA', 100, 10)];
    const prices = new Map([
      ['AAPL', makeSnap('AAPL', 150, 0)],   // +50%
      ['MSFT', makeSnap('MSFT', 110, 0)],   // +10%
      ['NVDA', makeSnap('NVDA',  80, 0)],   // -20%
    ]);
    const { best, worst } = buildSnapshotDisplayData(entries, prices);

    expect(best?.ticker).toBe('AAPL');
    expect(worst?.ticker).toBe('NVDA');
  });

  it('best and worst are undefined with only 1 position', () => {
    const entries = [makeEntry('AAPL', 100, 10)];
    const prices = new Map([['AAPL', makeSnap('AAPL', 150, 0)]]);
    const { best, worst } = buildSnapshotDisplayData(entries, prices);

    expect(best).toBeUndefined();
    expect(worst).toBeUndefined();
  });

  // ── Mixed watchlist ────────────────────────────────────────────────────────

  it('correctly splits a mixed watchlist into positions and watch-only', () => {
    const entries = [
      makeEntry('AAPL', 150, 10),   // position
      makeEntry('AMD'),              // watch-only
      makeEntry('VALE'),             // watch-only — price fetch failed
    ];
    const prices = new Map([
      ['AAPL', makeSnap('AAPL', 200, 1)],
      ['AMD',  makeSnap('AMD',  220, -0.5)],
      // VALE has no price (fetch failed)
    ]);
    const result = buildSnapshotDisplayData(entries, prices);

    expect(result.positionEntries).toHaveLength(1);
    expect(result.positionEntries[0]!.ticker).toBe('AAPL');
    expect(result.watchOnlyEntries).toHaveLength(1);
    expect(result.watchOnlyEntries[0]!.ticker).toBe('AMD');
    expect(result.hasNoData).toBe(false);
  });

  it('watch-only entries carry their live price and changePercent', () => {
    const entries = [makeEntry('AMD')];
    const prices = new Map([['AMD', makeSnap('AMD', 219.85, -1.5)]]);
    const { watchOnlyEntries } = buildSnapshotDisplayData(entries, prices);

    expect(watchOnlyEntries[0]!.price).toBe(219.85);
    expect(watchOnlyEntries[0]!.changePercent).toBe(-1.5);
  });
});
