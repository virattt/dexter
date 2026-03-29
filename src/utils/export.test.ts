import { describe, it, expect } from 'bun:test';
import { exportToMarkdown, exportToJson, exportToCsv } from './export.js';
import type { HistoryItem } from '../types.js';
import type { DisplayEvent } from '../agent/types.js';

// ============================================================================
// Mock data helpers
// ============================================================================

function makeToolDisplay(
  tool: string,
  args: Record<string, unknown>,
  result: string,
  duration: number,
): DisplayEvent {
  return {
    id: `evt-${tool}`,
    event: { type: 'tool_start', tool, args },
    completed: true,
    endEvent: { type: 'tool_end', tool, args, result, duration },
  };
}

function makeItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 'item-1',
    query: 'Analyze AAPL',
    events: [
      makeToolDisplay('get_market_data', { ticker: 'AAPL' }, '{"data":{"price":1,"volume":2}}', 1200),
      makeToolDisplay('get_financials', { ticker: 'AAPL' }, '{"data":{"revenue":1,"earnings":2,"pe":3,"pb":4,"ps":5,"ev":6}}', 7300),
    ],
    answer: 'AAPL looks strong.',
    status: 'complete',
    startTime: Date.now() - 8500,
    duration: 8500,
    ...overrides,
  };
}

function makeIncompleteItem(): HistoryItem {
  return makeItem({ id: 'item-2', status: 'processing', query: 'Should be excluded' });
}

function makeErrorItem(): HistoryItem {
  return makeItem({ id: 'item-3', status: 'error', query: 'Should be excluded too' });
}

// ============================================================================
// exportToMarkdown
// ============================================================================

describe('exportToMarkdown', () => {
  it('produces correct top-level headings', () => {
    const md = exportToMarkdown([makeItem()], 'My Session');
    expect(md).toContain('# Dexter Research Report');
    expect(md).toContain('**Session:** My Session');
    expect(md).toContain('**Queries:** 1');
  });

  it('includes query heading', () => {
    const md = exportToMarkdown([makeItem()]);
    expect(md).toContain('## Query 1: Analyze AAPL');
  });

  it('includes Research Steps table with tool rows', () => {
    const md = exportToMarkdown([makeItem()]);
    expect(md).toContain('### Research Steps');
    expect(md).toContain('| Tool | Args | Result Summary | Duration |');
    expect(md).toContain('get_market_data');
    expect(md).toContain('get_financials');
  });

  it('includes Answer section', () => {
    const md = exportToMarkdown([makeItem()]);
    expect(md).toContain('### Answer');
    expect(md).toContain('AAPL looks strong.');
  });

  it('omits Answer section when answer is empty', () => {
    const md = exportToMarkdown([makeItem({ answer: '' })]);
    expect(md).not.toContain('### Answer');
  });

  it('numbers multiple queries correctly', () => {
    const items = [
      makeItem({ id: 'a', query: 'First query' }),
      makeItem({ id: 'b', query: 'Second query' }),
    ];
    const md = exportToMarkdown(items);
    expect(md).toContain('## Query 1: First query');
    expect(md).toContain('## Query 2: Second query');
    expect(md).toContain('**Queries:** 2');
  });

  it('uses "Untitled" when no session name provided', () => {
    const md = exportToMarkdown([makeItem()]);
    expect(md).toContain('**Session:** Untitled');
  });
});

// ============================================================================
// exportToJson
// ============================================================================

describe('exportToJson', () => {
  it('produces valid JSON', () => {
    const json = exportToJson([makeItem()], 'Test');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('includes session name and exportedAt', () => {
    const parsed = JSON.parse(exportToJson([makeItem()], 'My Session'));
    expect(parsed.session).toBe('My Session');
    expect(typeof parsed.exportedAt).toBe('string');
  });

  it('includes queries array with correct fields', () => {
    const parsed = JSON.parse(exportToJson([makeItem()]));
    expect(Array.isArray(parsed.queries)).toBe(true);
    const q = parsed.queries[0];
    expect(q.query).toBe('Analyze AAPL');
    expect(Array.isArray(q.toolsUsed)).toBe(true);
    expect(q.toolsUsed).toContain('get_market_data');
    expect(q.toolsUsed).toContain('get_financials');
    expect(typeof q.answer).toBe('string');
    expect(typeof q.durationMs).toBe('number');
  });

  it('deduplicates toolsUsed', () => {
    const item = makeItem({
      events: [
        makeToolDisplay('get_market_data', { ticker: 'AAPL' }, '{"data":{}}', 100),
        makeToolDisplay('get_market_data', { ticker: 'AAPL' }, '{"data":{}}', 100),
      ],
    });
    const parsed = JSON.parse(exportToJson([item]));
    const tools: string[] = parsed.queries[0].toolsUsed;
    expect(tools.filter((t) => t === 'get_market_data').length).toBe(1);
  });

  it('uses "Untitled" when session name omitted', () => {
    const parsed = JSON.parse(exportToJson([makeItem()]));
    expect(parsed.session).toBe('Untitled');
  });
});

// ============================================================================
// exportToCsv
// ============================================================================

describe('exportToCsv', () => {
  it('includes correct CSV header', () => {
    const csv = exportToCsv([makeItem()]);
    expect(csv.split('\n')[0]).toBe('query,tool,args,duration_ms,status');
  });

  it('includes tool rows', () => {
    const csv = exportToCsv([makeItem()]);
    expect(csv).toContain('get_market_data');
    expect(csv).toContain('get_financials');
    expect(csv).toContain('success');
  });

  it('wraps query values in quotes', () => {
    const csv = exportToCsv([makeItem()]);
    expect(csv).toContain('"Analyze AAPL"');
  });

  it('escapes double quotes inside values', () => {
    const item = makeItem({ query: 'What is "AAPL"?' });
    const csv = exportToCsv([item]);
    expect(csv).toContain('"What is ""AAPL""?"');
  });
});

// ============================================================================
// Empty history
// ============================================================================

describe('empty history', () => {
  it('exportToMarkdown returns minimal valid output', () => {
    const md = exportToMarkdown([]);
    expect(md).toContain('# Dexter Research Report');
    expect(md).toContain('**Queries:** 0');
    expect(() => md).not.toThrow();
  });

  it('exportToJson returns valid JSON with empty queries', () => {
    const json = exportToJson([]);
    const parsed = JSON.parse(json);
    expect(parsed.queries).toEqual([]);
  });

  it('exportToCsv returns only header row', () => {
    const csv = exportToCsv([]);
    expect(csv.trim()).toBe('query,tool,args,duration_ms,status');
  });
});

// ============================================================================
// Status filtering — only 'complete' items are included
// ============================================================================

describe('status filtering', () => {
  it('exportToMarkdown excludes non-complete items', () => {
    const items = [makeItem(), makeIncompleteItem(), makeErrorItem()];
    const md = exportToMarkdown(items);
    expect(md).toContain('**Queries:** 1');
    expect(md).not.toContain('Should be excluded');
  });

  it('exportToJson excludes non-complete items', () => {
    const items = [makeItem(), makeIncompleteItem(), makeErrorItem()];
    const parsed = JSON.parse(exportToJson(items));
    expect(parsed.queries.length).toBe(1);
    expect(parsed.queries[0].query).toBe('Analyze AAPL');
  });

  it('exportToCsv excludes non-complete items', () => {
    const items = [makeItem(), makeIncompleteItem(), makeErrorItem()];
    const csv = exportToCsv(items);
    expect(csv).not.toContain('Should be excluded');
  });
});
