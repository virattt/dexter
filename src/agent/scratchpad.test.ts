/**
 * TDD tests for the context_summary features added to Scratchpad:
 *   - ScratchpadEntry.type 'context_summary'
 *   - getContentToBeCleared(keepCount)
 *   - addContextSummary(text)
 *   - getToolResults() rendering of summaries
 *
 * File system isolation: we chdir() into a tmpdir before each test and
 * restore afterwards — this keeps scratchpad files out of the project tree.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Scratchpad } from './scratchpad.js';

// ---------------------------------------------------------------------------
// Isolation helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `scratchpad-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addTools(sp: Scratchpad, count: number): void {
  for (let i = 0; i < count; i++) {
    sp.addToolResult(`tool_${i}`, { ticker: `T${i}` }, JSON.stringify({ value: i * 100 }));
  }
}

// ---------------------------------------------------------------------------
// getContentToBeCleared
// ---------------------------------------------------------------------------

describe('Scratchpad.getContentToBeCleared', () => {
  it('returns empty array when tool count is within keepCount', () => {
    const sp = new Scratchpad('test query');
    addTools(sp, 2);
    expect(sp.getContentToBeCleared(3)).toHaveLength(0);
  });

  it('returns empty array when tool count equals keepCount', () => {
    const sp = new Scratchpad('test query');
    addTools(sp, 3);
    expect(sp.getContentToBeCleared(3)).toHaveLength(0);
  });

  it('returns one entry when tool count exceeds keepCount by 1', () => {
    const sp = new Scratchpad('test query');
    addTools(sp, 4);
    const result = sp.getContentToBeCleared(3);
    expect(result).toHaveLength(1);
  });

  it('returns the OLDEST entries (those that would be dropped first)', () => {
    const sp = new Scratchpad('test query');
    addTools(sp, 3);
    const result = sp.getContentToBeCleared(2);
    expect(result).toHaveLength(1);
    expect(result[0]!.toolName).toBe('tool_0'); // oldest
  });

  it('includes toolName, args, and snippet in each entry', () => {
    const sp = new Scratchpad('test query');
    sp.addToolResult('financial_search', { ticker: 'AAPL', period: 'annual' }, '{"revenue": 123}');
    sp.addToolResult('web_search', { query: 'AAPL news' }, '{"results": []}');
    const result = sp.getContentToBeCleared(1);
    expect(result[0]!.toolName).toBe('financial_search');
    expect(result[0]!.args).toEqual({ ticker: 'AAPL', period: 'annual' });
    expect(result[0]!.snippet).toContain('revenue');
  });

  it('does not return already-cleared entries', () => {
    const sp = new Scratchpad('test query');
    addTools(sp, 5);
    // Clear 3, keeping 2
    sp.clearOldestToolResults(2);
    // Now we have 2 active — ask what would be cleared to keep 2 → none
    const result = sp.getContentToBeCleared(2);
    expect(result).toHaveLength(0);
  });

  it('truncates snippet to 600 chars', () => {
    const sp = new Scratchpad('test query');
    const longResult = 'x'.repeat(1200);
    sp.addToolResult('big_tool', {}, longResult);
    sp.addToolResult('other_tool', {}, 'small');
    const result = sp.getContentToBeCleared(1);
    expect(result[0]!.snippet.length).toBeLessThanOrEqual(600);
  });
});

// ---------------------------------------------------------------------------
// addContextSummary
// ---------------------------------------------------------------------------

describe('Scratchpad.addContextSummary', () => {
  it('persists a context_summary entry to the JSONL file', () => {
    const sp = new Scratchpad('test query');
    sp.addContextSummary('AAPL had $391B revenue in 2024');

    const output = sp.getToolResults();
    expect(output).toContain('AAPL had $391B revenue in 2024');
  });

  it('renders the summary under a [Prior Research Summary] heading', () => {
    const sp = new Scratchpad('test query');
    sp.addContextSummary('Revenue grew 12%');

    const output = sp.getToolResults();
    expect(output).toContain('[Prior Research Summary]');
    expect(output).toContain('Revenue grew 12%');
  });

  it('multiple summaries are all rendered', () => {
    const sp = new Scratchpad('test query');
    sp.addContextSummary('First summary');
    sp.addContextSummary('Second summary');

    const output = sp.getToolResults();
    expect(output).toContain('First summary');
    expect(output).toContain('Second summary');
  });
});

// ---------------------------------------------------------------------------
// getToolResults — integration of context_summary rendering
// ---------------------------------------------------------------------------

describe('Scratchpad.getToolResults — context_summary rendering', () => {
  it('shows [Prior Research Summary] when a context_summary entry exists', () => {
    const sp = new Scratchpad('test query');
    addTools(sp, 2);
    sp.clearOldestToolResults(1);
    sp.addContextSummary('Earlier: tool_0 returned value=0');

    const output = sp.getToolResults();
    expect(output).toContain('[Prior Research Summary]');
    expect(output).toContain('Earlier: tool_0 returned value=0');
  });

  it('does NOT show "[Tool result #N cleared]" when entries have been replaced by a summary', () => {
    const sp = new Scratchpad('test query');
    addTools(sp, 3);
    sp.clearOldestToolResults(2); // clears 1
    sp.addContextSummary('Summary for cleared result');

    const output = sp.getToolResults();
    expect(output).not.toContain('[Tool result #');
    expect(output).not.toContain('cleared from context');
  });

  it('still shows remaining (non-cleared) tool results alongside the summary', () => {
    const sp = new Scratchpad('test query');
    addTools(sp, 3);
    sp.clearOldestToolResults(2);
    sp.addContextSummary('Summary');

    const output = sp.getToolResults();
    expect(output).toContain('tool_1'); // kept
    expect(output).toContain('tool_2'); // kept
  });

  it('context_summary entries do not affect tool result indexing', () => {
    const sp = new Scratchpad('test query');
    addTools(sp, 2);
    const cleared = sp.clearOldestToolResults(1);
    expect(cleared).toBe(1);

    // After clearing 1, active count should be 1
    expect(sp.getActiveToolResultCount()).toBe(1);
  });

  it('returns empty string when only an init entry and no tools', () => {
    const sp = new Scratchpad('test query');
    expect(sp.getToolResults()).toBe('');
  });

  it('summary appears before remaining tool results in output', () => {
    const sp = new Scratchpad('test query');
    sp.addContextSummary('Condensed earlier results');
    sp.addToolResult('live_tool', {}, '{"price": 150}');

    const output = sp.getToolResults();
    const summaryPos = output.indexOf('Prior Research Summary');
    const toolPos = output.indexOf('live_tool');
    expect(summaryPos).toBeLessThan(toolPos);
  });
});
