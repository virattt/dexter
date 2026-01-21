import React, { useRef, useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

import { colors } from '../theme.js';

interface InputProps {
  onSubmit: (value: string) => void;
  /** Value from history navigation (null = user typing fresh input) */
  historyValue?: string | null;
  /** Callback when user presses up/down arrow for history navigation */
  onHistoryNavigate?: (direction: 'up' | 'down') => void;
}

export function Input({ onSubmit, historyValue, onHistoryNavigate }: InputProps) {
  // Use ref-based buffer to avoid React state race conditions with fast typing
  const buffer = useRef('');
  const cursorRef = useRef(0); // cursor position (points between characters)
  const [, forceRender] = useState(0);

  // Update input buffer when history navigation changes
  useEffect(() => {
    if (historyValue === null) {
      // Returned to typing mode - clear input for fresh entry
      buffer.current = '';
      cursorRef.current = 0;
      forceRender(x => x + 1);
    } else if (historyValue !== undefined) {
      // Navigating history - show the historical message
      buffer.current = historyValue;
      cursorRef.current = historyValue.length; // cursor at end
      forceRender(x => x + 1);
    }
  }, [historyValue]);

  // Handle all input with ref-based buffer to prevent race conditions
  useInput((input, key) => {
    // Handle history navigation
    if (onHistoryNavigate) {
      if (key.upArrow) {
        onHistoryNavigate('up');
        return;
      } else if (key.downArrow) {
        onHistoryNavigate('down');
        return;
      }
    }

    // Handle cursor movement
    if (key.leftArrow) {
      cursorRef.current = Math.max(0, cursorRef.current - 1);
      forceRender(x => x + 1);
      return;
    } else if (key.rightArrow) {
      // Ensure cursor doesn't exceed buffer length
      cursorRef.current = Math.min(buffer.current.length, cursorRef.current + 1);
      forceRender(x => x + 1);
      return;
    }

    // Handle backspace (delete character to the left of cursor)
    if (key.delete || key.backspace) {
      if (cursorRef.current > 0) {
        buffer.current =
          buffer.current.slice(0, cursorRef.current - 1) +
          buffer.current.slice(cursorRef.current);
        cursorRef.current -= 1; // move cursor left
        forceRender(x => x + 1);
      }
      return;
    }

    // Handle submit
    if (key.return) {
      const val = buffer.current.trim();
      if (val) {
        onSubmit(val);
        buffer.current = '';
        cursorRef.current = 0;
        forceRender(x => x + 1);
      }
      return;
    }

    // Handle regular character input (ignore control keys)
    if (input && !key.ctrl && !key.meta) {
      // Insert character at cursor position
      buffer.current =
        buffer.current.slice(0, cursorRef.current) + 
        input + 
        buffer.current.slice(cursorRef.current);
      cursorRef.current += input.length;
      forceRender(x => x + 1);
    }
  });

  // Display buffer with cursor at correct position
  const beforeCursor = buffer.current.slice(0, cursorRef.current);
  const afterCursor = buffer.current.slice(cursorRef.current);

  return (
    <Box 
      flexDirection="column" 
      marginBottom={1}
      borderStyle="single"
      borderColor={colors.mutedDark}
      borderLeft={false}
      borderRight={false}
      width="100%"
    >
      <Box paddingX={1}>
        <Text color={colors.primary} bold>
          {'> '}
        </Text>
        <Text>{beforeCursor}</Text>
        <Text color={colors.muted}>█</Text>
        <Text>{afterCursor}</Text>
      </Box>
    </Box>
  );
}
