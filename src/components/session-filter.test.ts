/**
 * TDD tests for SessionBrowserComponent filter logic (Feature 10).
 *
 * Tests the session filter's:
 * - Filter-by-query filtering (keyword and regex)
 * - Invalid regex fallback to literal match
 * - Empty filter shows all sessions
 * - Keyboard: printable chars append to filter, backspace removes, Esc calls onSelect(null)
 */
import { describe, it, expect } from 'bun:test';
import { createSessionSelector } from './select-list.js';
import { Container, Text } from '@mariozechner/pi-tui';
import type { SessionIndexEntry } from '../utils/session-store.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const makeSessions = (overrides: Partial<SessionIndexEntry>[] = []): SessionIndexEntry[] => [
  { id: 's1', name: 'session-abc', firstQuery: 'AAPL stock analysis', file: 's1.json', created: 1000, lastModified: 1000, queryCount: 1 },
  { id: 's2', name: 'session-def', firstQuery: 'Bitcoin price forecast', file: 's2.json', created: 2000, lastModified: 2000, queryCount: 1 },
  { id: 's3', name: 'session-ghi', firstQuery: 'NVDA DCF valuation', file: 's3.json', created: 3000, lastModified: 3000, queryCount: 1 },
  ...overrides.map((o, i) => ({
    id: `sx${i}`,
    name: `extra-${i}`,
    firstQuery: 'extra query',
    file: `sx${i}.json`,
    created: 4000 + i,
    lastModified: 4000 + i,
    queryCount: 1,
    ...o,
  })),
];

