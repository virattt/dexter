import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';

export interface EvalResult {
  question: string;
  score: number;
  comment: string;
}

interface EvalRecentResultsProps {
  results: EvalResult[];
  maxDisplay?: number;
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
 * Shows the last N evaluation results with pass/fail indicators
 * 
 * Example:
 * Recent:
 * ✓ Who is the current CFO of Airbnb?
 * ✗ Calculate the 3 year revenue CAGR for Palantir...
 * ✓ What was FND same-store sales growth in Q4 2024?
 */
export function EvalRecentResults({ results, maxDisplay = 5 }: EvalRecentResultsProps) {
  if (results.length === 0) {
    return null;
  }
  
  const recentResults = results.slice(-maxDisplay);
  
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.muted}>Recent:</Text>
      {recentResults.map((result, index) => {
        const isCorrect = result.score === 1;
        const icon = isCorrect ? '✓' : '✗';
        const iconColor = isCorrect ? colors.success : colors.error;
        
        return (
          <Box key={index}>
            <Text color={iconColor}>{icon} </Text>
            <Text>{truncateAtWord(result.question, 60)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
