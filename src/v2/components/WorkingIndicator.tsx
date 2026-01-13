import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../../theme.js';

export type WorkingState = 
  | { status: 'idle' }
  | { status: 'thinking' }
  | { status: 'tool'; toolName: string }
  | { status: 'answering' };

interface WorkingIndicatorProps {
  state: WorkingState;
}

/**
 * Persistent status indicator shown above the input box while agent is working
 */
export function WorkingIndicator({ state }: WorkingIndicatorProps) {
  if (state.status === 'idle') {
    return null;
  }
  
  let statusText: string;
  switch (state.status) {
    case 'thinking':
      statusText = 'Thinking...';
      break;
    case 'tool':
      statusText = `Calling ${state.toolName}...`;
      break;
    case 'answering':
      statusText = 'Writing response...';
      break;
  }
  
  return (
    <Box>
      <Text color={colors.primary}>
        <Spinner type="dots" />
      </Text>
      <Text color={colors.muted}> {statusText}</Text>
    </Box>
  );
}
