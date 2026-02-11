import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';

interface PermissionPromptProps {
  path: string;
  operation: 'read' | 'write';
  onResponse: (granted: boolean) => void;
}

export function PermissionPrompt({ path, operation, onResponse }: PermissionPromptProps) {
  useInput((input) => {
    const key = input.toLowerCase();
    if (key === 'y') {
      onResponse(true);
    } else if (key === 'n') {
      onResponse(false);
    }
  });

  const operationText = operation === 'read' ? 'read from' : 'write to';

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Text color={colors.primary} bold>
        Permission Required
      </Text>
      <Box marginTop={1}>
        <Text>
          Allow Dexter to {operationText}: <Text color={colors.primary}>{path}</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>
          (y/n)
        </Text>
      </Box>
    </Box>
  );
}
