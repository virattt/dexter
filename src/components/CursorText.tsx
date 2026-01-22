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
 */
export function CursorText({ text, cursorPosition }: CursorTextProps) {
  const beforeCursor = text.slice(0, cursorPosition);
  const atCursor = cursorPosition < text.length ? text[cursorPosition] : ' ';
  const afterCursor = text.slice(cursorPosition + 1);

  // Build a single string with ANSI escape codes for the cursor
  // This ensures text wraps correctly across terminal lines
  const displayText = beforeCursor + chalk.inverse(atCursor) + afterCursor;

  return <Text>{displayText}</Text>;
}
