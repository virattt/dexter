import React from 'react';
import { Text } from 'ink';

interface CursorTextProps {
  /** The text content to display */
  text: string;
  /** Current cursor position (0-indexed) */
  cursorPosition: number;
}

/**
 * Renders text with a block cursor at the specified position.
 * - When cursor is within text, the character at cursor position is highlighted (inverse)
 * - When cursor is at end, displays a block cursor (inverse space)
 */
export function CursorText({ text, cursorPosition }: CursorTextProps) {
  const beforeCursor = text.slice(0, cursorPosition);
  const atCursor = text[cursorPosition];
  const afterCursor = text.slice(cursorPosition + 1);

  return (
    <>
      <Text>{beforeCursor}</Text>
      {cursorPosition < text.length ? (
        // Cursor is within text - highlight the character under cursor
        <>
          <Text inverse>{atCursor}</Text>
          <Text>{afterCursor}</Text>
        </>
      ) : (
        // Cursor is at end - show block cursor
        <Text inverse>{' '}</Text>
      )}
    </>
  );
}
