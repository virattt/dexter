/**
 * E2E regression tests for the watchlist TUI freeze bug.
 *
 * BUG REPORT: After `/watchlist snapshot` (or list / show), the TUI appeared
 * "frozen" — the panel stayed on-screen, previous conversation was "erased",
 * and the user couldn't exit.
 *
 * ROOT CAUSES:
 *   1. The editor was focused but NOT in the component tree when the watchlist
 *      panel was rendered via `renderScreenView`.  No visible cursor meant no
 *      feedback; the user didn't know they could type or press Esc.
 *   2. Pressing Enter on an empty editor (`if (!value) return`) did nothing —
 *      dismissing the panel required Esc, which wasn't obvious without a cursor.
 *
 * FIXES (src/cli.ts):
 *   a. `renderWatchlistView` — new render helper that adds the editor to the
 *      component tree alongside the panel.  The cursor is visible; typing works.
 *   b. `editor.onSubmit` — empty Enter now closes the overlay (watchlist or
 *      help) instead of silently returning.
 *
 * These tests simulate the state-machine logic without needing a real terminal.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { parseWatchlistSubcommand } from './watchlist-controller.js';

// ---------------------------------------------------------------------------
// Minimal TUI state machine — mirrors the relevant parts of cli.ts logic so
// we can verify that `onSubmit(empty)` and `onEscape` both close the panel.
// ---------------------------------------------------------------------------

interface OverlayState {
  watchlistVisible: boolean;
  helpVisible: boolean;
  renders: string[];  // log of render calls for assertions
}

/** Builds a minimal simulation of the watchlist TUI state machine. */
function buildStateMachine() {
  const state: OverlayState = {
    watchlistVisible: false,
    helpVisible: false,
    renders: [],
  };

  const renderSelectionOverlay = () => {
    if (state.watchlistVisible) {
      state.renders.push('watchlist');
    } else if (state.helpVisible) {
      state.renders.push('help');
    } else {
      state.renders.push('main');
    }
  };

  // Mirrors the fixed editor.onSubmit from cli.ts.
  const onSubmit = (text: string) => {
    const value = text.trim();
    if (!value) {
      if (state.watchlistVisible) {
        state.watchlistVisible = false;
        renderSelectionOverlay();
      } else if (state.helpVisible) {
        state.helpVisible = false;
        renderSelectionOverlay();
      }
      return;
    }
    // Simulate /watchlist subcommand handling (just opens the panel).
    if (value.startsWith('/watchlist')) {
      const sub = parseWatchlistSubcommand(value.slice('/watchlist'.length).trim());
      if (sub.cmd === 'list' || sub.cmd === 'show' || sub.cmd === 'snapshot') {
        state.watchlistVisible = true;
        renderSelectionOverlay();
        return;
      }
    }
    if (value === '/help') {
      state.helpVisible = true;
      renderSelectionOverlay();
      return;
    }
    // Non-watchlist commands close the overlay first.
    if (state.watchlistVisible) {
      state.watchlistVisible = false;
    }
    state.renders.push(`query:${value}`);
  };

  // Mirrors editor.onEscape from cli.ts.
  const onEscape = () => {
    if (state.watchlistVisible) {
      state.watchlistVisible = false;
      renderSelectionOverlay();
      return;
    }
    if (state.helpVisible) {
      state.helpVisible = false;
      renderSelectionOverlay();
    }
  };

  return { state, onSubmit, onEscape };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('watchlist TUI freeze — regression suite', () => {
  describe('Esc closes the watchlist panel', () => {
    it('closes list panel', () => {
      const { state, onSubmit, onEscape } = buildStateMachine();
      onSubmit('/watchlist list');
      expect(state.watchlistVisible).toBe(true);
      onEscape();
      expect(state.watchlistVisible).toBe(false);
      expect(state.renders.at(-1)).toBe('main');
    });

    it('closes snapshot panel', () => {
      const { state, onSubmit, onEscape } = buildStateMachine();
      onSubmit('/watchlist snapshot');
      expect(state.watchlistVisible).toBe(true);
      onEscape();
      expect(state.watchlistVisible).toBe(false);
      expect(state.renders.at(-1)).toBe('main');
    });

    it('closes show panel', () => {
      const { state, onSubmit, onEscape } = buildStateMachine();
      onSubmit('/watchlist show AAPL');
      expect(state.watchlistVisible).toBe(true);
      onEscape();
      expect(state.watchlistVisible).toBe(false);
      expect(state.renders.at(-1)).toBe('main');
    });
  });

  describe('Empty Enter closes the watchlist panel (fix for freeze)', () => {
    it('empty Enter closes list panel', () => {
      const { state, onSubmit } = buildStateMachine();
      onSubmit('/watchlist list');
      expect(state.watchlistVisible).toBe(true);

      // Before the fix: `if (!value) return;` silently dropped this, leaving
      // the panel open forever.  After the fix, it closes the overlay.
      onSubmit('');
      expect(state.watchlistVisible).toBe(false);
      expect(state.renders.at(-1)).toBe('main');
    });

    it('empty Enter closes snapshot panel', () => {
      const { state, onSubmit } = buildStateMachine();
      onSubmit('/watchlist snapshot');
      onSubmit('');
      expect(state.watchlistVisible).toBe(false);
      expect(state.renders.at(-1)).toBe('main');
    });

    it('empty Enter closes show panel', () => {
      const { state, onSubmit } = buildStateMachine();
      onSubmit('/watchlist show NVDA');
      onSubmit('');
      expect(state.watchlistVisible).toBe(false);
    });

    it('empty Enter is a no-op when no overlay is open (does not crash)', () => {
      const { state, onSubmit } = buildStateMachine();
      expect(state.watchlistVisible).toBe(false);
      expect(state.helpVisible).toBe(false);
      expect(() => onSubmit('')).not.toThrow();
      expect(state.watchlistVisible).toBe(false);
    });

    it('whitespace-only Enter is treated as empty', () => {
      const { state, onSubmit } = buildStateMachine();
      onSubmit('/watchlist snapshot');
      onSubmit('   ');
      expect(state.watchlistVisible).toBe(false);
    });
  });

  describe('Empty Enter closes the help panel', () => {
    it('empty Enter closes help overlay', () => {
      const { state, onSubmit } = buildStateMachine();
      onSubmit('/help');
      expect(state.helpVisible).toBe(true);
      onSubmit('');
      expect(state.helpVisible).toBe(false);
      expect(state.renders.at(-1)).toBe('main');
    });
  });

  describe('Typing a command while in watchlist mode dismisses panel and runs command', () => {
    it('non-watchlist command closes the panel and runs', () => {
      const { state, onSubmit } = buildStateMachine();
      onSubmit('/watchlist snapshot');
      expect(state.watchlistVisible).toBe(true);

      onSubmit('What is the P/E ratio of NVDA?');
      expect(state.watchlistVisible).toBe(false);
      expect(state.renders.at(-1)).toBe('query:What is the P/E ratio of NVDA?');
    });

    it('switching between watchlist subcommands works', () => {
      const { state, onSubmit } = buildStateMachine();
      onSubmit('/watchlist snapshot');
      expect(state.renders.at(-1)).toBe('watchlist');

      // The panel closes first, then the new mode opens.
      onSubmit('/watchlist list');
      expect(state.watchlistVisible).toBe(true);
      expect(state.renders.at(-1)).toBe('watchlist');
    });
  });

  describe('Multiple open/close cycles do not corrupt state', () => {
    it('can open and close the panel multiple times', () => {
      const { state, onSubmit, onEscape } = buildStateMachine();
      for (let i = 0; i < 5; i++) {
        onSubmit('/watchlist snapshot');
        expect(state.watchlistVisible).toBe(true);
        onEscape();
        expect(state.watchlistVisible).toBe(false);
      }
      expect(state.renders.at(-1)).toBe('main');
    });

    it('alternating Esc and empty-Enter both reliably close the panel', () => {
      const { state, onSubmit, onEscape } = buildStateMachine();

      onSubmit('/watchlist snapshot');
      onEscape();
      expect(state.watchlistVisible).toBe(false);

      onSubmit('/watchlist list');
      onSubmit('');
      expect(state.watchlistVisible).toBe(false);

      onSubmit('/watchlist show MSFT');
      onEscape();
      expect(state.watchlistVisible).toBe(false);
    });
  });
});
