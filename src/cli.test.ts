import { describe, it, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';

// ─── Imports under test (must come AFTER any mock.module calls) ───────────────
import {
  truncateAtWord,
  summarizeToolResult,
  fmtPct,
  fmtMoney,
  colorPct,
  createScreen,
  buildHelpPanel,
  buildWatchlistPanel,
  buildShowPanel,
  buildSnapshotPanel,
  flushExchangeToScrollback,
} from './cli.js';
import type { PriceSnapshot } from './controllers/watchlist-display.js';
import type { WatchlistEntry } from './controllers/watchlist-controller.js';
import type { HistoryItem } from './types.js';
import { Container } from '@mariozechner/pi-tui';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: strip ANSI escape codes for plain-text assertions
// ─────────────────────────────────────────────────────────────────────────────
function strip(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Render a Container to a flat array of lines, then strip ANSI codes. */
function renderLines(container: Container): string[] {
  return container.render(80).map(strip).filter((l) => l.trim() !== '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 1 — Pure utility functions
// ─────────────────────────────────────────────────────────────────────────────

describe('truncateAtWord', () => {
  it('returns the string unchanged when it is shorter than maxLength', () => {
    expect(truncateAtWord('hello world', 20)).toBe('hello world');
  });

  it('returns the string unchanged when it is exactly maxLength', () => {
    expect(truncateAtWord('hello', 5)).toBe('hello');
  });

  it('truncates at the last word boundary when a suitable space exists', () => {
    const result = truncateAtWord('hello world foo bar', 12);
    expect(result).toBe('hello world...');
  });

  it('falls back to hard truncation when no suitable word boundary exists', () => {
    // 'abcdefghijklmnop' — no space within the first 8 chars
    const result = truncateAtWord('abcdefghijklmnop', 8);
    expect(result).toBe('abcdefgh...');
  });

  it('appends "..." after the truncation point', () => {
    const result = truncateAtWord('the quick brown fox', 10);
    expect(result.endsWith('...')).toBe(true);
  });

  it('uses word boundary only when space is beyond 50% of maxLength', () => {
    // Space at position 2 out of maxLength=10 → should fall back to hard cut
    const result = truncateAtWord('ab cdefghijklmnop', 10);
    expect(result).toBe('ab cdefghi...');
  });
});

describe('summarizeToolResult', () => {
  it('returns "Loaded X skill" for skill tool', () => {
    const result = summarizeToolResult('skill', { skill: 'dcf' }, '{}');
    expect(result).toBe('Loaded dcf skill');
  });

  it('returns item count for array data', () => {
    const data = JSON.stringify({ data: [1, 2, 3] });
    expect(summarizeToolResult('any_tool', {}, data)).toBe('Received 3 items');
  });

  it('returns field count for object data', () => {
    const data = JSON.stringify({ data: { a: 1, b: 2, c: 3 } });
    expect(summarizeToolResult('some_tool', {}, data)).toBe('Received 3 fields');
  });

  it('excludes underscore-prefixed keys from field count', () => {
    const data = JSON.stringify({ data: { a: 1, _meta: 'x' } });
    expect(summarizeToolResult('some_tool', {}, data)).toBe('Received 1 fields');
  });

  it('returns "Called N data sources" for get_financials', () => {
    const data = JSON.stringify({ data: { src1: {}, src2: {} } });
    expect(summarizeToolResult('get_financials', {}, data)).toBe('Called 2 data sources');
  });

  it('returns "Called 1 data source" singular for get_market_data', () => {
    const data = JSON.stringify({ data: { src1: {} } });
    expect(summarizeToolResult('get_market_data', {}, data)).toBe('Called 1 data source');
  });

  it('returns "Called N data sources" for stock_screener', () => {
    const data = JSON.stringify({ data: { a: {}, b: {}, c: {} } });
    expect(summarizeToolResult('stock_screener', {}, data)).toBe('Called 3 data sources');
  });

  it('returns "Did 1 search" for web_search', () => {
    const data = JSON.stringify({ data: { results: [] } });
    expect(summarizeToolResult('web_search', {}, data)).toBe('Did 1 search');
  });

  it('falls back to truncated raw result on JSON parse error', () => {
    const result = summarizeToolResult('any_tool', {}, 'not-json');
    expect(result).toBe('not-json');
  });

  it('returns "Received data" when JSON parses but has no .data key', () => {
    const data = JSON.stringify({ something: 'else' });
    expect(summarizeToolResult('any_tool', {}, data)).toBe('Received data');
  });
});

describe('fmtPct', () => {
  it('prefixes with + for positive numbers', () => {
    expect(fmtPct(3.5)).toBe('+3.5%');
  });

  it('prefixes with + for zero', () => {
    expect(fmtPct(0)).toBe('+0.0%');
  });

  it('prefixes with - for negative numbers', () => {
    expect(fmtPct(-1.2)).toBe('-1.2%');
  });

  it('rounds to 1 decimal place', () => {
    expect(fmtPct(12.345)).toBe('+12.3%');
  });
});

describe('fmtMoney', () => {
  it('formats small amounts with $ and 2 decimal places', () => {
    expect(fmtMoney(42.5)).toBe('$42.50');
  });

  it('formats thousands as K with 1 decimal', () => {
    expect(fmtMoney(1500)).toBe('$1.5K');
  });

  it('formats millions as M with 2 decimals', () => {
    expect(fmtMoney(2_500_000)).toBe('$2.50M');
  });

  it('handles negative small amounts', () => {
    expect(fmtMoney(-99.99)).toBe('$-99.99');
  });

  it('handles negative thousands', () => {
    expect(fmtMoney(-2000)).toBe('$-2.0K');
  });

  it('handles negative millions', () => {
    expect(fmtMoney(-3_000_000)).toBe('$-3.00M');
  });
});

describe('colorPct', () => {
  it('wraps positive values in success theme color (contains the text)', () => {
    const result = strip(colorPct(5, '+5.0%'));
    expect(result).toBe('+5.0%');
  });

  it('wraps negative values in error theme color (contains the text)', () => {
    const result = strip(colorPct(-3, '-3.0%'));
    expect(result).toBe('-3.0%');
  });

  it('treats zero as positive', () => {
    const result = strip(colorPct(0, '+0.0%'));
    expect(result).toBe('+0.0%');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tier 2 — Panel builder functions
// ─────────────────────────────────────────────────────────────────────────────

describe('createScreen', () => {
  it('includes title when provided', () => {
    const screen = createScreen('My Title', '', new Container());
    const lines = renderLines(screen);
    expect(lines.some((l) => l.includes('My Title'))).toBe(true);
  });

  it('omits title row when title is empty', () => {
    const screen = createScreen('', 'desc', new Container());
    const lines = renderLines(screen);
    expect(lines.some((l) => l.includes('My Title'))).toBe(false);
  });

  it('includes description when provided', () => {
    const screen = createScreen('T', 'Some description', new Container());
    const lines = renderLines(screen);
    expect(lines.some((l) => l.includes('Some description'))).toBe(true);
  });

  it('includes footer when provided', () => {
    const screen = createScreen('T', 'd', new Container(), 'Esc to close');
    const lines = renderLines(screen);
    expect(lines.some((l) => l.includes('Esc to close'))).toBe(true);
  });

  it('omits footer when not provided', () => {
    const screen = createScreen('T', 'd', new Container());
    const lines = renderLines(screen);
    expect(lines.some((l) => l.includes('Esc to close'))).toBe(false);
  });
});

describe('buildHelpPanel', () => {
  it('renders slash commands section', () => {
    const panel = buildHelpPanel();
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('/help'))).toBe(true);
    expect(lines.some((l) => l.includes('/model'))).toBe(true);
    expect(lines.some((l) => l.includes('/watchlist'))).toBe(true);
  });

  it('renders keyboard shortcuts section', () => {
    const panel = buildHelpPanel();
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('Ctrl+C'))).toBe(true);
  });

  it('renders tips section', () => {
    const panel = buildHelpPanel();
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('--deep'))).toBe(true);
  });
});

describe('buildWatchlistPanel', () => {
  const entry: WatchlistEntry = { ticker: 'AAPL', addedAt: '2024-01-01' };
  const entryWithCost: WatchlistEntry = { ticker: 'MSFT', costBasis: 300, shares: 10, addedAt: '2024-01-01' };

  it('shows loading state when prices is null', () => {
    const panel = buildWatchlistPanel([entry], null);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('Fetching') || l.includes('⏳'))).toBe(true);
  });

  it('shows empty-watchlist message when entries are empty', () => {
    const panel = buildWatchlistPanel([], new Map());
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('empty') || l.includes('add'))).toBe(true);
  });

  it('renders ticker name when prices are available', () => {
    const prices = new Map<string, PriceSnapshot>([
      ['AAPL', { ticker: 'AAPL', price: 180, changePercent: 1.5 }],
    ]);
    const panel = buildWatchlistPanel([entry], prices);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('AAPL'))).toBe(true);
  });

  it('shows P&L when cost basis and shares are present', () => {
    const prices = new Map<string, PriceSnapshot>([
      ['MSFT', { ticker: 'MSFT', price: 350, changePercent: 0.5 }],
    ]);
    const panel = buildWatchlistPanel([entryWithCost], prices);
    const lines = renderLines(panel);
    // Should show some dollar amount for P&L
    expect(lines.some((l) => l.includes('$'))).toBe(true);
  });

  it('handles ticker with no price data gracefully', () => {
    const panel = buildWatchlistPanel([entry], new Map());
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('AAPL'))).toBe(true);
  });
});

