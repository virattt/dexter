import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../theme.js';

export type WorkingState = 
  | { status: 'idle' }
  | { status: 'thinking' }
  | { status: 'tool'; toolName: string }
  | { status: 'answering' };

interface WorkingIndicatorProps {
  state: WorkingState;
}

const BAR_WIDTH = 28;

function SlimProgressBar() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((prev) => prev + 1), 120);
    return () => clearInterval(timer);
  }, []);

  const bar = useMemo(() => {
    const position = tick % BAR_WIDTH;
    const glow = (index: number) => (index === position ? '━' : '─');
    return Array.from({ length: BAR_WIDTH }, (_, idx) => glow(idx)).join('');
  }, [tick]);

  return (
    <Box>
      <Text color={colors.accent}>{bar}</Text>
    </Box>
  );
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
    case 'tool':
      statusText = 'Thinking... (esc to interrupt)';
      break;
    case 'answering':
      statusText = 'Writing response...';
      break;
  }
  
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.primary}>
          <Spinner type="dots" />
        </Text>
        <Text color={colors.muted}> {statusText}</Text>
      </Box>
      <SlimProgressBar />
    </Box>
  );
}
