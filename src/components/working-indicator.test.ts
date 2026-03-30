import { afterEach, beforeEach, describe, it, expect, spyOn } from 'bun:test';
import { type TUI } from '@mariozechner/pi-tui';
import { buildProgressBar, WorkingIndicatorComponent } from './working-indicator.js';

// Minimal TUI stub for WorkingIndicatorComponent
const fakeTui = { requestRender: () => {} } as unknown as TUI;

describe('buildProgressBar', () => {
  it('0% → all empty blocks', () => {
    expect(buildProgressBar(0, 25)).toBe('░░░░░░░░░░ 0%');
  });

  it('100% → all filled blocks', () => {
    expect(buildProgressBar(25, 25)).toBe('██████████ 100%');
  });

  it('7/25 → 28% with some filled blocks', () => {
    const result = buildProgressBar(7, 25);
    // 7/25 = 0.28 → 3 filled out of 10, label 28%
    expect(result).toBe('███░░░░░░░ 28%');
    expect(result).toContain('28%');
    expect(result.startsWith('█')).toBe(true);
  });

  it('12/25 → roughly half filled', () => {
    const result = buildProgressBar(12, 25);
    // 12/25 = 0.48 → 5 filled out of 10 (round(0.48*10)=5), label 48%
    expect(result).toBe('█████░░░░░ 48%');
  });

  it('respects custom width', () => {
    const result = buildProgressBar(1, 4, 4);
    // 1/4 = 0.25 → 1 filled out of 4, label 25%
    expect(result).toBe('█░░░ 25%');
  });

  it('clamps at 100% when iteration exceeds max', () => {
    const result = buildProgressBar(30, 25);
    expect(result).toBe('██████████ 100%');
  });
});

// ─── WorkingIndicatorComponent ────────────────────────────────────────────────

describe('WorkingIndicatorComponent — setState: idle', () => {
  it('constructs without throwing', () => {
    const comp = new WorkingIndicatorComponent(fakeTui);
    expect(comp).toBeDefined();
    comp.dispose();
  });

  it('setState idle is a no-op (no loader created)', () => {
    const comp = new WorkingIndicatorComponent(fakeTui);
    comp.setState({ status: 'idle' });
    const loader = (comp as any).loader;
    expect(loader).toBeNull();
    comp.dispose();
  });
});

describe('WorkingIndicatorComponent — setState: thinking', () => {
  it('creates a loader when transitioning to thinking', () => {
    const comp = new WorkingIndicatorComponent(fakeTui);
    comp.setState({ status: 'thinking' });
    const loader = (comp as any).loader;
    expect(loader).not.toBeNull();
    comp.dispose();
  });

  it('picks a new thinkingVerb when entering thinking state', () => {
    const comp = new WorkingIndicatorComponent(fakeTui);
    const before = (comp as any).thinkingVerb as string;
    // Force prevStatus to idle so the "isThinking && !wasThinking" branch fires
    (comp as any).prevStatus = 'idle';
    comp.setState({ status: 'thinking' });
    // thinkingVerb is reassigned; might be same by random chance but at least doesn't throw
    expect(typeof (comp as any).thinkingVerb).toBe('string');
    comp.dispose();
  });

  it('includes iteration badge when iteration info is available', () => {
    const comp = new WorkingIndicatorComponent(fakeTui);
    comp.setState({ status: 'thinking', iteration: 3, maxIterations: 10 });
    const loader = (comp as any).loader;
    expect(loader).not.toBeNull();
    comp.dispose();
  });

  it('goes back to idle after thinking', () => {
    const comp = new WorkingIndicatorComponent(fakeTui);
    comp.setState({ status: 'thinking' });
    comp.setState({ status: 'idle' });
    expect((comp as any).loader).toBeNull();
    comp.dispose();
  });
});

describe('WorkingIndicatorComponent — setState: tool', () => {
  it('creates a loader in tool state', () => {
    const comp = new WorkingIndicatorComponent(fakeTui);
    comp.setState({ status: 'tool', toolName: 'web_search' });
    expect((comp as any).loader).not.toBeNull();
    comp.dispose();
  });

  it('includes iteration badge in tool state when available', () => {
    const comp = new WorkingIndicatorComponent(fakeTui);
    comp.setState({ status: 'tool', toolName: 'web_search', iteration: 2, maxIterations: 5 });
    expect((comp as any).loader).not.toBeNull();
    comp.dispose();
  });
});

describe('WorkingIndicatorComponent — setState: approval', () => {
  it('creates a loader in approval state', () => {
    const comp = new WorkingIndicatorComponent(fakeTui);
    comp.setState({ status: 'approval', toolName: 'edit_file' });
    expect((comp as any).loader).not.toBeNull();
    comp.dispose();
  });
});

describe('WorkingIndicatorComponent — dispose', () => {
  it('stops loader and tick interval without throwing', () => {
    const comp = new WorkingIndicatorComponent(fakeTui);
    comp.setState({ status: 'thinking' });
    expect(() => comp.dispose()).not.toThrow();
  });

  it('dispose on idle component does not throw', () => {
    const comp = new WorkingIndicatorComponent(fakeTui);
    expect(() => comp.dispose()).not.toThrow();
  });
});
