import { findPrevWordStart, findNextWordEnd } from './text-navigation.js';

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
 */
export const cursorHandlers = {
  /** Move cursor one character left */
  moveLeft: (ctx: CursorContext): number =>
    Math.max(0, ctx.cursorPosition - 1),

  /** Move cursor one character right */
  moveRight: (ctx: CursorContext): number =>
    Math.min(ctx.text.length, ctx.cursorPosition + 1),

  /** Move cursor to start of line */
  moveToStart: (): number => 0,

  /** Move cursor to end of line */
  moveToEnd: (ctx: CursorContext): number => ctx.text.length,

  /** Move cursor to start of previous word */
  moveWordBackward: (ctx: CursorContext): number =>
    findPrevWordStart(ctx.text, ctx.cursorPosition),

  /** Move cursor to end of next word */
  moveWordForward: (ctx: CursorContext): number =>
    findNextWordEnd(ctx.text, ctx.cursorPosition),
};
