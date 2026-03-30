/**
 * Coverage tests for CustomEditor.
 *
 * Tests the input routing logic: escape → onEscape, ctrl+c → onCtrlC,
 * and fallthrough for regular characters. Also covers setText (which calls
 * cancelAutocomplete before delegating to super).
 */
import { afterEach, describe, it, expect, mock } from 'bun:test';
import { Key, matchesKey } from '@mariozechner/pi-tui';
import { CustomEditor } from './custom-editor.js';

// Minimal stubs that satisfy Editor's constructor requirements.
const fakeTui = { requestRender: () => {} };
const fakeTheme = {
  borderColor: '#fff',
  textColor: '#fff',
  cursorColor: '#fff',
  scrollbarColor: '#fff',
  normalModeColor: '#fff',
  insertModeColor: '#fff',
  commandModeColor: '#fff',
};

function makeEditor() {
  // Editor requires (tui, theme, options?)
  return new CustomEditor(fakeTui as any, fakeTheme as any);
}

// ---------------------------------------------------------------------------
// handleInput — escape
// ---------------------------------------------------------------------------

describe('CustomEditor — handleInput: escape', () => {
  it('calls onEscape and returns when escape key is received', () => {
    const editor = makeEditor();
    const onEscape = mock(() => {});
    editor.onEscape = onEscape;
    editor.handleInput('\x1b');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('does not call super.handleInput when escape+onEscape fires', () => {
    const editor = makeEditor();
    editor.onEscape = () => {};
    // After escape, internal state should not change (no character inserted)
    const before = editor.getValue?.() ?? (editor as any).state.lines.join('\n');
    editor.handleInput('\x1b');
    const after = editor.getValue?.() ?? (editor as any).state.lines.join('\n');
    expect(after).toBe(before);
  });

  it('falls through to super.handleInput when onEscape is not set', () => {
    const editor = makeEditor();
    // No onEscape set — should not throw, just calls super
    expect(() => editor.handleInput('\x1b')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// handleInput — ctrl+c
// ---------------------------------------------------------------------------

describe('CustomEditor — handleInput: ctrl+c', () => {
  it('calls onCtrlC and returns when ctrl+c is received', () => {
    const editor = makeEditor();
    const onCtrlC = mock(() => {});
    editor.onCtrlC = onCtrlC;
    editor.handleInput('\x03'); // ASCII ETX
    expect(onCtrlC).toHaveBeenCalledTimes(1);
  });

  it('falls through to super.handleInput when onCtrlC is not set', () => {
    const editor = makeEditor();
    expect(() => editor.handleInput('\x03')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// handleInput — other keys pass through
// ---------------------------------------------------------------------------

describe('CustomEditor — handleInput: passthrough', () => {
  it('inserts a regular character (a-z) via super.handleInput', () => {
    const editor = makeEditor();
    editor.handleInput('h');
    editor.handleInput('i');
    // Internal state lines should reflect typed chars
    const lines = (editor as any).state.lines as string[];
    expect(lines[0]).toContain('hi');
  });
});

// ---------------------------------------------------------------------------
// setText — calls cancelAutocomplete
// ---------------------------------------------------------------------------

describe('CustomEditor — setText', () => {
  it('does not throw when cancelAutocomplete is not present', () => {
    const editor = makeEditor();
    expect(() => editor.setText('hello')).not.toThrow();
  });

  it('updates the editor value', () => {
    const editor = makeEditor();
    editor.setText('world');
    const lines = (editor as any).state.lines as string[];
    expect(lines.join('\n')).toContain('world');
  });

  it('calls cancelAutocomplete when it exists', () => {
    const editor = makeEditor();
    const cancelFn = mock(() => {});
    (editor as any).cancelAutocomplete = cancelFn;
    editor.setText('new text');
    expect(cancelFn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Key constants sanity check (used by handleInput logic)
// ---------------------------------------------------------------------------

describe('Key / matchesKey sanity', () => {
  it('matchesKey identifies escape sequence', () => {
    expect(matchesKey('\x1b', Key.escape)).toBe(true);
  });

  it('matchesKey identifies ctrl+c sequence', () => {
    expect(matchesKey('\x03', Key.ctrl('c'))).toBe(true);
  });

  it('matchesKey does not confuse escape with ctrl+c', () => {
    expect(matchesKey('\x1b', Key.ctrl('c'))).toBe(false);
    expect(matchesKey('\x03', Key.escape)).toBe(false);
  });
});
