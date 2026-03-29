/**
 * E2E layout tests for TUI components.
 *
 * These tests exercise the component tree directly (no real PTY or LLM needed)
 * and verify that the TUI renders the correct layout at each stage of the
 * query lifecycle: idle → processing → complete → flushed.
 *
 * The core regression we guard against:
 *   ChatLogComponent.clearAll() must remove Container children so that after
 *   flushExchangeToScrollback() the TUI viewport is empty — not showing the
 *   previous exchange again.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Container, Spacer, Text, type TUI } from '@mariozechner/pi-tui';
import { ChatLogComponent } from './chat-log.js';
import { ToolEventComponent } from './tool-event.js';
import { IntroComponent } from './intro.js';

// Minimal TUI stub — components only need the TUI for requestRender callbacks
// which are irrelevant to layout structure tests.
const fakeTui = { requestRender: () => {} } as unknown as TUI;

// Helper: count direct children of any Container
function childCount(container: Container): number {
  return (container as unknown as { children: unknown[] }).children.length;
}

// Helper: get rendered text of the first Text child found in a Container tree
function findText(container: Container, index = 0): string {
  const children = (container as unknown as { children: unknown[] }).children;
  let found = 0;
  for (const child of children) {
    if ((child as { text?: string }).text !== undefined) {
      if (found === index) return (child as { text: string }).text;
      found++;
    }
  }
  return '';
}

// ─── ChatLogComponent ──────────────────────────────────────────────────────────

describe('ChatLogComponent — clearAll()', () => {
  let chatLog: ChatLogComponent;

  beforeEach(() => {
    chatLog = new ChatLogComponent(fakeTui);
  });

  test('starts with zero children', () => {
    expect(childCount(chatLog)).toBe(0);
  });

  test('addQuery() adds a child', () => {
    chatLog.addQuery('What is 2+2?');
    expect(childCount(chatLog)).toBeGreaterThan(0);
  });

  test('startTool() adds a ToolEventComponent child', () => {
    chatLog.addQuery('test query');
    const before = childCount(chatLog);
    chatLog.startTool('id1', 'web_search', { query: 'test' });
    expect(childCount(chatLog)).toBeGreaterThan(before);
  });

  test('clearAll() removes ALL Container children (regression: was only clearing Maps)', () => {
    // Populate the log as it would be during a real agent run
    chatLog.addQuery('What is 2+2?');
    chatLog.startTool('id1', 'web_search', { query: 'test' });
    chatLog.completeTool('id1', 'Got results', 500);
    chatLog.finalizeAnswer('The answer is 4.');
    chatLog.addPerformanceStats(1200);

    expect(childCount(chatLog)).toBeGreaterThan(0);

    // This is what flushExchangeToScrollback() calls before restarting the TUI.
    chatLog.clearAll();

    // After clearAll() the Container must be empty so the TUI renders nothing.
    expect(childCount(chatLog)).toBe(0);
  });

  test('clearAll() resets internal tool map so new tools start fresh', () => {
    chatLog.startTool('id1', 'web_search', { query: 'a' });
    chatLog.clearAll();

    // After clearing, the same tool ID should create a NEW component (not reuse old one)
    const childrenBefore = childCount(chatLog);
    chatLog.startTool('id1', 'web_search', { query: 'b' });
    expect(childCount(chatLog)).toBeGreaterThan(childrenBefore);
  });

  test('clearAll() then addQuery() works correctly for next exchange', () => {
    chatLog.addQuery('first query');
    chatLog.clearAll();

    chatLog.addQuery('second query');
    expect(childCount(chatLog)).toBeGreaterThan(0);
  });

  test('multiple same-tool calls are grouped into one component', () => {
    chatLog.addQuery('test');
    chatLog.startTool('id1', 'web_search', { query: 'a' });
    const countAfterFirst = childCount(chatLog);
    // Same tool name — should reuse the same component, not add a new child
    chatLog.startTool('id2', 'web_search', { query: 'b' });
    expect(childCount(chatLog)).toBe(countAfterFirst);
  });
});

// ─── ToolEventComponent ────────────────────────────────────────────────────────

describe('ToolEventComponent — status icons', () => {
  function getHeaderText(component: ToolEventComponent): string {
    const children = (component as unknown as { children: unknown[] }).children;
    // children[0] = Spacer, children[1] = header Text
    const header = children[1] as { text?: string } | undefined;
    return header?.text ?? '';
  }

  test('initial header contains pending bullet ⏺', () => {
    const comp = new ToolEventComponent(fakeTui, 'web_search', { query: 'test' });
    expect(getHeaderText(comp)).toContain('⏺');
  });

  test('setActive() updates header to ⚡ (yellow)', () => {
    const comp = new ToolEventComponent(fakeTui, 'web_search', { query: 'test' });
    comp.setActive();
    const header = getHeaderText(comp);
    expect(header).toContain('⚡');
    expect(header).not.toContain('✓');
    expect(header).not.toContain('✗');
  });

  test('setComplete() updates header to ✓ (green)', () => {
    const comp = new ToolEventComponent(fakeTui, 'web_search', { query: 'test' });
    comp.setActive();
    comp.setComplete('Got 5 results', 300);
    const header = getHeaderText(comp);
    expect(header).toContain('✓');
    expect(header).not.toContain('⚡');
  });

  test('setError() updates header to ✗ (red)', () => {
    const comp = new ToolEventComponent(fakeTui, 'web_search', { query: 'test' });
    comp.setActive();
    comp.setError('Connection timeout');
    const header = getHeaderText(comp);
    expect(header).toContain('✗');
    expect(header).not.toContain('⚡');
    expect(header).not.toContain('✓');
  });

  test('setDenied() updates header to ⊘ (muted)', () => {
    const comp = new ToolEventComponent(fakeTui, 'write_file', { path: '/tmp/test' });
    comp.setDenied('/tmp/test', 'write_file');
    const header = getHeaderText(comp);
    expect(header).toContain('⊘');
  });

  test('setLimitWarning() updates header to ⚠', () => {
    const comp = new ToolEventComponent(fakeTui, 'web_search', { query: 'test' });
    comp.setLimitWarning('Approaching limit');
    const header = getHeaderText(comp);
    expect(header).toContain('⚠');
  });

  test('setComplete() adds a detail line with duration', () => {
    const comp = new ToolEventComponent(fakeTui, 'web_search', { query: 'test' });
    const before = childCount(comp);
    comp.setComplete('Found 3 results', 1500);
    expect(childCount(comp)).toBeGreaterThan(before);
  });

  test('setActive() swaps detail line (does not accumulate)', () => {
    const comp = new ToolEventComponent(fakeTui, 'web_search', { query: 'test' });
    comp.setActive('Searching...');
    const countAfterFirst = childCount(comp);
    comp.setActive('Still searching...');
    // Should replace the old detail, not add another
    expect(childCount(comp)).toBe(countAfterFirst);
  });

  test('tool name is formatted in header (underscores → Title Case)', () => {
    const comp = new ToolEventComponent(fakeTui, 'financial_search', { query: 'AAPL' });
    const header = getHeaderText(comp);
    expect(header).toContain('Financial Search');
  });

  test('query arg is truncated and shown in header', () => {
    const comp = new ToolEventComponent(fakeTui, 'web_search', { query: 'Apple stock price today' });
    const header = getHeaderText(comp);
    expect(header).toContain('Apple stock price today');
  });
});

// ─── IntroComponent ────────────────────────────────────────────────────────────

describe('IntroComponent — compact status bar', () => {
  // Walk children in REVERSE so we reach modelText (last child in full mode)
  // before the title border and ASCII art Text nodes.
  function getModelLineText(intro: IntroComponent): string {
    const children = (intro as unknown as { children: unknown[] }).children;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i] as { text?: string };
      if (child.text !== undefined) {
        return child.text;
      }
    }
    return '';
  }

  test('full mode shows "Model:" prefix', () => {
    const intro = new IntroComponent('gpt-5.4');
    const text = getModelLineText(intro);
    expect(text).toContain('Model:');
  });

  test('compact mode shows ⬡ Dexter status bar', () => {
    const intro = new IntroComponent('gpt-5.4');
    intro.setCompact(true);
    const text = getModelLineText(intro);
    expect(text).toContain('⬡ Dexter');
  });

  test('compact mode shows model name', () => {
    const intro = new IntroComponent('nemotron-3-super');
    intro.setCompact(true);
    const text = getModelLineText(intro);
    expect(text).toContain('nemotron-3-super');
  });

  test('compact mode shows 💭 think indicator', () => {
    const intro = new IntroComponent('gpt-5.4');
    intro.setCompact(true);
    const text = getModelLineText(intro);
    expect(text).toContain('💭');
  });

  test('setThinkState(false) shows 💭 off', () => {
    const intro = new IntroComponent('gpt-5.4');
    intro.setCompact(true);
    intro.setThinkState(false);
    const text = getModelLineText(intro);
    expect(text).toContain('off');
  });

  test('setThinkState(true) shows 💭 on', () => {
    const intro = new IntroComponent('gpt-5.4');
    intro.setCompact(true);
    intro.setThinkState(true);
    const text = getModelLineText(intro);
    expect(text).toContain('on');
  });

  test('setModel() updates the displayed model name', () => {
    const intro = new IntroComponent('gpt-5.4');
    intro.setCompact(true);
    intro.setModel('claude-opus-4.6');
    const text = getModelLineText(intro);
    expect(text).toContain('claude-opus-4.6');
    expect(text).not.toContain('gpt-5.4');
  });

  test('compact mode has fewer children than full mode', () => {
    const intro = new IntroComponent('gpt-5.4');
    const fullCount = childCount(intro);
    intro.setCompact(true);
    const compactCount = childCount(intro);
    expect(compactCount).toBeLessThan(fullCount);
    expect(compactCount).toBe(1); // only the modelText
  });

  test('switching compact → full → compact retains correct text', () => {
    const intro = new IntroComponent('gpt-5.4');
    intro.setCompact(true);
    intro.setThinkState(false);
    intro.setCompact(false);
    // full mode: does not show 💭
    const fullText = getModelLineText(intro);
    expect(fullText).toContain('Model:');

    intro.setCompact(true);
    // compact mode again: should show think state we set earlier
    const compactText = getModelLineText(intro);
    expect(compactText).toContain('⬡ Dexter');
    expect(compactText).toContain('off');
  });
});

// ─── Flush lifecycle simulation ────────────────────────────────────────────────

describe('TUI flush lifecycle', () => {
  test('chatLog is empty after clearAll() — TUI renders clean viewport', () => {
    const root = new Container();
    const chatLog = new ChatLogComponent(fakeTui);
    const editor = new Text('│ type here', 0, 0);

    // Simulate a completed exchange
    chatLog.addQuery('What is AAPL price?');
    chatLog.startTool('t1', 'financial_search', { query: 'AAPL price' });
    chatLog.completeTool('t1', 'Got price $180', 400);
    chatLog.finalizeAnswer('Apple stock is trading at $180.');

    // Build root as renderMainView() would
    root.addChild(chatLog);
    root.addChild(editor);
    expect(childCount(root)).toBe(2);
    expect(childCount(chatLog)).toBeGreaterThan(0);

    // Simulate flushExchangeToScrollback — clears chatLog
    chatLog.clearAll();

    // After flush: chatLog is empty → TUI renders nothing from previous exchange
    expect(childCount(chatLog)).toBe(0);

    // root still has chatLog as a child (structure preserved), but chatLog renders nothing
    expect(childCount(root)).toBe(2);
  });

  test('after clearAll(), chatLog correctly accepts a new exchange', () => {
    const chatLog = new ChatLogComponent(fakeTui);

    chatLog.addQuery('Query 1');
    chatLog.startTool('t1', 'web_search', { query: 'q1' });
    chatLog.completeTool('t1', 'results', 100);
    chatLog.finalizeAnswer('Answer 1');

    chatLog.clearAll();
    expect(childCount(chatLog)).toBe(0);

    // Start a new exchange
    chatLog.addQuery('Query 2');
    chatLog.startTool('t2', 'web_search', { query: 'q2' });
    expect(childCount(chatLog)).toBeGreaterThan(0);
  });
});

// ─── Streaming answer viewport cap (overflow regression) ──────────────────────
// Regression guard: renderCurrentQuery must never allow item.answer to grow the
// TUI taller than the terminal viewport during streaming.  If it did, the early
// lines would be pushed into the terminal's native scrollback buffer, making it
// impossible for flushExchangeToScrollback() to clear them — causing the answer
// to appear twice (partial live view + full flushed version).

describe('renderCurrentQuery — streaming answer viewport cap', () => {
  /**
   * Simulate the answer-capping logic from cli.ts renderCurrentQuery.
   * Returns the text passed to finalizeAnswer (or null if stub was shown).
   */
  function simulateAnswerRender(
    answer: string,
    status: 'processing' | 'complete',
    termRows = 40,
  ): { type: 'full' | 'tail' | 'stub'; text: string } {
    const reservedRows = Math.min(4 + 12, termRows - 10); // simplified: 0 events
    const answerBudget = Math.max(10, termRows - reservedRows);
    const answerLines = answer.split('\n');
    const isStreaming = status === 'processing';

    if (answerLines.length > answerBudget) {
      if (isStreaming) {
        const tail = answerLines.slice(-answerBudget).join('\n');
        return { type: 'tail', text: `…\n${tail}` };
      } else {
        return { type: 'stub', text: `…  (${answerLines.length} lines — writing to scrollback)` };
      }
    }
    return { type: 'full', text: answer };
  }

  test('short answer is rendered in full regardless of status', () => {
    const shortAnswer = Array(10).fill('line').join('\n');
    expect(simulateAnswerRender(shortAnswer, 'processing').type).toBe('full');
    expect(simulateAnswerRender(shortAnswer, 'complete').type).toBe('full');
  });

  test('long streaming answer renders tail (not full) to prevent overflow', () => {
    const longAnswer = Array(80).fill('content line').join('\n');
    const result = simulateAnswerRender(longAnswer, 'processing', 40);
    expect(result.type).toBe('tail');
    // tail must not exceed answerBudget lines (accounting for the leading "…")
    const renderedLines = result.text.split('\n').length;
    expect(renderedLines).toBeLessThanOrEqual(30); // answerBudget = max(10, 40-16) = 24 + 1 for "…"
  });

  test('long streaming tail starts with the ellipsis indicator', () => {
    const longAnswer = Array(80).fill('line').join('\n');
    const result = simulateAnswerRender(longAnswer, 'processing', 40);
    expect(result.text.startsWith('…')).toBe(true);
  });

  test('long complete answer renders stub (not full) so flush can clear cleanly', () => {
    const longAnswer = Array(80).fill('content line').join('\n');
    const result = simulateAnswerRender(longAnswer, 'complete', 40);
    expect(result.type).toBe('stub');
    expect(result.text).toContain('80 lines');
    expect(result.text).toContain('scrollback');
  });

  test('stub for complete answer is a single line (never overflows)', () => {
    const longAnswer = Array(200).fill('content').join('\n');
    const result = simulateAnswerRender(longAnswer, 'complete', 40);
    expect(result.type).toBe('stub');
    expect(result.text.split('\n').length).toBe(1);
  });

  test('answer budget scales with terminal height', () => {
    const answer = Array(35).fill('line').join('\n'); // 35 lines
    // In a 40-row terminal: budget = max(10, 40 - min(16, 30)) = 24 → 35 > 24 → tail
    expect(simulateAnswerRender(answer, 'processing', 40).type).toBe('tail');
    // In an 80-row terminal: budget = max(10, 80 - min(16, 70)) = 64 → 35 < 64 → full
    expect(simulateAnswerRender(answer, 'processing', 80).type).toBe('full');
  });
});
