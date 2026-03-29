/**
 * Tests for the improved injectContextSummaryBeforeClearing logic (Feature 13).
 *
 * We test the exported pure helpers (extractKeyFacts, extractTickerMetrics,
 * buildContextSummaryText) directly — no LLM mocking needed — plus the
 * scratchpad-level behaviour (only one context_summary rendered, merge on
 * second call) via Scratchpad + createRunContext.
 *
 * File system isolation: chdir into a tmpdir before each test.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractKeyFacts, extractTickerMetrics, buildContextSummaryText } from './agent.js';
import { Scratchpad } from './scratchpad.js';
import { createRunContext } from './run-context.js';

// ---------------------------------------------------------------------------
// File system isolation
// ---------------------------------------------------------------------------

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `agent-ctx-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// extractKeyFacts
// ---------------------------------------------------------------------------

describe('extractKeyFacts', () => {
  it('extracts dollar amounts from text', () => {
    const result = extractKeyFacts('Revenue was $44.9B last quarter');
    expect(result).toContain('$44.9B');
  });

  it('extracts percentages', () => {
    const result = extractKeyFacts('Gross margin improved to 65.3%');
    expect(result).toContain('65.3%');
  });

  it('extracts P/E ratios', () => {
    const result = extractKeyFacts('Trading at P/E 42.0x');
    expect(result).toContain('P/E 42.0x');
  });

  it('returns empty string when no facts found', () => {
    expect(extractKeyFacts('No numbers here whatsoever')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// extractTickerMetrics
// ---------------------------------------------------------------------------

describe('extractTickerMetrics', () => {
  it('parses revenue from JSON-like text', () => {
    const text = '{"revenue": "$44.9B", "net_income": "$12.1B"}';
    const metrics = extractTickerMetrics(text);
    expect(metrics.some(m => m.startsWith('rev='))).toBe(true);
    expect(metrics.some(m => m.startsWith('NI='))).toBe(true);
  });

  it('parses pe_ratio into PE label', () => {
    const text = '{"pe_ratio": "42.0"}';
    const metrics = extractTickerMetrics(text);
    expect(metrics).toContain('PE=42.0');
  });

  it('returns empty array when no known keys found', () => {
    expect(extractTickerMetrics('{"unknown_key": "value"}')).toHaveLength(0);
  });

  it('limits output to at most 6 metrics', () => {
    const text = JSON.stringify({
      revenue: '$1B', net_income: '$0.1B', pe_ratio: '20',
      eps: '5.0', market_cap: '$500B', gross_margin: '60%',
      return_on_equity: '25%',
    });
    expect(extractTickerMetrics(text).length).toBeLessThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// buildContextSummaryText
// ---------------------------------------------------------------------------

describe('buildContextSummaryText', () => {
  it('returns null for empty input', () => {
    expect(buildContextSummaryText([], null)).toBeNull();
  });

  it('single ticker result — summary contains ticker name and key metric', () => {
    const entry = {
      toolName: 'get_financials',
      args: { ticker: 'NVDA' },
      snippet: '{"pe_ratio": "42.0", "revenue": "$44.9B"} P/E 42.0x',
    };
    const result = buildContextSummaryText([entry], null);
    expect(result).not.toBeNull();
    // Ticker appears in the call label
    expect(result!).toContain('NVDA');
    // Key facts extracted
    expect(result!).toContain('KEY FACTS');
  });

  it('prefixes each line with ticker arg when present', () => {
    const entry = {
      toolName: 'get_financials',
      args: { ticker: 'AMD' },
      snippet: '{"revenue": "$22.7B"}',
    };
    const result = buildContextSummaryText([entry], null);
    expect(result!).toContain('get_financials(ticker=AMD)');
  });

  it('prefixes with query arg when no ticker is present', () => {
    const entry = {
      toolName: 'web_search',
      args: { query: 'INTC earnings 2024' },
      snippet: 'Intel reported earnings of $1.2B',
    };
    const result = buildContextSummaryText([entry], null);
    expect(result!).toContain('web_search(query=INTC earnings 2024)');
  });

  it('multi-ticker results — all tickers appear in summary', () => {
    const entries = ['NVDA', 'AMD', 'INTC', 'QCOM', 'TSMC'].map(ticker => ({
      toolName: 'get_financials',
      args: { ticker },
      snippet: `{"pe_ratio": "30.0", "revenue": "$10B"} P/E 30.0x`,
    }));
    const result = buildContextSummaryText(entries, null);
    for (const ticker of ['NVDA', 'AMD', 'INTC', 'QCOM', 'TSMC']) {
      expect(result!).toContain(ticker);
    }
  });

  it('builds key metrics table when ticker and financial keys are present', () => {
    const entry = {
      toolName: 'get_financials',
      args: { ticker: 'NVDA' },
      snippet: '{"pe_ratio": "42.0", "revenue": "$44.9B"}',
    };
    const result = buildContextSummaryText([entry], null);
    expect(result!).toContain('Key metrics by ticker:');
    expect(result!).toContain('NVDA:');
  });

  it('snippet is capped at 400 chars (not 200)', () => {
    const longSnippet = 'x'.repeat(500);
    const entry = { toolName: 'tool', args: {}, snippet: longSnippet };
    const result = buildContextSummaryText([entry], null);
    // The condensed portion should be ≤400 chars
    const condensedLine = result!.split('\n').find(l => l.startsWith('- tool('));
    expect(condensedLine).toBeDefined();
    // line: "- tool(): <400 chars>…[KEY FACTS: ...]"
    // The 'x' portion should be 400 chars
    const match = condensedLine!.match(/: (x+)/);
    expect(match).not.toBeNull();
    expect(match![1]!.length).toBe(400);
  });

  it('merges new summary into existing one (not stacking)', () => {
    const first = buildContextSummaryText(
      [{ toolName: 'tool_a', args: { ticker: 'AAPL' }, snippet: 'Apple data $195' }],
      null,
    );
    const second = buildContextSummaryText(
      [{ toolName: 'tool_b', args: { ticker: 'MSFT' }, snippet: 'Microsoft data $380' }],
      first,
    );
    // Both tickers in merged result
    expect(second!).toContain('AAPL');
    expect(second!).toContain('MSFT');
    // Separated by the merge divider
    expect(second!).toContain('---');
  });
});

// ---------------------------------------------------------------------------
// Scratchpad integration — only ONE context_summary rendered after two calls
// ---------------------------------------------------------------------------

describe('injectContextSummaryBeforeClearing via Scratchpad', () => {
  it('getLatestContextSummary returns null when no summary added', () => {
    const sp = new Scratchpad('test query');
    expect(sp.getLatestContextSummary()).toBeNull();
  });

  it('getLatestContextSummary returns most recent summary', () => {
    const sp = new Scratchpad('test query');
    sp.addContextSummary('first summary');
    sp.addContextSummary('second summary');
    expect(sp.getLatestContextSummary()).toBe('second summary');
  });

  it('getToolResults only renders the latest context_summary (not all)', () => {
    const sp = new Scratchpad('test query');
    sp.addContextSummary('old summary');
    sp.addContextSummary('new summary');

    const rendered = sp.getToolResults();
    const count = (rendered.match(/Prior Research Summary/g) ?? []).length;
    expect(count).toBe(1);
    expect(rendered).toContain('new summary');
    expect(rendered).not.toContain('old summary');
  });

  it('merge: second inject produces ONE context_summary block with both batches', () => {
    // Simulate two rounds of context clearing.
    // Round 1: tools 0-5 cleared, keep 3 (indices 3-5)
    // Round 2: tools 3-5 + 6-8 → clear oldest, keep 3

    const sp = new Scratchpad('test query');

    // Add 6 tool results (indices 0-5)
    for (let i = 0; i < 6; i++) {
      sp.addToolResult(`tool_${i}`, { ticker: `T${i}` }, `{"pe_ratio": "${i * 10}"}` );
    }

    // First inject + clear (keepCount=3 → clears 0,1,2)
    const firstToSummarise = sp.getContentToBeCleared(3);
    const firstSummary = buildContextSummaryText(firstToSummarise, sp.getLatestContextSummary());
    if (firstSummary) sp.addContextSummary(firstSummary);
    sp.clearOldestToolResults(3);

    // Add 3 more tool results (indices 6-8)
    for (let i = 6; i < 9; i++) {
      sp.addToolResult(`tool_${i}`, { ticker: `T${i}` }, `{"pe_ratio": "${i * 10}"}`);
    }

    // Second inject + clear (keepCount=3 → clears 3,4,5)
    const secondToSummarise = sp.getContentToBeCleared(3);
    const secondSummary = buildContextSummaryText(secondToSummarise, sp.getLatestContextSummary());
    if (secondSummary) sp.addContextSummary(secondSummary);
    sp.clearOldestToolResults(3);

    const rendered = sp.getToolResults();
    // Only one summary block rendered despite two inject calls
    const summaryCount = (rendered.match(/Prior Research Summary/g) ?? []).length;
    expect(summaryCount).toBe(1);
  });

  it('empty tool results — no context_summary added', () => {
    const sp = new Scratchpad('test query');
    // No tool results at all → nothing to clear
    const toSummarise = sp.getContentToBeCleared(5);
    const summary = buildContextSummaryText(toSummarise, sp.getLatestContextSummary());
    // buildContextSummaryText returns null for empty input
    expect(summary).toBeNull();
    // Nothing written to scratchpad
    expect(sp.getLatestContextSummary()).toBeNull();
  });

  it('createRunContext produces a scratchpad ready for context summary', () => {
    const ctx = createRunContext('compare NVDA, AMD');
    for (let i = 0; i < 4; i++) {
      ctx.scratchpad.addToolResult(`tool_${i}`, { ticker: `TICK${i}` }, `{"revenue": "$${i}B"}`);
    }
    const toSummarise = ctx.scratchpad.getContentToBeCleared(2);
    const summary = buildContextSummaryText(toSummarise, ctx.scratchpad.getLatestContextSummary());
    expect(summary).not.toBeNull();
    expect(summary!).toContain('TICK0');
    expect(summary!).toContain('TICK1');
    if (summary) ctx.scratchpad.addContextSummary(summary);
    expect(ctx.scratchpad.getLatestContextSummary()).not.toBeNull();
  });
});
