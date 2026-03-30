import { describe, it, expect } from 'bun:test';
import {
  findPrevWordStart,
  findNextWordEnd,
  getLineAndColumn,
  getCursorPosition,
  getLineStart,
  getLineEnd,
  getLineCount,
} from './text-navigation.js';

describe('findPrevWordStart', () => {
  it('returns 0 when pos is 0', () => {
    expect(findPrevWordStart('hello world', 0)).toBe(0);
  });

  it('moves back to start of current word', () => {
    expect(findPrevWordStart('hello world', 11)).toBe(6); // end → 'world' start
  });

  it('skips whitespace then moves to previous word start', () => {
    expect(findPrevWordStart('hello world', 6)).toBe(0); // space before 'world' → 'hello' start
  });

  it('handles single word', () => {
    expect(findPrevWordStart('hello', 5)).toBe(0);
  });

  it('returns 0 when already at position 1', () => {
    expect(findPrevWordStart('ab', 1)).toBe(0);
  });
});

describe('findNextWordEnd', () => {
  it('returns length when pos is at end', () => {
    const text = 'hello world';
    expect(findNextWordEnd(text, text.length)).toBe(text.length);
  });

  it('moves forward past current word', () => {
    expect(findNextWordEnd('hello world', 0)).toBe(5); // from start → end of 'hello'
  });

  it('skips leading whitespace then moves to end of next word', () => {
    expect(findNextWordEnd('hello world', 5)).toBe(11); // from space → end of 'world'
  });

  it('handles single word', () => {
    expect(findNextWordEnd('hello', 0)).toBe(5);
  });

  it('handles position inside a word', () => {
    expect(findNextWordEnd('hello world', 2)).toBe(5); // from inside 'hello'
  });
});

describe('getLineAndColumn', () => {
  it('returns line 0 col 0 at position 0', () => {
    expect(getLineAndColumn('hello\nworld', 0)).toEqual({ line: 0, column: 0 });
  });

  it('returns correct line and column for multi-line text', () => {
    const text = 'hello\nworld';
    expect(getLineAndColumn(text, 6)).toEqual({ line: 1, column: 0 }); // start of 'world'
    expect(getLineAndColumn(text, 8)).toEqual({ line: 1, column: 2 }); // 'rl' in world
  });

  it('handles position at end of first line', () => {
    expect(getLineAndColumn('hello\nworld', 5)).toEqual({ line: 0, column: 5 });
  });

  it('handles single-line text', () => {
    expect(getLineAndColumn('hello', 3)).toEqual({ line: 0, column: 3 });
  });

  it('handles empty string', () => {
    expect(getLineAndColumn('', 0)).toEqual({ line: 0, column: 0 });
  });
});

describe('getCursorPosition', () => {
  it('returns 0 for line 0 col 0', () => {
    expect(getCursorPosition('hello\nworld', 0, 0)).toBe(0);
  });

  it('returns correct position for line 1 col 0', () => {
    expect(getCursorPosition('hello\nworld', 1, 0)).toBe(6); // after 'hello\n'
  });

  it('clamps column to line length', () => {
    expect(getCursorPosition('hi\nworld', 0, 100)).toBe(2); // 'hi' is 2 chars
  });

  it('handles last line correctly', () => {
    expect(getCursorPosition('hello\nworld', 1, 3)).toBe(9); // 6 + 3
  });

  it('is inverse of getLineAndColumn', () => {
    const text = 'line one\nline two\nline three';
    for (const pos of [0, 5, 9, 14, 18, 27]) {
      const { line, column } = getLineAndColumn(text, pos);
      expect(getCursorPosition(text, line, column)).toBe(pos);
    }
  });
});

describe('getLineStart', () => {
  it('returns 0 for single-line text', () => {
    expect(getLineStart('hello', 3)).toBe(0);
  });

  it('returns correct start for second line', () => {
    expect(getLineStart('hello\nworld', 8)).toBe(6); // 'world' starts at 6
  });

  it('returns 0 for position on first line', () => {
    expect(getLineStart('hello\nworld', 2)).toBe(0);
  });

  it('returns correct start when cursor is at newline', () => {
    expect(getLineStart('hello\nworld', 5)).toBe(0); // position of \n is on first line
  });

  it('handles position at start of second line', () => {
    expect(getLineStart('hello\nworld', 6)).toBe(6);
  });
});

describe('getLineEnd', () => {
  it('returns text length for single-line text', () => {
    expect(getLineEnd('hello', 0)).toBe(5);
  });

  it('returns position of newline for first line', () => {
    expect(getLineEnd('hello\nworld', 2)).toBe(5);
  });

  it('returns text length for last line', () => {
    expect(getLineEnd('hello\nworld', 7)).toBe(11);
  });

  it('handles cursor exactly at newline', () => {
    expect(getLineEnd('hello\nworld', 5)).toBe(5);
  });
});

describe('getLineCount', () => {
  it('returns 1 for single-line text', () => {
    expect(getLineCount('hello')).toBe(1);
  });

  it('returns 2 for two-line text', () => {
    expect(getLineCount('hello\nworld')).toBe(2);
  });

  it('returns 3 for three-line text', () => {
    expect(getLineCount('a\nb\nc')).toBe(3);
  });

  it('returns 1 for empty string', () => {
    expect(getLineCount('')).toBe(1);
  });

  it('counts trailing newline as extra line', () => {
    expect(getLineCount('hello\n')).toBe(2);
  });
});
