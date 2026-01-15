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
    if (!onHistoryNavigate) return;

    if (key.upArrow) {
      onHistoryNavigate('up');
    } else if (key.downArrow) {
      onHistoryNavigate('down');
    }
  });

  const handleSubmit = (val: string) => {
    if (!val.trim()) return;
    onSubmit(val);
    setValue('');
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
          onChange={setValue}
          onSubmit={handleSubmit}
          focus={true}
        />
      </Box>
    </Box>
  );
}