// ---------------------------------------------------------------------------
// Helper: get all rendered text strings from a Container tree
// ---------------------------------------------------------------------------
function collectTexts(node: Container): string[] {
  const results: string[] = [];
  const children = (node as unknown as { children: unknown[] }).children;
  for (const child of children) {
    if ((child as { text?: string }).text !== undefined) {
      results.push((child as { text: string }).text);
    }
    if ((child as { children?: unknown[] }).children) {
      results.push(...collectTexts(child as Container));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Helper: get items from the VimSelectList (reflecting filtered results)
// ---------------------------------------------------------------------------
function getListItems(browser: unknown): Array<{ value: string; label: string }> {
  const list = (browser as unknown as { list: { items: Array<{ value: string; label: string }> } | null }).list;
  return list?.items ?? [];
}

// ---------------------------------------------------------------------------
// Helper: extract the private filter value from the component
// ---------------------------------------------------------------------------
function getFilter(comp: unknown): string {
  return (comp as unknown as { filter: string }).filter;
}

// ---------------------------------------------------------------------------
// Filter logic — getFilteredSessions() via handleInput
// ---------------------------------------------------------------------------
describe('SessionBrowserComponent — filtering', () => {
  it('shows all sessions when filter is empty', () => {
    const browser = createSessionSelector(makeSessions(), () => {});
    const items = getListItems(browser);
    // All three session queries should be visible
    expect(items.some((i) => i.label.includes('AAPL'))).toBe(true);
    expect(items.some((i) => i.label.includes('Bitcoin'))).toBe(true);
    expect(items.some((i) => i.label.includes('NVDA'))).toBe(true);
  });

  it('filters sessions by keyword', () => {
    const browser = createSessionSelector(makeSessions(), () => {});
    (browser as unknown as { handleInput: (k: string) => void }).handleInput('A');
    (browser as unknown as { handleInput: (k: string) => void }).handleInput('A');
    (browser as unknown as { handleInput: (k: string) => void }).handleInput('P');
    (browser as unknown as { handleInput: (k: string) => void }).handleInput('L');

    const items = getListItems(browser);
    expect(items.some((i) => i.label.includes('AAPL'))).toBe(true);
    expect(items.some((i) => i.label.includes('Bitcoin'))).toBe(false);
    expect(items.some((i) => i.label.includes('NVDA'))).toBe(false);
  });

  it('is case-insensitive', () => {
    const browser = createSessionSelector(makeSessions(), () => {});
    for (const ch of 'bitcoin') {
      (browser as unknown as { handleInput: (k: string) => void }).handleInput(ch);
    }
    const items = getListItems(browser);
    expect(items.some((i) => i.label.includes('Bitcoin'))).toBe(true);
    expect(items.some((i) => i.label.includes('AAPL'))).toBe(false);
  });

  it('shows no-match message when filter returns empty', () => {
    const browser = createSessionSelector(makeSessions(), () => {});
    for (const ch of 'zzz_no_match') {
      (browser as unknown as { handleInput: (k: string) => void }).handleInput(ch);
    }
    const texts = collectTexts(browser as Container);
    expect(texts.some((t) => t.includes('No sessions match'))).toBe(true);
    // list should be null — no items shown
    expect(getListItems(browser)).toHaveLength(0);
  });

  it('supports regex filtering', () => {
    const browser = createSessionSelector(makeSessions(), () => {});
    for (const ch of 'AAPL|Bitcoin') {
      (browser as unknown as { handleInput: (k: string) => void }).handleInput(ch);
    }
    const items = getListItems(browser);
    expect(items.some((i) => i.label.includes('AAPL'))).toBe(true);
    expect(items.some((i) => i.label.includes('Bitcoin'))).toBe(true);
    expect(items.some((i) => i.label.includes('NVDA'))).toBe(false);
  });

  it('falls back to literal match when regex is invalid', () => {
    const browser = createSessionSelector(makeSessions(), () => {});
    // '[invalid' is an invalid regex — should fall back to literal '[invalid'
    for (const ch of '[invalid') {
      (browser as unknown as { handleInput: (k: string) => void }).handleInput(ch);
    }
    // Should not throw; shows no-match (nothing contains "[invalid")
    const texts = collectTexts(browser as Container);
    expect(texts.some((t) => t.includes('No sessions match'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Keyboard input
// ---------------------------------------------------------------------------
describe('SessionBrowserComponent — keyboard input', () => {
  it('appends printable chars to the filter', () => {
    const browser = createSessionSelector(makeSessions(), () => {});
    for (const ch of 'AAPL') {
      (browser as unknown as { handleInput: (k: string) => void }).handleInput(ch);
    }
    expect(getFilter(browser)).toBe('AAPL');
  });

  it('backspace removes last char from filter', () => {
    const browser = createSessionSelector(makeSessions(), () => {});
    for (const ch of 'AAPL') {
      (browser as unknown as { handleInput: (k: string) => void }).handleInput(ch);
    }
    (browser as unknown as { handleInput: (k: string) => void }).handleInput('\x7f');
    expect(getFilter(browser)).toBe('AAP');
  });

  it('backspace on empty filter does nothing', () => {
    const browser = createSessionSelector(makeSessions(), () => {});
    (browser as unknown as { handleInput: (k: string) => void }).handleInput('\x7f');
    expect(getFilter(browser)).toBe('');
  });

  it('Esc calls onSelect(null)', () => {
    let selected: string | null | undefined = undefined;
    const browser = createSessionSelector(makeSessions(), (id) => { selected = id; });
    // ESC key = \x1b
    (browser as unknown as { handleInput: (k: string) => void }).handleInput('\x1b');
    expect(selected).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty sessions list
// ---------------------------------------------------------------------------
describe('createSessionSelector — empty sessions', () => {
  it('renders a "no sessions" message for empty input', () => {
    const browser = createSessionSelector([], () => {});
    const texts = collectTexts(browser as Container);
    expect(texts.some((t) => t.toLowerCase().includes('no saved sessions'))).toBe(true);
  });

  it('calls onSelect(null) on Esc for empty sessions', () => {
    let selected: string | null | undefined = undefined;
    const browser = createSessionSelector([], (id) => { selected = id; });
    (browser as unknown as { handleInput: (k: string) => void }).handleInput('\x1b');
    expect(selected).toBeNull();
  });
});