describe('buildShowPanel', () => {
  const minimalSnap: PriceSnapshot = {
    ticker: 'TSLA',
    price: 250.0,
    changePercent: 2.5,
  };

  it('renders ticker and price', () => {
    const panel = buildShowPanel('TSLA', minimalSnap);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('TSLA'))).toBe(true);
    expect(lines.some((l) => l.includes('250'))).toBe(true);
  });

  it('renders company name when provided', () => {
    const snap = { ...minimalSnap, name: 'Tesla Inc' };
    const panel = buildShowPanel('TSLA', snap);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('Tesla Inc'))).toBe(true);
  });

  it('renders 52-week range when high and low are provided', () => {
    const snap = { ...minimalSnap, high52Week: 300, low52Week: 150 };
    const panel = buildShowPanel('TSLA', snap);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('52'))).toBe(true);
  });

  it('omits 52-week section when values are absent', () => {
    const panel = buildShowPanel('TSLA', minimalSnap);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('52-wk'))).toBe(false);
  });

  it('renders PE ratio when present', () => {
    const snap = { ...minimalSnap, pe: 45.2 };
    const panel = buildShowPanel('TSLA', snap);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('P/E'))).toBe(true);
  });

  it('renders analyst rating when present', () => {
    const snap = { ...minimalSnap, analystRating: 'buy', analystAvgTarget: 300 };
    const panel = buildShowPanel('TSLA', snap);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.toLowerCase().includes('buy') || l.includes('Analyst'))).toBe(true);
  });

  it('renders news items when present', () => {
    const snap = {
      ...minimalSnap,
      news: [{ title: 'Tesla reports record Q4', date: '2024-01-10', source: 'Reuters' }],
    };
    const panel = buildShowPanel('TSLA', snap);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('Tesla reports record'))).toBe(true);
  });

  it('renders market cap when present', () => {
    const snap = { ...minimalSnap, marketCap: 800_000_000_000 };
    const panel = buildShowPanel('TSLA', snap);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('Cap'))).toBe(true);
  });
});

