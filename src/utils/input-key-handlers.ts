import {
  findPrevWordStart,
  findNextWordEnd,
  getLineAndColumn,
  getCursorPosition,
  getLineStart,
  getLineEnd,
  getLineCount,
} from './text-navigation.js';

/**
 * Context needed for cursor position calculations
 */
export interface CursorContext {
  text: string;
  cursorPosition: number;
}

/**
 * Pure functions for computing new cursor positions.
 * Each function takes the current context and returns the new cursor position.
 * For vertical movement (moveUp/moveDown), returns null if at boundary to signal
 * that the caller should handle it (e.g., history navigation).
 */
export const cursorHandlers = {
  /** Move cursor one character left */
  moveLeft: (ctx: CursorContext): number =>
    Math.max(0, ctx.cursorPosition - 1),

  /** Move cursor one character right */
  moveRight: (ctx: CursorContext): number =>
    Math.min(ctx.text.length, ctx.cursorPosition + 1),

  /** Move cursor to start of current line */
  moveToLineStart: (ctx: CursorContext): number =>
    getLineStart(ctx.text, ctx.cursorPosition),

  /** Move cursor to end of current line */
  moveToLineEnd: (ctx: CursorContext): number =>
    getLineEnd(ctx.text, ctx.cursorPosition),

  /** Move cursor up one line, maintaining column position. Returns null if on first line. */
  moveUp: (ctx: CursorContext): number | null => {
    const { line, column } = getLineAndColumn(ctx.text, ctx.cursorPosition);
    if (line === 0) return null; // At first line, signal to caller
    return getCursorPosition(ctx.text, line - 1, column);
  },

  /** Move cursor down one line, maintaining column position. Returns null if on last line. */
  moveDown: (ctx: CursorContext): number | null => {
    const { line, column } = getLineAndColumn(ctx.text, ctx.cursorPosition);
    const lineCount = getLineCount(ctx.text);
    if (line >= lineCount - 1) return null; // At last line, signal to caller
    return getCursorPosition(ctx.text, line + 1, column);
  },

  /** Move cursor to start of previous word */
  moveWordBackward: (ctx: CursorContext): number =>
    findPrevWordStart(ctx.text, ctx.cursorPosition),

  /** Move cursor to end of next word */
  moveWordForward: (ctx: CursorContext): number =>
    findNextWordEnd(ctx.text, ctx.cursorPosition),
};
