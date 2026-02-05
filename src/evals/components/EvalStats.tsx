import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';

interface EvalStatsProps {
  correct: number;
  incorrect: number;
  startTime: number;
}

/**
 * Format elapsed time as Xm Ys
 */
function formatElapsed(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Live stats display showing correct/incorrect counts and elapsed time
 * 
 * Example: ✓ 5 correct  ✗ 1 incorrect  ⏱ 2m 34s
 */
export function EvalStats({ correct, incorrect, startTime }: EvalStatsProps) {
  const [, setTick] = useState(0);
  
  // Update every second to refresh elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <Box gap={2}>
      <Text color={colors.success}>✓ {correct} correct</Text>
      <Text color={colors.error}>✗ {incorrect} incorrect</Text>
      <Text color={colors.muted}>⏱ {formatElapsed(startTime)}</Text>
    </Box>
  );
}
