import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

import { colors } from '../theme.js';

interface InputProps {
  onSubmit: (value: string) => void;
  /** Value from history navigation (null = user typing fresh input) */
  historyValue?: string | null;
  /** Callback when user presses up/down arrow for history navigation */
  onHistoryNavigate?: (direction: 'up' | 'down') => void;
}

export function Input({ onSubmit, historyValue, onHistoryNavigate }: InputProps) {
  // Input manages its own state - typing won't cause parent re-renders
  const [value, setValue] = useState('');

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('[DEBUG Input] Component mounted, focus should be on TextInput');
    return () => {
      console.log('[DEBUG Input] Component unmounting');
    };
  }, []);

  // Update input value when history navigation changes
  useEffect(() => {
    if (historyValue === null) {
      // Returned to typing mode - clear input for fresh entry
      setValue('');
    } else if (historyValue !== undefined) {
      // Navigating history - show the historical message
      setValue(historyValue);
    }
  }, [historyValue]);

  // Intercept up/down arrow keys for history navigation
  useInput((input, key) => {
    console.log('[DEBUG Input] useInput captured:', { input, key });
    if (!onHistoryNavigate) return;

    if (key.upArrow) {
      onHistoryNavigate('up');
    } else if (key.downArrow) {
      onHistoryNavigate('down');
    }
  });

  const handleSubmit = (val: string) => {
    console.log('[DEBUG Input] handleSubmit called with:', val);
    if (!val.trim()) return;
    onSubmit(val);
    setValue('');
  };

  // Debug: Log value changes
  useEffect(() => {
    console.log('[DEBUG Input] Value changed to:', value);
  }, [value]);

  const handleChange = (newValue: string) => {
    console.log('[DEBUG Input] TextInput onChange:', newValue);
    setValue(newValue);
  };

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
        <TextInput
          value={value}
          onChange={handleChange}
          onSubmit={handleSubmit}
          focus={true}
        />
      </Box>
    </Box>
  );
}
