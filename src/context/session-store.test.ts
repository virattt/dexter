import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { SessionStore } from './session-store.js';
import { MAX_NOTE_BYTES } from './constants.js';

let root: string;
let store: SessionStore;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dexter-session-'));
  store = new SessionStore(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('notes', () => {
  test('write, read, append, list, search', async () => {
    await store.writeNote('aapl.md', 'AAPL revenue FY25: $416B\n');
    await store.appendNote('aapl.md', 'AAPL gross margin: 46.5%\n');
    await store.writeNote('plan/todo.md', 'compare MSFT next');

    expect(await store.readNote('aapl.md')).toBe('AAPL revenue FY25: $416B\nAAPL gross margin: 46.5%\n');
    expect(await store.listNotes()).toEqual(['aapl.md', 'plan/todo.md']);
    expect(await store.listNotes('plan/')).toEqual(['plan/todo.md']);

    const hits = await store.searchNotes('margin');
    expect(hits).toEqual([{ path: 'aapl.md', line: 2, text: 'AAPL gross margin: 46.5%' }]);
  });

  test('line ranges, including negative indexes', async () => {
    await store.writeNote('n.md', 'a\nb\nc\nd');
    expect(await store.readNote('n.md', 2, 3)).toBe('b\nc');
    expect(await store.readNote('n.md', -2)).toBe('c\nd');
  });

  test('rejects unsafe paths', async () => {
    await expect(store.writeNote('../x.md', 'x')).rejects.toThrow('Invalid note path');
    await expect(store.writeNote('a//b.md', 'x')).rejects.toThrow('Invalid note path');
    await expect(store.writeNote('~/b.md', 'x')).rejects.toThrow('Invalid note path');
    await expect(store.writeNote('/etc/passwd', 'x')).rejects.toThrow('Invalid note path');
  });

  test('enforces the per-file byte cap', async () => {
    await expect(store.writeNote('big.md', 'x'.repeat(MAX_NOTE_BYTES + 1))).rejects.toThrow('exceeds');
    await store.writeNote('big.md', 'x'.repeat(MAX_NOTE_BYTES - 1));
    await expect(store.appendNote('big.md', 'xx')).rejects.toThrow('would exceed');
  });

  test('thread hint returns raw notes when small, null when empty', async () => {
    expect(await store.buildThreadHint('gpt-5.5')).toBeNull();
    await store.writeNote('a.md', 'hello');
    expect(await store.buildThreadHint('gpt-5.5')).toBe('## a.md\nhello');
  });
});

describe('history', () => {
  test('archive, list windows, list items, read item, search', async () => {
    const w1 = store.windowState.currentWindowId;
    const n = await store.archiveWindow(w1, [
      new HumanMessage('what is AAPL revenue?'),
      new AIMessage({ content: '', tool_calls: [{ id: 't1', name: 'get_financials', args: { ticker: 'AAPL' } }] }),
      new ToolMessage({ content: '{"revenue": 416000000000}', tool_call_id: 't1', name: 'get_financials' }),
      new AIMessage('AAPL revenue is $416B.'),
    ]);
    expect(n).toBe(4);

    expect(await store.listWindows()).toEqual([{ windowId: w1, itemCount: 4 }]);

    const items = await store.listItems({ role: 'tool' });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ windowId: w1, ordinal: 2, role: 'tool', toolName: 'get_financials' });

    const item = await store.readItem(w1, 3);
    expect(item?.content).toBe('AAPL revenue is $416B.');
    expect(await store.readItem(w1, 99)).toBeNull();

    const hits = await store.searchHistory('416');
    expect(hits.map(h => h.ordinal)).toEqual([2, 3]);

    const assistantHits = await store.searchHistory('get_financials', { role: 'assistant' });
    expect(assistantHits.map(h => h.ordinal)).toEqual([1]);
  });

  test('advanceWindow chains IDs and resets flags', () => {
    const first = store.windowState;
    store.reminderSent = true;
    store.fallbackSent = true;
    store.requestNewWindow();

    const next = store.advanceWindow();
    expect(next.windowNumber).toBe(2);
    expect(next.firstWindowId).toBe(first.firstWindowId);
    expect(next.previousWindowId).toBe(first.currentWindowId);
    expect(next.currentWindowId).not.toBe(first.currentWindowId);
    expect(store.reminderSent).toBe(false);
    expect(store.fallbackSent).toBe(false);
    expect(store.newWindowRequested).toBe(false);
  });
});