describe('buildSnapshotPanel', () => {
  const watchOnlyEntry: WatchlistEntry = { ticker: 'SPY', addedAt: '2024-01-01' };
  const positionEntry: WatchlistEntry = { ticker: 'AAPL', costBasis: 150, shares: 10, addedAt: '2024-01-01' };

  it('shows loading state when prices is null', () => {
    const panel = buildSnapshotPanel([watchOnlyEntry], null);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('Fetching') || l.includes('loading') || l.includes('⏳'))).toBe(true);
  });

  it('shows Portfolio Snapshot header when prices loaded', () => {
    const prices = new Map<string, PriceSnapshot>([
      ['SPY', { ticker: 'SPY', price: 500, changePercent: 0.3 }],
    ]);
    const panel = buildSnapshotPanel([watchOnlyEntry], prices);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('Snapshot'))).toBe(true);
  });

  it('shows no-data fallback when prices map is empty', () => {
    const panel = buildSnapshotPanel([watchOnlyEntry], new Map());
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('No price data') || l.includes('Add tickers'))).toBe(true);
  });

  it('shows total P&L section when position has cost basis', () => {
    const prices = new Map<string, PriceSnapshot>([
      ['AAPL', { ticker: 'AAPL', price: 200, changePercent: 1.0 }],
    ]);
    const panel = buildSnapshotPanel([positionEntry], prices);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('Invested') || l.includes('P&L'))).toBe(true);
  });

  it('shows Watching section for watch-only entries', () => {
    const prices = new Map<string, PriceSnapshot>([
      ['SPY', { ticker: 'SPY', price: 500, changePercent: 0.3 }],
    ]);
    const panel = buildSnapshotPanel([watchOnlyEntry], prices);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('Watching') || l.includes('SPY'))).toBe(true);
  });

  it('shows allocation bar chart when positions exist', () => {
    const prices = new Map<string, PriceSnapshot>([
      ['AAPL', { ticker: 'AAPL', price: 200, changePercent: 1.0 }],
    ]);
    const panel = buildSnapshotPanel([positionEntry], prices);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('Allocation') || l.includes('AAPL'))).toBe(true);
  });

  it('renders best/worst performers section when multiple positions have data', () => {
    const entries: WatchlistEntry[] = [
      { ticker: 'AAPL', costBasis: 100, shares: 10, addedAt: '2024-01-01' },
      { ticker: 'MSFT', costBasis: 200, shares: 5, addedAt: '2024-01-01' },
    ];
    const prices = new Map<string, PriceSnapshot>([
      ['AAPL', { ticker: 'AAPL', price: 150, changePercent: 2.0 }],
      ['MSFT', { ticker: 'MSFT', price: 180, changePercent: -1.0 }],
    ]);
    const panel = buildSnapshotPanel(entries, prices);
    const lines = renderLines(panel);
    expect(lines.some((l) => l.includes('Best') || l.includes('Worst'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tier 3 — flushExchangeToScrollback
// ─────────────────────────────────────────────────────────────────────────────

describe('flushExchangeToScrollback', () => {
  const makeFakeTui = (previousLines: string[] = []) => ({
    previousLines,
    cursorRow: 10,
    hardwareCursorRow: 10,
    maxLinesRendered: 10,
    previousViewportTop: 5,
    previousWidth: 80,
    stop: mock(() => {}),
    start: mock(() => {}),
    requestRender: mock(() => {}),
  });

  const makeFakeChatLog = () => ({
    clearAll: mock(() => {}),
  });

  const makeItem = (answer = 'test answer'): HistoryItem => ({
    id: 'test-1',
    query: 'test query',
    events: [],
    answer,
    status: 'complete',
    duration: 100,
  });

  let stdoutSpy: ReturnType<typeof spyOn>;
  let origRows: number | undefined;

  beforeEach(() => {
    stdoutSpy = spyOn(process.stdout, 'write').mockImplementation(() => true);
    origRows = process.stdout.rows;
    Object.defineProperty(process.stdout, 'rows', { value: 24, configurable: true });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    Object.defineProperty(process.stdout, 'rows', { value: origRows, configurable: true });
  });

  it('calls tui.stop() and tui.start()', () => {
    const tui = makeFakeTui([]);
    const chatLog = makeFakeChatLog();
    flushExchangeToScrollback(tui as any, chatLog as any, makeItem());
    expect(tui.stop).toHaveBeenCalledTimes(1);
    expect(tui.start).toHaveBeenCalledTimes(1);
  });

  it('does NOT write cursor-up escape when previousLines is empty', () => {
    const tui = makeFakeTui([]);
    flushExchangeToScrollback(tui as any, makeFakeChatLog() as any, makeItem());
    const written = (stdoutSpy.mock.calls as unknown as [string][])
      .map(([s]) => s)
      .join('');
    expect(written).not.toMatch(/\x1b\[\d+A/);
  });

  it('writes cursor-up escape when previousLines has entries', () => {
    const tui = makeFakeTui(new Array(5).fill('line'));
    flushExchangeToScrollback(tui as any, makeFakeChatLog() as any, makeItem());
    const written = (stdoutSpy.mock.calls as unknown as [string][])
      .map(([s]) => s)
      .join('');
    expect(written).toMatch(/\x1b\[6A/); // min(5+1, 24) = 6
  });

  it('clamps cursor-up to terminal rows when previousLines > termRows', () => {
    // 30 lines, terminal rows = 24 → clamp to 24
    const tui = makeFakeTui(new Array(30).fill('line'));
    flushExchangeToScrollback(tui as any, makeFakeChatLog() as any, makeItem());
    const written = (stdoutSpy.mock.calls as unknown as [string][])
      .map(([s]) => s)
      .join('');
    expect(written).toMatch(/\x1b\[24A/);
  });

  it('writes screen-clear escape after cursor-up', () => {
    const tui = makeFakeTui(new Array(3).fill('line'));
    flushExchangeToScrollback(tui as any, makeFakeChatLog() as any, makeItem());
    const written = (stdoutSpy.mock.calls as unknown as [string][])
      .map(([s]) => s)
      .join('');
    expect(written).toContain('\x1b[J');
  });

  it('calls chatLog.clearAll()', () => {
    const tui = makeFakeTui([]);
    const chatLog = makeFakeChatLog();
    flushExchangeToScrollback(tui as any, chatLog as any, makeItem());
    expect(chatLog.clearAll).toHaveBeenCalledTimes(1);
  });

  it('resets TUI internal state fields', () => {
    const tui = makeFakeTui(new Array(3).fill('line'));
    flushExchangeToScrollback(tui as any, makeFakeChatLog() as any, makeItem());
    expect((tui as any).previousLines).toEqual([]);
    expect((tui as any).cursorRow).toBe(0);
    expect((tui as any).hardwareCursorRow).toBe(0);
    expect((tui as any).maxLinesRendered).toBe(0);
    expect((tui as any).previousViewportTop).toBe(0);
  });

  it('does NOT reset previousWidth (prevents scrollback wipe)', () => {
    const tui = makeFakeTui([]);
    (tui as any).previousWidth = 120;
    flushExchangeToScrollback(tui as any, makeFakeChatLog() as any, makeItem());
    expect((tui as any).previousWidth).toBe(120);
  });

  it('calls tui.requestRender() after restart', () => {
    const tui = makeFakeTui([]);
    flushExchangeToScrollback(tui as any, makeFakeChatLog() as any, makeItem());
    expect(tui.requestRender).toHaveBeenCalledTimes(1);
  });

  it('writes the formatted exchange content to stdout', () => {
    const tui = makeFakeTui([]);
    flushExchangeToScrollback(tui as any, makeFakeChatLog() as any, makeItem('my answer'));
    const written = (stdoutSpy.mock.calls as unknown as [string][])
      .map(([s]) => s)
      .join('');
    // formatExchangeForScrollback should include the query and answer
    expect(written).toMatch(/test query|my answer/);
  });
});
