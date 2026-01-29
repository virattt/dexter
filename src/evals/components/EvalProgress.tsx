import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';

interface EvalProgressProps {
  completed: number;
  total: number;
}

/**
 * Visual progress bar showing evaluation completion percentage
 * 
 * Example: Evaluating ████████░░░░░░░░░░░░ 40% (6/15)
 */
export function EvalProgress({ completed, total }: EvalProgressProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barWidth = 20;
  const filledWidth = Math.round((completed / total) * barWidth) || 0;
  const emptyWidth = barWidth - filledWidth;
  
  const filledBar = '█'.repeat(filledWidth);
  const emptyBar = '░'.repeat(emptyWidth);
  
  return (
    <Box>
      <Text color={colors.muted}>Evaluating </Text>
      <Text color={colors.primary}>{filledBar}</Text>
      <Text color={colors.mutedDark}>{emptyBar}</Text>
      <Text color={colors.muted}> {percentage}% </Text>
      <Text color={colors.muted}>({completed}/{total})</Text>
    </Box>
  );
}
