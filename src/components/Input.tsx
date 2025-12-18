import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

import { colors } from '../theme.js';

interface InputProps {
  onSubmit: (value: string) => void;
}

export function Input({ onSubmit }: InputProps) {
  // Input manages its own state - typing won't cause parent re-renders
  const [value, setValue] = useState('');

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
      borderColor={colors.muted}
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
