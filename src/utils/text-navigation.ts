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
