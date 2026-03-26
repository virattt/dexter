import { describe, it, expect } from 'bun:test';
import { formatExchangeForScrollback, formatDuration } from './scrollback.js';
import type { HistoryItem } from '../types.js';

function makeItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: '1',
    query: 'test query',
    events: [],
    answer: '',
    status: 'complete',
    startTime: Date.now(),
    ...overrides,
  };
}

describe('formatDuration', () => {
  it('shows ms for sub-second', () => expect(formatDuration(500)).toBe('500ms'));
  it('shows seconds', () => expect(formatDuration(5000)).toBe('5s'));
  it('shows minutes', () => expect(formatDuration(90000)).toBe('1m 30s'));
});

describe('formatExchangeForScrollback', () => {
  it('includes user query', () => {
    const out = formatExchangeForScrollback(makeItem({ query: 'what is 2+2?' }));
    expect(out).toContain('what is 2+2?');
  });

  it('includes final answer for complete items', () => {
    const out = formatExchangeForScrollback(makeItem({ answer: 'The answer is 4', status: 'complete' }));
    expect(out).toContain('The answer is 4');
  });

  it('shows Interrupted for interrupted items with no answer', () => {
    const out = formatExchangeForScrollback(makeItem({ status: 'interrupted', answer: '' }));
    expect(out).toContain('Interrupted');
  });

  it('shows error message for error items', () => {
    const out = formatExchangeForScrollback(makeItem({ status: 'error', answer: '' }));
    expect(out).toContain('Error');
  });

  it('includes duration footer when present', () => {
    const out = formatExchangeForScrollback(makeItem({ duration: 5000 }));
    expect(out).toContain('✻');
    expect(out).toContain('5s');
  });

  it('includes completed tool calls with summary and duration', () => {
    const item = makeItem({
      events: [
        {
          id: 'tool-1',
          completed: true,
          event: { type: 'tool_start', tool: 'web_search', args: { query: 'AAPL stock price' } },
          endEvent: { type: 'tool_end', tool: 'web_search', args: { query: 'AAPL stock price' }, result: '{"data":{"results":[1,2,3]}}', duration: 1200 },
        },
      ],
    });
    const out = formatExchangeForScrollback(item);
    expect(out).toContain('Web Search');        // tool name formatted
    expect(out).toContain('AAPL stock price');  // tool args
    expect(out).toContain(' in ');              // duration present
    // completed tools get a check mark ✓
    expect(out).toContain('✓');
  });

  it('includes failed tool calls with error', () => {
    const item = makeItem({
      events: [
        {
          id: 'tool-2',
          completed: true,
          event: { type: 'tool_start', tool: 'get_financials', args: { ticker: 'TSLA' } },
          endEvent: { type: 'tool_error', tool: 'get_financials', error: '402 Payment Required' },
        },
      ],
    });
    const out = formatExchangeForScrollback(item);
    expect(out).toContain('Financials');
    expect(out).toContain('Error');
    expect(out).toContain('402 Payment Required');
    expect(out).toContain('✗');
  });

  it('includes interrupted (incomplete) tool calls', () => {
    const item = makeItem({
      status: 'interrupted',
      events: [
        {
          id: 'tool-3',
          completed: false,
          event: { type: 'tool_start', tool: 'web_search', args: { query: 'Vestas stock' } },
        },
      ],
    });
    const out = formatExchangeForScrollback(item);
    expect(out).toContain('Web Search');
    expect(out).toContain('Vestas stock');
    expect(out).toContain('Interrupted');
  });

  it('includes thinking events', () => {
    const item = makeItem({
      events: [
        { id: 'think-1', completed: true, event: { type: 'thinking', message: 'I need to check the market data' } },
      ],
    });
    const out = formatExchangeForScrollback(item);
    expect(out).toContain('💭');
    expect(out).toContain('I need to check the market data');
  });

  it('skips empty thinking events', () => {
    const item = makeItem({
      events: [
        { id: 'think-empty', completed: true, event: { type: 'thinking', message: '   ' } },
      ],
    });
    const out = formatExchangeForScrollback(item);
    expect(out).not.toContain('💭');
  });

  it('includes reasoning events with truncation', () => {
    const longReasoning = 'A'.repeat(500);
    const item = makeItem({
      events: [
        { id: 'reason-1', completed: true, event: { type: 'reasoning', content: longReasoning } },
      ],
    });
    const out = formatExchangeForScrollback(item);
    expect(out).toContain('Reasoning (500 chars)');
    expect(out).toContain('...');  // truncated at 300
  });

  it('includes context_cleared events', () => {
    const item = makeItem({
      events: [
        { id: 'ctx-1', completed: true, event: { type: 'context_cleared', clearedCount: 8, keptCount: 3 } },
      ],
    });
    const out = formatExchangeForScrollback(item);
    expect(out).toContain('kept 3');
    expect(out).toContain('cleared 8');
  });

  it('renders multiple tool calls in order', () => {
    const item = makeItem({
      answer: 'Here is the analysis',
      events: [
        {
          id: 'tool-a',
          completed: true,
          event: { type: 'tool_start', tool: 'get_financials', args: { ticker: 'AAPL' } },
          endEvent: { type: 'tool_end', tool: 'get_financials', args: { ticker: 'AAPL' }, result: '{"data":{}}', duration: 800 },
        },
        {
          id: 'tool-b',
          completed: true,
          event: { type: 'tool_start', tool: 'web_search', args: { query: 'Apple earnings' } },
          endEvent: { type: 'tool_end', tool: 'web_search', args: { query: 'Apple earnings' }, result: '{"data":{}}', duration: 600 },
        },
      ],
    });
    const out = formatExchangeForScrollback(item);
    const posFinancials = out.indexOf('Financials');
    const posWebSearch = out.indexOf('Web Search');
    expect(posFinancials).toBeGreaterThan(-1);
    expect(posWebSearch).toBeGreaterThan(-1);
    expect(posFinancials).toBeLessThan(posWebSearch); // financials before web search
    expect(out).toContain('Here is the analysis');
  });
});
