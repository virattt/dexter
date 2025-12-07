import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

interface QueueDisplayProps {
  queries: string[];
}

export function QueueDisplay({ queries }: QueueDisplayProps) {
  if (queries.length === 0) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.muted}>Queued ({queries.length}):</Text>
      {queries.map((q, i) => (
        <Text key={i} dimColor>
          {'  '}{i + 1}. {q.length > 60 ? q.slice(0, 57) + '...' : q}
        </Text>
      ))}
    </Box>
  );
}
