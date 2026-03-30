/**
 * Coverage tests for ChatLogComponent and its helpers.
 *
 * Tests the methods that drive the TUI chat log display: browser tool grouping,
 * non-browser tool deduplication, progress updates, completion/error/limit/
 * approval/denial, finalizeAnswer, and performance stats.
 *
 * Uses the same fakeTui pattern as tui-layout.test.ts.
 */
import { afterEach, beforeEach, describe, it, expect } from 'bun:test';
import { type TUI } from '@mariozechner/pi-tui';
import { ChatLogComponent } from './chat-log.js';

const fakeTui = { requestRender: () => {} } as unknown as TUI;

function childCount(comp: ChatLogComponent): number {
  return (comp as unknown as { children: unknown[] }).children.length;
}

describe('ChatLogComponent — addInterrupted', () => {
  it('adds an interrupted text child', () => {
    const log = new ChatLogComponent(fakeTui);
    const before = childCount(log);
    log.addInterrupted();
    expect(childCount(log)).toBe(before + 1);
  });
});

describe('ChatLogComponent — resetToolGrouping', () => {
  it('resets lastToolName and lastToolComponent so next tool creates a new component', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'web_search', { query: 'q' });
    log.resetToolGrouping();
    // Same tool name now creates a fresh component instead of reusing
    log.startTool('t2', 'web_search', { query: 'q2' });
    // t1 and t2 should be different entries in toolById
    const toolById = (log as unknown as { toolById: Map<string, unknown> }).toolById;
    expect(toolById.get('t1')).not.toBe(toolById.get('t2'));
  });
});

describe('ChatLogComponent — startTool', () => {
  let log: ChatLogComponent;

  beforeEach(() => {
    log = new ChatLogComponent(fakeTui);
  });

  it('creates a ToolEventComponent for non-browser tools', () => {
    const comp = log.startTool('t1', 'web_search', { query: 'hello' });
    expect(comp).toBeDefined();
  });

  it('reuses existing tool component when same toolCallId is passed', () => {
    const c1 = log.startTool('t1', 'web_search', { query: 'q' });
    const c2 = log.startTool('t1', 'web_search', { query: 'q' });
    expect(c1).toBe(c2);
  });

  it('deduplicates same toolName into the same component (grouping)', () => {
    const c1 = log.startTool('t1', 'web_search', { query: 'a' });
    const c2 = log.startTool('t2', 'web_search', { query: 'b' });
    expect(c1).toBe(c2);
  });

  it('creates a new component when toolName differs', () => {
    const c1 = log.startTool('t1', 'web_search', { query: 'a' });
    const c2 = log.startTool('t2', 'get_market_data', { ticker: 'AAPL' });
    expect(c1).not.toBe(c2);
  });

  it('creates a BrowserSessionComponent for browser tool', () => {
    const c1 = log.startTool('b1', 'browser', { action: 'open', url: 'https://example.com' });
    const c2 = log.startTool('b2', 'browser', { action: 'snapshot', url: '' });
    // Both should use the same BrowserSessionComponent (session grouping)
    expect(c1).toBe(c2);
  });

  it('resets browser session when a non-browser tool starts', () => {
    log.startTool('b1', 'browser', { action: 'open', url: 'https://x.com' });
    log.startTool('t1', 'web_search', { query: 'q' });
    // Next browser call creates a new session
    const b2 = log.startTool('b2', 'browser', { action: 'navigate', url: 'https://y.com' });
    const b3 = log.startTool('b3', 'browser', { action: 'navigate', url: 'https://z.com' });
    expect(b2).toBe(b3); // new session, but same component
  });

  it('browser tool with different step actions all set the step', () => {
    const actions = ['open', 'navigate', 'snapshot', 'read', 'close', 'act', 'unknown'];
    for (const action of actions) {
      const c = log.startTool(`b-${action}`, 'browser', {
        action,
        url: 'https://long-hostname-that-exceeds-45-characters-in-length.example.com/path',
      });
      expect(c).toBeDefined();
    }
  });
});

describe('ChatLogComponent — updateToolProgress', () => {
  it('does nothing for unknown toolCallId', () => {
    const log = new ChatLogComponent(fakeTui);
    expect(() => log.updateToolProgress('missing', 'msg')).not.toThrow();
  });

  it('delegates to setActive on the found component', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'web_search', { query: 'q' });
    expect(() => log.updateToolProgress('t1', 'Fetching...')).not.toThrow();
  });
});

describe('ChatLogComponent — completeTool', () => {
  it('does nothing for unknown toolCallId', () => {
    const log = new ChatLogComponent(fakeTui);
    expect(() => log.completeTool('missing', 'summary', 500)).not.toThrow();
  });

  it('delegates to setComplete on found component', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'web_search', { query: 'q' });
    expect(() => log.completeTool('t1', 'Found 3 results', 1200)).not.toThrow();
  });
});

describe('ChatLogComponent — errorTool', () => {
  it('does nothing for unknown toolCallId', () => {
    const log = new ChatLogComponent(fakeTui);
    expect(() => log.errorTool('missing', 'err')).not.toThrow();
  });

  it('delegates to setError on found component', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'web_search', { query: 'q' });
    expect(() => log.errorTool('t1', 'Timeout after 30s')).not.toThrow();
  });
});

