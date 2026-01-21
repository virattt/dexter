import React, { useRef, useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

import { colors } from '../theme.js';
import { findPrevWordStart, findNextWordEnd } from '../utils/text-navigation.js';

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
  const cursorPos = useRef(0);
  const [, forceRender] = useState(0);

  // Update input buffer when history navigation changes
  useEffect(() => {
    if (historyValue === null) {
      // Returned to typing mode - clear input for fresh entry
      buffer.current = '';
      cursorPos.current = 0;
      forceRender(x => x + 1);
    } else if (historyValue !== undefined) {
      // Navigating history - show the historical message
      buffer.current = historyValue;
      cursorPos.current = historyValue.length;
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

    // Cursor movement - left arrow (plain, no modifiers)
    if (key.leftArrow && !key.ctrl && !key.meta) {
      cursorPos.current = Math.max(0, cursorPos.current - 1);
      forceRender(x => x + 1);
      return;
    }

    // Cursor movement - right arrow (plain, no modifiers)
    if (key.rightArrow && !key.ctrl && !key.meta) {
      cursorPos.current = Math.min(buffer.current.length, cursorPos.current + 1);
      forceRender(x => x + 1);
      return;
    }

    // Ctrl+A - move to beginning of line
    if (key.ctrl && input === 'a') {
      cursorPos.current = 0;
      forceRender(x => x + 1);
      return;
    }

    // Ctrl+E - move to end of line
    if (key.ctrl && input === 'e') {
      cursorPos.current = buffer.current.length;
      forceRender(x => x + 1);
      return;
    }

    // Option+Left (Mac) / Ctrl+Left (Windows) / Alt+B - word backward
    if ((key.meta && key.leftArrow) || (key.ctrl && key.leftArrow) || (key.meta && input === 'b')) {
      cursorPos.current = findPrevWordStart(buffer.current, cursorPos.current);
      forceRender(x => x + 1);
      return;
    }

    // Option+Right (Mac) / Ctrl+Right (Windows) / Alt+F - word forward
    if ((key.meta && key.rightArrow) || (key.ctrl && key.rightArrow) || (key.meta && input === 'f')) {
      cursorPos.current = findNextWordEnd(buffer.current, cursorPos.current);
      forceRender(x => x + 1);
      return;
    }

    // Handle backspace/delete - delete character before cursor
    if (key.backspace || key.delete) {
      if (cursorPos.current > 0) {
        buffer.current = 
          buffer.current.slice(0, cursorPos.current - 1) + 
          buffer.current.slice(cursorPos.current);
        cursorPos.current--;
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
        cursorPos.current = 0;
        forceRender(x => x + 1);
      }
      return;
    }

    // Handle regular character input - insert at cursor position
    if (input && !key.ctrl && !key.meta) {
      buffer.current = 
        buffer.current.slice(0, cursorPos.current) + 
        input + 
        buffer.current.slice(cursorPos.current);
      cursorPos.current += input.length;
      forceRender(x => x + 1);
    }
  });

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
        <Text>{buffer.current.slice(0, cursorPos.current)}</Text>
        {cursorPos.current < buffer.current.length ? (
          // Cursor is within text - highlight the character under cursor
          <>
            <Text inverse>{buffer.current[cursorPos.current]}</Text>
            <Text>{buffer.current.slice(cursorPos.current + 1)}</Text>
          </>
        ) : (
          // Cursor is at end - show block cursor
          <Text inverse>{' '}</Text>
        )}
      </Box>
    </Box>
  );
}
