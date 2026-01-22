import React from 'react';
import { Text } from 'ink';
import chalk from 'chalk';

interface CursorTextProps {
  /** The text content to display */
  text: string;
  /** Current cursor position (0-indexed) */
  cursorPosition: number;
}

/**
 * Renders text with a block cursor at the specified position.
 * Uses a single Text element with inline ANSI styling to ensure proper
 * text wrapping across multiple terminal lines.
 * - When cursor is within text, the character at cursor position is highlighted (inverse)
 * - When cursor is at end, displays a block cursor (inverse space)
 * - When cursor is on a newline, displays an inverse space at end of line, then the newline
 */
export function CursorText({ text, cursorPosition }: CursorTextProps) {
  const beforeCursor = text.slice(0, cursorPosition);
  const charAtCursor = cursorPosition < text.length ? text[cursorPosition] : null;

  // If cursor is on a newline, display an inverse space at end of line
  // then include the newline for proper line break rendering
  const atCursor = charAtCursor === '\n' || charAtCursor === null ? ' ' : charAtCursor;

  // If cursor is on newline, we need to include the newline after the inverse space
  const afterCursor =
    charAtCursor === '\n'
      ? '\n' + text.slice(cursorPosition + 1)
      : text.slice(cursorPosition + 1);

  // Build a single string with ANSI escape codes for the cursor
  // This ensures text wraps correctly across terminal lines
  let displayText = beforeCursor + chalk.inverse(atCursor) + afterCursor;

  // Indent all lines after the first to align with the "> " prompt offset
  const indent = '  ';
  displayText = displayText.replace(/\n/g, '\n' + indent);

  return <Text>{displayText}</Text>;
}
