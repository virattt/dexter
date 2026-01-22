import { useRef, useState, useCallback } from 'react';
import { findPrevWordStart } from '../utils/text-navigation.js';

export interface TextBufferActions {
  /** Insert text at the current cursor position */
  insert: (text: string) => void;
  /** Delete the character before the cursor */
  deleteBackward: () => void;
  /** Delete from cursor back to start of previous word */
  deleteWordBackward: () => void;
  /** Move cursor to an absolute position (clamped to valid range) */
  moveCursor: (position: number) => void;
  /** Clear the buffer and reset cursor to 0 */
  clear: () => void;
  /** Set the buffer value and optionally position cursor at end */
  setValue: (value: string, cursorAtEnd?: boolean) => void;
}

export interface UseTextBufferResult {
  /** Current text content */
  text: string;
  /** Current cursor position (0-indexed) */
  cursorPosition: number;
  /** Actions to manipulate the buffer */
  actions: TextBufferActions;
}

/**
 * Hook for managing a text buffer with cursor position.
 * Uses refs internally to avoid React state race conditions with fast typing,
 * while still triggering re-renders when content changes.
 */
export function useTextBuffer(): UseTextBufferResult {
  // Use refs to avoid race conditions with fast typing
  const buffer = useRef('');
  const cursorPos = useRef(0);
  const [, forceRender] = useState(0);

  const rerender = useCallback(() => forceRender(x => x + 1), []);

  const actions: TextBufferActions = {
    insert: (input: string) => {
      // Normalize newlines and carriage returns to spaces for single-line input
      const normalized = input.replace(/[\r\n]+/g, ' ');
      buffer.current =
        buffer.current.slice(0, cursorPos.current) +
        normalized +
        buffer.current.slice(cursorPos.current);
      cursorPos.current += normalized.length;
      rerender();
    },

    deleteBackward: () => {
      if (cursorPos.current > 0) {
        buffer.current =
          buffer.current.slice(0, cursorPos.current - 1) +
          buffer.current.slice(cursorPos.current);
        cursorPos.current--;
        rerender();
      }
    },

    deleteWordBackward: () => {
      if (cursorPos.current > 0) {
        const wordStart = findPrevWordStart(buffer.current, cursorPos.current);
        buffer.current =
          buffer.current.slice(0, wordStart) +
          buffer.current.slice(cursorPos.current);
        cursorPos.current = wordStart;
        rerender();
      }
    },

    moveCursor: (position: number) => {
      cursorPos.current = Math.max(0, Math.min(buffer.current.length, position));
      rerender();
    },

    clear: () => {
      buffer.current = '';
      cursorPos.current = 0;
      rerender();
    },

    setValue: (value: string, cursorAtEnd = true) => {
      buffer.current = value;
      cursorPos.current = cursorAtEnd ? value.length : 0;
      rerender();
    },
  };

  return {
    text: buffer.current,
    cursorPosition: cursorPos.current,
    actions,
  };
}
