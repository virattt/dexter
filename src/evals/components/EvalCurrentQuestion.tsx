import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../../theme.js';

interface EvalCurrentQuestionProps {
  question: string | null;
}

/**
 * Truncate string at word boundary
 */
function truncateAtWord(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  
  const lastSpace = str.lastIndexOf(' ', maxLength);
  if (lastSpace > maxLength * 0.5) {
    return str.slice(0, lastSpace) + '...';
  }
  
  return str.slice(0, maxLength) + '...';
}

/**
 * Shows the question currently being evaluated with a spinner
 * 
 * Example: ⠋ How has Netflix's Average Revenue Per Paying User Changed...
 */
export function EvalCurrentQuestion({ question }: EvalCurrentQuestionProps) {
  if (!question) {
    return null;
  }
  
  return (
    <Box>
      <Text color={colors.primary}>
        <Spinner type="dots" />
      </Text>
      <Text> {truncateAtWord(question, 65)}</Text>
    </Box>
  );
}