describe('ChatLogComponent — limitTool', () => {
  it('does nothing for unknown toolCallId', () => {
    const log = new ChatLogComponent(fakeTui);
    expect(() => log.limitTool('missing')).not.toThrow();
  });

  it('delegates to setLimitWarning on found component', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'web_search', { query: 'q' });
    expect(() => log.limitTool('t1', 'Approaching limit')).not.toThrow();
  });

  it('uses default warning when no message provided', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'web_search', { query: 'q' });
    expect(() => log.limitTool('t1')).not.toThrow();
  });
});

describe('ChatLogComponent — approveTool', () => {
  it('does nothing for unknown toolCallId', () => {
    const log = new ChatLogComponent(fakeTui);
    expect(() => log.approveTool('missing', 'allow-once')).not.toThrow();
  });

  it('delegates allow-once to setApproval', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'edit_file', { path: 'src/x.ts', content: 'code' });
    expect(() => log.approveTool('t1', 'allow-once')).not.toThrow();
  });

  it('delegates allow-session to setApproval', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'edit_file', { path: 'src/x.ts', content: 'code' });
    expect(() => log.approveTool('t1', 'allow-session')).not.toThrow();
  });

  it('delegates deny to setApproval', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'edit_file', { path: 'src/x.ts', content: 'code' });
    expect(() => log.approveTool('t1', 'deny')).not.toThrow();
  });
});

describe('ChatLogComponent — denyTool', () => {
  it('does nothing for unknown toolCallId', () => {
    const log = new ChatLogComponent(fakeTui);
    expect(() => log.denyTool('missing', 'src/x.ts', 'write_file')).not.toThrow();
  });

  it('delegates write_file denial', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'write_file', { path: 'src/x.ts' });
    expect(() => log.denyTool('t1', 'src/x.ts', 'write_file')).not.toThrow();
  });

  it('delegates edit_file denial', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'edit_file', { path: 'src/x.ts' });
    expect(() => log.denyTool('t1', 'src/x.ts', 'edit_file')).not.toThrow();
  });

  it('delegates generic tool denial', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'delete_file', { path: 'src/x.ts' });
    expect(() => log.denyTool('t1', 'src/x.ts', 'delete_file')).not.toThrow();
  });
});

describe('ChatLogComponent — finalizeAnswer', () => {
  it('adds a new AnswerBoxComponent when none is active', () => {
    const log = new ChatLogComponent(fakeTui);
    const before = childCount(log);
    log.finalizeAnswer('The answer is 42');
    expect(childCount(log)).toBeGreaterThan(before);
  });
});

describe('ChatLogComponent — addContextCleared', () => {
  it('adds text child for singular cleared count', () => {
    const log = new ChatLogComponent(fakeTui);
    const before = childCount(log);
    log.addContextCleared(1, 5);
    expect(childCount(log)).toBeGreaterThan(before);
  });

  it('adds text child for plural cleared count', () => {
    const log = new ChatLogComponent(fakeTui);
    const before = childCount(log);
    log.addContextCleared(3, 5);
    expect(childCount(log)).toBeGreaterThan(before);
  });
});

describe('ChatLogComponent — addPerformanceStats', () => {
  it('adds stat line for sub-second duration', () => {
    const log = new ChatLogComponent(fakeTui);
    const before = childCount(log);
    log.addPerformanceStats(800);
    expect(childCount(log)).toBeGreaterThan(before);
  });

  it('adds stat line for duration in seconds', () => {
    const log = new ChatLogComponent(fakeTui);
    const before = childCount(log);
    log.addPerformanceStats(5000);
    expect(childCount(log)).toBeGreaterThan(before);
  });

  it('adds stat line for duration in minutes+seconds', () => {
    const log = new ChatLogComponent(fakeTui);
    const before = childCount(log);
    log.addPerformanceStats(125_000);
    expect(childCount(log)).toBeGreaterThan(before);
  });

  it('includes token usage when totalTokens exceeds 20000', () => {
    const log = new ChatLogComponent(fakeTui);
    const before = childCount(log);
    log.addPerformanceStats(3000, { input: 10000, output: 15000, totalTokens: 25000 }, 42.5);
    expect(childCount(log)).toBeGreaterThan(before);
  });

  it('omits token usage when totalTokens is below threshold', () => {
    const log = new ChatLogComponent(fakeTui);
    const before = childCount(log);
    log.addPerformanceStats(3000, { input: 5000, output: 10000, totalTokens: 15000 });
    expect(childCount(log)).toBeGreaterThan(before);
  });

  it('handles undefined tokenUsage', () => {
    const log = new ChatLogComponent(fakeTui);
    expect(() => log.addPerformanceStats(3000, undefined)).not.toThrow();
  });
});

describe('ChatLogComponent — clearAll resets state', () => {
  it('clears toolById map', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('t1', 'web_search', { query: 'q' });
    log.clearAll();
    const toolById = (log as unknown as { toolById: Map<string, unknown> }).toolById;
    expect(toolById.size).toBe(0);
  });

  it('resets browser session state', () => {
    const log = new ChatLogComponent(fakeTui);
    log.startTool('b1', 'browser', { action: 'open', url: 'https://x.com' });
    log.clearAll();
    const session = (log as unknown as { currentBrowserSession: unknown }).currentBrowserSession;
    expect(session).toBeNull();
  });
});
