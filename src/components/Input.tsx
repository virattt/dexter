import React, { useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

import { colors } from '../theme.js';
import { useTextBuffer } from '../hooks/useTextBuffer.js';
import { cursorHandlers } from '../utils/input-key-handlers.js';
import { CursorText } from './CursorText.js';

interface InputProps {
  onSubmit: (value: string) => void;
  /** Value from history navigation (null = user typing fresh input) */
  historyValue?: string | null;
  /** Callback when user presses up/down arrow for history navigation */
  onHistoryNavigate?: (direction: 'up' | 'down') => void;
}

export function Input({ onSubmit, historyValue, onHistoryNavigate }: InputProps) {
  const { text, cursorPosition, actions } = useTextBuffer();

  // Update input buffer when history navigation changes
  useEffect(() => {
    if (historyValue === null) {
      // Returned to typing mode - clear input for fresh entry
      actions.clear();
    } else if (historyValue !== undefined) {
      // Navigating history - show the historical message
      actions.setValue(historyValue);
    }
  }, [historyValue]);

  // Handle all input
  useInput((input, key) => {
    const ctx = { text, cursorPosition };

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
      actions.moveCursor(cursorHandlers.moveLeft(ctx));
      return;
    }

    // Cursor movement - right arrow (plain, no modifiers)
    if (key.rightArrow && !key.ctrl && !key.meta) {
      actions.moveCursor(cursorHandlers.moveRight(ctx));
      return;
    }

    // Ctrl+A - move to beginning of line
    if (key.ctrl && input === 'a') {
      actions.moveCursor(cursorHandlers.moveToStart());
      return;
    }

    // Ctrl+E - move to end of line
    if (key.ctrl && input === 'e') {
      actions.moveCursor(cursorHandlers.moveToEnd(ctx));
      return;
    }

    // Option+Left (Mac) / Ctrl+Left (Windows) / Alt+B - word backward
    if ((key.meta && key.leftArrow) || (key.ctrl && key.leftArrow) || (key.meta && input === 'b')) {
      actions.moveCursor(cursorHandlers.moveWordBackward(ctx));
      return;
    }

    // Option+Right (Mac) / Ctrl+Right (Windows) / Alt+F - word forward
    if ((key.meta && key.rightArrow) || (key.ctrl && key.rightArrow) || (key.meta && input === 'f')) {
      actions.moveCursor(cursorHandlers.moveWordForward(ctx));
      return;
    }

    // Handle backspace/delete - delete character before cursor
    if (key.backspace || key.delete) {
      actions.deleteBackward();
      return;
    }

    // Handle submit
    if (key.return) {
      const val = text.trim();
      if (val) {
        onSubmit(val);
        actions.clear();
      }
      return;
    }

    // Handle regular character input - insert at cursor position
    if (input && !key.ctrl && !key.meta) {
      actions.insert(input);
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
        <CursorText text={text} cursorPosition={cursorPosition} />
      </Box>
    </Box>
  );
}
