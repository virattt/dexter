import React from 'react';
import { Box, Text } from 'ink';

interface StatusMessageProps {
  message: string | null;
}

/**
 * Displays a status message (dimmed text)
 */
export function StatusMessage({ message }: StatusMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <Box marginTop={1}>
      <Text dimColor>{message}</Text>
    </Box>
  );
}

