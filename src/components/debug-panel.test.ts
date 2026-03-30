/**
 * Coverage tests for DebugPanelComponent.
 *
 * Tests logger subscription, refresh on new log entries, show/hide flag,
 * and dispose (unsubscribe).
 */
import { afterEach, beforeEach, describe, it, expect } from 'bun:test';
import { DebugPanelComponent } from './debug-panel.js';
import { logger } from '../utils/logger.js';

// Always clear the logger between tests to avoid cross-test contamination.
beforeEach(() => logger.clear());
afterEach(() => logger.clear());

function boxChildCount(panel: DebugPanelComponent): number {
  // DebugPanelComponent has one child: this.box (a Box)
  const panelChildren = (panel as unknown as { children: unknown[] }).children;
  const box = panelChildren[0] as { children?: unknown[] } | undefined;
  return box?.children?.length ?? 0;
}

describe('DebugPanelComponent — show=true', () => {
  it('starts with an empty box when no logs exist', () => {
    const panel = new DebugPanelComponent(8, true);
    expect(boxChildCount(panel)).toBe(0);
    panel.dispose();
  });

  it('populates box when logger emits after construction', () => {
    const panel = new DebugPanelComponent(8, true);
    logger.info('hello from test');
    // After the logger emits, refresh should have run
    expect(boxChildCount(panel)).toBeGreaterThan(0);
    panel.dispose();
  });

  it('shows a debug header line + log entries', () => {
    const panel = new DebugPanelComponent(8, true);
    logger.info('msg1');
    logger.warn('msg2');
    // 1 header + 2 entries = 3 children in box
    expect(boxChildCount(panel)).toBe(3);
    panel.dispose();
  });

  it('respects maxLines and trims to the last N entries', () => {
    const panel = new DebugPanelComponent(2, true);
    logger.debug('a');
    logger.debug('b');
    logger.debug('c'); // only last 2 displayed
    // 1 header + 2 entries
    expect(boxChildCount(panel)).toBe(3);
    panel.dispose();
  });

  it('supports all log levels (debug, info, warn, error)', () => {
    const panel = new DebugPanelComponent(10, true);
    logger.debug('d', { key: 'val' });
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    // 1 header + 4 entries
    expect(boxChildCount(panel)).toBe(5);
    panel.dispose();
  });

  it('renders data field when log entry has data', () => {
    const panel = new DebugPanelComponent(8, true);
    logger.debug('with data', { foo: 'bar' });
    expect(boxChildCount(panel)).toBe(2); // header + 1 entry
    panel.dispose();
  });
});

describe('DebugPanelComponent — show=false', () => {
  it('stays empty even after log entries', () => {
    const panel = new DebugPanelComponent(8, false);
    logger.info('ignored');
    expect(boxChildCount(panel)).toBe(0);
    panel.dispose();
  });
});

describe('DebugPanelComponent — dispose', () => {
  it('unsubscribes from logger so subsequent log entries do not update box', () => {
    const panel = new DebugPanelComponent(8, true);
    panel.dispose();
    logger.info('after dispose');
    // Box should still be empty (no logs when disposed, dispose happened before log)
    expect(boxChildCount(panel)).toBe(0);
  });

  it('does not throw when dispose is called multiple times', () => {
    const panel = new DebugPanelComponent(8, true);
    expect(() => {
      panel.dispose();
      panel.dispose();
    }).not.toThrow();
  });
});
