import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../theme.js';

export type WorkingState = 
  | { status: 'idle' }
  | { status: 'thinking' }
  | { status: 'tool'; toolName: string }
  | { status: 'answering'; startTime: number };

interface WorkingIndicatorProps {
  state: WorkingState;
}

/**
 * Persistent status indicator shown above the input box while agent is working
 */
export function WorkingIndicator({ state }: WorkingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);
  
  // Track elapsed time only when answering
  useEffect(() => {
    if (state.status !== 'answering') {
      setElapsed(0);
      return;
    }
    
    const startTime = state.startTime;
    setElapsed(Math.floor((Date.now() - startTime) / 1000));
    
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [state]);
  
  if (state.status === 'idle') {
    return null;
  }
  
  let statusWord: string;
  let suffixEnd: string;
  switch (state.status) {
    case 'thinking':
    case 'tool':
      statusWord = 'Thinking...';
      suffixEnd = ' to interrupt)';
      break;
    case 'answering':
      statusWord = 'Answering';
      suffixEnd = ` to interrupt • ${elapsed}s)`;
      break;
  }
  
  return (
    <Box>
      <Text color={colors.primary}>
        <Spinner type="dots" />
      </Text>
      <Text color={colors.primary}> {statusWord}</Text>
      <Text color={colors.muted}> (</Text>
      <Text color={colors.muted} bold>esc</Text>
      <Text color={colors.muted}>{suffixEnd}</Text>
    </Box>
  );
}
