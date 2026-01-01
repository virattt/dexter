import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';

interface ApiKeyConfirmProps {
  providerName: string;
  onConfirm: (wantsToSet: boolean) => void;
}

export function ApiKeyConfirm({ providerName, onConfirm }: ApiKeyConfirmProps) {
  useInput((input) => {
    const key = input.toLowerCase();
    if (key === 'y') {
      onConfirm(true);
    } else if (key === 'n') {
      onConfirm(false);
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Set API Key
      </Text>
      <Text>
        Would you like to set your {providerName} API key? <Text color={colors.muted}>(y/n)</Text>
      </Text>
    </Box>
  );
}

interface ApiKeyInputProps {
  providerName: string;
  apiKeyName: string;
  onSubmit: (apiKey: string | null) => void;
}

export function ApiKeyInput({ providerName, apiKeyName, onSubmit }: ApiKeyInputProps) {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (key.return) {
      onSubmit(value.trim() || null);
    } else if (key.escape) {
      onSubmit(null);
    } else if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setValue((prev) => prev + input);
    }
  });

  // Mask the API key for display
  const maskedValue = value.length > 0 ? '*'.repeat(value.length) : '';

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Enter {providerName} API Key
      </Text>
      <Text color={colors.muted}>
        ({apiKeyName})
      </Text>
      <Box marginTop={1}>
        <Text color={colors.primary}>{'> '}</Text>
        <Text>{maskedValue}</Text>
        <Text color={colors.muted}>█</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to confirm · Esc to cancel</Text>
      </Box>
    </Box>
  );
}

