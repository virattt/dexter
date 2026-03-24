/**
 * Find the start position of the previous word from cursor position.
 * Used for Option+Left (Mac) / Ctrl+Left (Windows) navigation.
 */
export function findPrevWordStart(text: string, pos: number): number {
  if (pos <= 0) return 0;
  let i = pos - 1;
  // Skip non-word chars
  while (i > 0 && !/\w/.test(text[i])) i--;
  // Move to word start
  while (i > 0 && /\w/.test(text[i - 1])) i--;
  return i;
}

/**
 * Find the end position of the next word from cursor position.
 * Used for Option+Right (Mac) / Ctrl+Right (Windows) navigation.
 */
export function findNextWordEnd(text: string, pos: number): number {
  const len = text.length;
  if (pos >= len) return len;
  let i = pos;
  // Skip non-word chars
  while (i < len && !/\w/.test(text[i])) i++;
  // Move to word end
  while (i < len && /\w/.test(text[i])) i++;
  return i;
}

// ============================================================================
// Multi-line cursor navigation utilities
// ============================================================================

/**
 * Get the line number (0-indexed) and column from a cursor position.
 */
export function getLineAndColumn(text: string, pos: number): { line: number; column: number } {
  const beforeCursor = text.slice(0, pos);
  const lines = beforeCursor.split('\n');
  return {
    line: lines.length - 1,
    column: lines[lines.length - 1].length,
  };
}

/**
 * Get cursor position from line number and column.
 * Clamps column to the actual line length if it exceeds.
 */
export function getCursorPosition(text: string, line: number, column: number): number {
  const lines = text.split('\n');
  let pos = 0;
  for (let i = 0; i < line && i < lines.length; i++) {
    pos += lines[i].length + 1; // +1 for newline
  }
  const targetLine = lines[line] || '';
  return pos + Math.min(column, targetLine.length);
}

/**
 * Get the start position of the line containing the cursor.
 */
export function getLineStart(text: string, pos: number): number {
  const lastNewline = text.lastIndexOf('\n', pos - 1);
  return lastNewline + 1; // -1 + 1 = 0 if no newline found
}

/**
 * Get the end position of the line containing the cursor (before the newline).
 */
export function getLineEnd(text: string, pos: number): number {
  const nextNewline = text.indexOf('\n', pos);
  return nextNewline === -1 ? text.length : nextNewline;
}

/**
 * Get the total number of lines in the text.
 */
export function getLineCount(text: string): number {
  return text.split('\n').length;
}
