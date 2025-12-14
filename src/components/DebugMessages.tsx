import React from 'react';
import { Box, Text } from 'ink';

interface DebugMessagesProps {
  messages: string[];
}

/**
 * Displays debug messages from the agent execution
 */
export function DebugMessages({ messages }: DebugMessagesProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {messages.map((msg, i) => (
        <Text key={i} dimColor>[DEBUG] {msg}</Text>
      ))}
    </Box>
  );
}

