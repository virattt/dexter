import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  comparePortfolioVsAihf,
  normalizeDecision,
  renderDoubleCheckMarkdown,
} from './aihf-double-check.js';
import { extractSseEvents } from './aihf-api.js';
import { getDefaultAihfGraph, getAnalystIds, getPMNodeId } from './aihf-graph.js';
import type { AihfDecision, AihfRunResult, AihfTickerSignals, TickerEntry, ExcludedEntry } from './types.js';

const __dirname2 = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(__dirname2, '__fixtures__', name), 'utf-8');

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

describe('aihf-graph', () => {
  test('has exactly 18 analyst nodes + 1 PM node', () => {
    const graph = getDefaultAihfGraph();
    expect(graph.nodes.length).toBe(19);
    expect(graph.nodes.filter((n) => n.type === 'analyst').length).toBe(18);
    expect(graph.nodes.filter((n) => n.type === 'portfolio_manager').length).toBe(1);
  });

  test('each analyst has an edge to PM', () => {
    const graph = getDefaultAihfGraph();
    const pm = getPMNodeId();
    for (const id of getAnalystIds()) {
      expect(graph.edges.some((e) => e.from === id && e.to === pm)).toBe(true);
    }
  });

  test('no duplicate node IDs', () => {
    const graph = getDefaultAihfGraph();
    const ids = graph.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// SSE parser
// ---------------------------------------------------------------------------

describe('extractSseEvents', () => {
  test('parses the complete SSE fixture into events', () => {
    const raw = fixture('run-complete.sse.txt');
    const { parsed, remaining } = extractSseEvents(raw + '\n\n');
    expect(parsed.length).toBeGreaterThanOrEqual(3);

    const start = parsed.find((e) => e.event === 'start');
    expect(start).toBeDefined();

    const complete = parsed.find((e) => e.event === 'complete');
    expect(complete).toBeDefined();
    expect(typeof complete!.data).toBe('object');

    const data = complete!.data as AihfRunResult;
    expect(data.decisions).toBeDefined();
    expect(data.analyst_signals).toBeDefined();
    expect(data.current_prices).toBeDefined();
  });

  test('incomplete buffer preserved in remaining', () => {
    const { parsed, remaining } = extractSseEvents('event: progress\ndata: {"partial":');
    expect(parsed.length).toBe(0);
    expect(remaining).toContain('partial');
  });

  test('empty input returns empty', () => {
    const { parsed, remaining } = extractSseEvents('');
    expect(parsed.length).toBe(0);
    expect(remaining).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

describe('normalizeDecision', () => {
  test('buy with 100% confidence and all-bullish analysts → 1.0', () => {
    const decision: AihfDecision = { action: 'buy', quantity: 100, confidence: 100, reasoning: '' };
    const signals: AihfTickerSignals = {
      a1: { signal: 'bullish', confidence: 80, reasoning: '' },
      a2: { signal: 'bullish', confidence: 90, reasoning: '' },
    };
    expect(normalizeDecision(decision, signals)).toBe(1.0);
  });

  test('sell with 100% confidence and all-bearish analysts → -1.0', () => {
    const decision: AihfDecision = { action: 'sell', quantity: 50, confidence: 100, reasoning: '' };
    const signals: AihfTickerSignals = {
      a1: { signal: 'bearish', confidence: 80, reasoning: '' },
      a2: { signal: 'bearish', confidence: 90, reasoning: '' },
    };
    expect(normalizeDecision(decision, signals)).toBe(-1.0);
  });

  test('hold with mixed signals → near 0', () => {
    const decision: AihfDecision = { action: 'hold', quantity: 0, confidence: 50, reasoning: '' };
    const signals: AihfTickerSignals = {
      a1: { signal: 'bullish', confidence: 70, reasoning: '' },
      a2: { signal: 'bearish', confidence: 70, reasoning: '' },
    };
    const score = normalizeDecision(decision, signals);
    expect(Math.abs(score)).toBeLessThan(0.5);
  });

  test('missing analyst signals → relies on PM score only', () => {
    const decision: AihfDecision = { action: 'buy', quantity: 100, confidence: 80, reasoning: '' };
    const score = normalizeDecision(decision, undefined);
    expect(score).toBeCloseTo(0.6 * 0.8, 2);
  });
});

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

describe('comparePortfolioVsAihf', () => {
  const sseRaw = fixture('run-complete.sse.txt');
  const { parsed } = extractSseEvents(sseRaw + '\n\n');
  const aihfResult = parsed.find((e) => e.event === 'complete')!.data as AihfRunResult;

  const defaultIncluded: TickerEntry[] = [
    { ticker: 'AMAT', weight: 14 },
    { ticker: 'ASML', weight: 12 },
    { ticker: 'LRCX', weight: 10 },
    { ticker: 'ANET', weight: 8 },
  ];

  const hlIncluded: TickerEntry[] = [
    { ticker: 'TSM', weight: 16 },
    { ticker: 'NVDA', weight: 10 },
    { ticker: 'PLTR', weight: 8 },
  ];

  const excluded: ExcludedEntry[] = [
    { ticker: 'MU', reason: 'Muddies cleaner TSM + tokenization structure.' },
    { ticker: 'AVGO', reason: 'Weaker expression than equipment + ANET.' },
  ];

  test('produces correct summary shape', () => {
    const result = comparePortfolioVsAihf(
      { defaultIncluded, hyperliquidIncluded: hlIncluded, excluded },
      aihfResult,
    );
    expect(result.summary).toBeDefined();
    expect(typeof result.summary.included_agreement_pct).toBe('number');
    expect(result.summary.included_agreement_pct).toBeGreaterThanOrEqual(0);
    expect(result.summary.included_agreement_pct).toBeLessThanOrEqual(1);
    expect(typeof result.summary.conflict_count).toBe('number');
    expect(typeof result.summary.excluded_interesting_count).toBe('number');
  });

  test('flags NVDA as a conflict (AIHF sell vs Dexter included)', () => {
    const result = comparePortfolioVsAihf(
      { defaultIncluded, hyperliquidIncluded: hlIncluded, excluded },
      aihfResult,
    );
    const nvdaConflict = result.conflicts.find((c) => c.ticker === 'NVDA');
    expect(nvdaConflict).toBeDefined();
    expect(nvdaConflict!.aihf_stance).toBe('SELL');
    expect(nvdaConflict!.sleeve).toBe('hyperliquid');
  });

  test('flags MU as excluded-but-interesting (AIHF buy)', () => {
    const result = comparePortfolioVsAihf(
      { defaultIncluded, hyperliquidIncluded: hlIncluded, excluded },
      aihfResult,
    );
    const muInteresting = result.excluded_interesting.find((e) => e.ticker === 'MU');
    expect(muInteresting).toBeDefined();
    expect(muInteresting!.aihf_signal).toBe('BUY');
  });

  test('agreement pct excludes tickers with no AIHF decision', () => {
    const limitedAihf: AihfRunResult = {
      decisions: { AMAT: aihfResult.decisions.AMAT },
      analyst_signals: {},
      current_prices: {},
    };
    const result = comparePortfolioVsAihf(
      { defaultIncluded, hyperliquidIncluded: hlIncluded, excluded: [] },
      limitedAihf,
    );
    expect(result.summary.included_agreement_pct).toBe(1);
    expect(result.aihf_raw_meta.partial).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Markdown render
// ---------------------------------------------------------------------------

describe('renderDoubleCheckMarkdown', () => {
  test('contains header and summary section', () => {
    const sseRaw = fixture('run-complete.sse.txt');
    const { parsed } = extractSseEvents(sseRaw + '\n\n');
    const aihfResult = parsed.find((e) => e.event === 'complete')!.data as AihfRunResult;

    const result = comparePortfolioVsAihf(
      {
        defaultIncluded: [{ ticker: 'AMAT', weight: 14 }],
        hyperliquidIncluded: [],
        excluded: [],
      },
      aihfResult,
    );

    const md = renderDoubleCheckMarkdown(result, '2026-03-09');
    expect(md).toContain('# AIHF Double-Check Report');
    expect(md).toContain('2026-03-09');
    expect(md).toContain('## Summary');
    expect(md).toContain('## High-Conviction Conflicts');
    expect(md).toContain('## Excluded But Interesting');
  });
});
