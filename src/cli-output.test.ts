/**
 * E2E tests for CLI output fixes:
 *  1. stripThinkingTags  — Ollama reasoning models leak <think>…</think> into
 *     final answers; the function must remove them completely.
 *  2. formatExchangeForScrollback — completed exchange must contain the user
 *     query, the full answer, and timing info so nothing is lost when flushed
 *     to the terminal's native scroll buffer.
 *  3. flushExchangeToScrollback (integration) — the function must stop/restart
 *     the TUI, erase the live-view, write the exchange to stdout, and clear the
 *     chat-log so the next query starts from a clean slate.
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { stripThinkingTags } from './agent/agent.js';
import { formatDuration, formatExchangeForScrollback } from './utils/scrollback.js';
import type { HistoryItem } from './types.js';

// Strip ANSI escape codes for structural assertions.
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 'test-1',
    query: 'What is the stock price of AAPL?',
    events: [],
    answer: 'AAPL is trading at $175.',
    status: 'complete',
    duration: 4200,
    ...overrides,
  };
}

// ─── stripThinkingTags ────────────────────────────────────────────────────────

describe('stripThinkingTags', () => {
  test('leaves plain text unchanged', () => {
    expect(stripThinkingTags('Hello world')).toBe('Hello world');
  });

  test('removes a full <think>…</think> block', () => {
    const input = '<think>Let me reason step by step.</think>The answer is 42.';
    expect(stripThinkingTags(input)).toBe('The answer is 42.');
  });

  test('is case-insensitive for THINK tags', () => {
    const input = '<THINK>Internal reasoning</THINK>Result.';
    expect(stripThinkingTags(input)).toBe('Result.');
  });

  test('removes a multiline think block', () => {
    const input = '<think>\nStep 1: gather data\nStep 2: analyse\n</think>\nFinal answer.';
    expect(stripThinkingTags(input)).toBe('Final answer.');
  });

  test('removes multiple think blocks', () => {
    const input = '<think>first</think>Middle<think>second</think>End.';
    expect(stripThinkingTags(input)).toBe('MiddleEnd.');
  });

  test('removes an orphan </think> tag at the start — exact Ollama bug pattern', () => {
    // Ollama sometimes emits the reasoning inline and ends with </think>\nAnswer.
    const input = 'Some reasoning here\n</think>\nEUR 12.25';
    expect(stripThinkingTags(input)).toBe('EUR 12.25');
  });

  test('removes everything before an orphan </think>', () => {
    const input = 'prefix garbage</think>Clean answer.';
    expect(stripThinkingTags(input)).toBe('Clean answer.');
  });

  test('trims leading/trailing whitespace after stripping', () => {
    const input = '<think>noise</think>   answer with spaces   ';
    expect(stripThinkingTags(input)).toBe('answer with spaces');
  });

  test('returns empty string when the entire response is a think block', () => {
    expect(stripThinkingTags('<think>all internal</think>')).toBe('');
  });

  test('handles text with no tags — no mutation', () => {
    const text = 'Revenue grew 12% YoY to $94.9B.';
    expect(stripThinkingTags(text)).toBe(text);
  });
});

// ─── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
  test('formats sub-second durations in ms', () => {
    expect(formatDuration(850)).toBe('850ms');
  });

  test('formats exactly 1 second', () => {
    expect(formatDuration(1000)).toBe('1s');
  });

  test('rounds to nearest second', () => {
    expect(formatDuration(1499)).toBe('1s');
    expect(formatDuration(1500)).toBe('2s');
  });

  test('formats minutes and seconds', () => {
    expect(formatDuration(90_000)).toBe('1m 30s');
  });

  test('formats whole minutes', () => {
    expect(formatDuration(120_000)).toBe('2m 0s');
  });
});

// ─── formatExchangeForScrollback ──────────────────────────────────────────────

describe('formatExchangeForScrollback', () => {
  test('output contains the user query text', () => {
    const output = stripAnsi(formatExchangeForScrollback(makeItem()));
    expect(output).toContain('What is the stock price of AAPL?');
  });

  test('output contains the answer text', () => {
    const output = stripAnsi(formatExchangeForScrollback(makeItem()));
    expect(output).toContain('AAPL is trading at $175.');
  });

  test('output includes the formatted duration', () => {
    const output = stripAnsi(formatExchangeForScrollback(makeItem({ duration: 4200 })));
    expect(output).toContain('4s');
  });

  test('output does NOT include duration when not set', () => {
    const output = stripAnsi(formatExchangeForScrollback(makeItem({ duration: undefined })));
    expect(output).not.toContain('✻');
  });

  test('shows interrupted label when status is interrupted and answer is empty', () => {
    const item = makeItem({ status: 'interrupted', answer: '' });
    const output = stripAnsi(formatExchangeForScrollback(item));
    expect(output).toContain('Interrupted');
  });

  test('shows error label when status is error and answer is empty', () => {
    const item = makeItem({ status: 'error', answer: '' });
    const output = stripAnsi(formatExchangeForScrollback(item));
    expect(output).toContain('Error');
  });

  test('answer text takes priority over status labels when answer is present', () => {
    // Even if status is interrupted, a partial answer should be shown if non-empty.
    const item = makeItem({ status: 'interrupted', answer: 'Partial result here.' });
    const output = stripAnsi(formatExchangeForScrollback(item));
    expect(output).toContain('Partial result here.');
    expect(output).not.toContain('Interrupted');
  });

  test('output starts and ends with a newline for clean scrollback separation', () => {
    const output = formatExchangeForScrollback(makeItem());
    expect(output.startsWith('\n')).toBe(true);
    expect(output.endsWith('\n')).toBe(true);
  });

  test('query marker ❯ appears before the answer marker ⏺', () => {
    const output = stripAnsi(formatExchangeForScrollback(makeItem()));
    const qIdx = output.indexOf('❯');
    const aIdx = output.indexOf('⏺');
    expect(qIdx).toBeGreaterThan(-1);
    expect(aIdx).toBeGreaterThan(-1);
    expect(qIdx).toBeLessThan(aIdx);
  });

  test('long answer is rendered in full — no truncation', () => {
    const longAnswer = 'A'.repeat(2000);
    const output = stripAnsi(formatExchangeForScrollback(makeItem({ answer: longAnswer })));
    expect(output).toContain(longAnswer);
  });
});

// ─── flushExchangeToScrollback (integration) ──────────────────────────────────

describe('flushExchangeToScrollback integration', () => {
  // We test the observable side-effects: stdout writes and method calls on the
  // TUI / chatLog collaborators, without spawning a real terminal.

  let writtenChunks: string[];
  let tuiStopped: boolean;
  let tuiStarted: boolean;
  let renderForceCalled: boolean;
  let chatLogCleared: boolean;

  // Minimal TUI stub with a fake previousLines array.
  function makeTuiStub(prevLineCount = 5) {
    return {
      previousLines: new Array(prevLineCount).fill('line'),
      stop:  () => { tuiStopped = true; },
      start: () => { tuiStarted = true; },
      requestRender: (force?: boolean) => { if (force) renderForceCalled = true; },
    };
  }

  function makeChatLogStub() {
    return { clearAll: () => { chatLogCleared = true; } };
  }

  beforeEach(() => {
    writtenChunks = [];
    tuiStopped = false;
    tuiStarted = false;
    renderForceCalled = false;
    chatLogCleared = false;

    // Intercept stdout.write — restore after each test via the returned original.
    const orig = process.stdout.write.bind(process.stdout);
    mock.module('process', () => ({})); // not needed — we patch directly
    process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
      writtenChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stdout.write;

    // Register cleanup so the real write is restored even on test failure.
    // (Bun's afterEach is not available in all versions; we restore inline.)
    (globalThis as Record<string, unknown>).__origStdoutWrite = orig;
  });

  function restore() {
    const orig = (globalThis as Record<string, unknown>).__origStdoutWrite as typeof process.stdout.write;
    if (orig) process.stdout.write = orig;
  }

  async function runFlush(prevLineCount = 5) {
    // Dynamically import so the patched stdout is in place when the module runs.
    const { flushExchangeToScrollback } = await import('./cli.js');
    const tui = makeTuiStub(prevLineCount) as unknown as import('@mariozechner/pi-tui').TUI;
    const chatLog = makeChatLogStub() as unknown as import('./components/index.js').ChatLogComponent;
    flushExchangeToScrollback(tui, chatLog, makeItem());
  }

  test('stops and restarts the TUI', async () => {
    try {
      await runFlush();
      expect(tuiStopped).toBe(true);
      expect(tuiStarted).toBe(true);
    } finally { restore(); }
  });

  test('calls requestRender() without force to avoid wiping scrollback', async () => {
    // IMPORTANT: requestRender(true) would trigger fullRender(clear=true) which writes
    // \x1b[3J — erasing the entire terminal scrollback buffer including the exchange
    // we just flushed.  The implementation must call requestRender() with no argument.
    try {
      await runFlush();
      expect(renderForceCalled).toBe(false);
    } finally { restore(); }
  });

  test('clears the chat log component', async () => {
    try {
      await runFlush();
      expect(chatLogCleared).toBe(true);
    } finally { restore(); }
  });

  test('writes ANSI cursor-up escape when TUI had rendered lines', async () => {
    try {
      await runFlush(5);
      const combined = writtenChunks.join('');
      // Expect \x1b[<n>A (cursor up) somewhere in the output
      expect(combined).toMatch(/\x1b\[\d+A/);
    } finally { restore(); }
  });

  test('writes ANSI clear-to-end-of-screen escape', async () => {
    try {
      await runFlush(5);
      const combined = writtenChunks.join('');
      expect(combined).toContain('\x1b[J');
    } finally { restore(); }
  });

  test('does NOT write cursor-up escape when TUI had zero rendered lines', async () => {
    try {
      await runFlush(0);
      const combined = writtenChunks.join('');
      expect(combined).not.toMatch(/\x1b\[\d+A/);
    } finally { restore(); }
  });

  test('exchange output written to stdout contains the query and answer', async () => {
    try {
      await runFlush();
      const combined = stripAnsi(writtenChunks.join(''));
      expect(combined).toContain('What is the stock price of AAPL?');
      expect(combined).toContain('AAPL is trading at $175.');
    } finally { restore(); }
  });
});
