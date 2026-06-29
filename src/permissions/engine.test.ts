import { describe, test, expect } from 'bun:test';
import { evaluatePermission, sessionKey } from './engine.js';

describe('evaluatePermission (Phase 0 — behavior parity)', () => {
  test('write_file and edit_file ask for approval', () => {
    expect(evaluatePermission({ tool: 'write_file', args: { path: 'x' } }).mode).toBe('ask');
    expect(evaluatePermission({ tool: 'edit_file', args: { path: 'x' } }).mode).toBe('ask');
  });

  test('read-only and other tools are auto-allowed', () => {
    for (const tool of ['read_file', 'get_financials', 'web_search', 'memory_search', 'skill']) {
      expect(evaluatePermission({ tool, args: {} }).mode).toBe('allow');
    }
  });

  test('every decision carries a reason', () => {
    expect(evaluatePermission({ tool: 'write_file', args: {} }).reason).toBeTruthy();
    expect(evaluatePermission({ tool: 'read_file', args: {} }).reason).toBeTruthy();
  });
});

describe('sessionKey', () => {
  test('write_file and edit_file share one key (legacy cross-approval parity)', () => {
    const d = evaluatePermission({ tool: 'write_file', args: {} });
    expect(sessionKey('write_file', d)).toBe(sessionKey('edit_file', d));
  });

  test('non-legacy tools key on their own name', () => {
    const d = evaluatePermission({ tool: 'some_tool', args: {} });
    expect(sessionKey('some_tool', d)).toBe('some_tool');
  });
});
