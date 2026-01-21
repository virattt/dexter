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
  const [, forceRender] = useState(0);

  // Update input buffer when history navigation changes
  useEffect(() => {
    if (historyValue === null) {
      // Returned to typing mode - clear input for fresh entry
      buffer.current = '';
      forceRender(x => x + 1);
    } else if (historyValue !== undefined) {
      // Navigating history - show the historical message
      buffer.current = historyValue;
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

    // Handle backspace/delete
    if (key.backspace || key.delete) {
      buffer.current = buffer.current.slice(0, -1);
      forceRender(x => x + 1);
      return;
    }

    // Handle submit
    if (key.return) {
      const val = buffer.current.trim();
      if (val) {
        onSubmit(val);
        buffer.current = '';
        forceRender(x => x + 1);
      }
      return;
    }

    // Handle regular character input (ignore control keys)
    if (input && !key.ctrl && !key.meta) {
      buffer.current += input;
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
        <Text>{buffer.current}</Text>
        <Text color={colors.muted}>█</Text>
      </Box>
    </Box>
  );
}
