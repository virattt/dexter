import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import { formatResponse } from '../utils/markdown-table.js';

interface AnswerBoxProps {
  text?: string;
  answer?: string;
}

export function AnswerBox({ text, answer }: AnswerBoxProps) {
  const content = answer ?? text ?? '';
  const lines = formatResponse(content).split('\n');

  return (
    <Box flexDirection="column" marginTop={1}>
      {lines.map((line, index) => (
        <Text key={`${index}-${line.slice(0, 10)}`} color={colors.primary}>
          {line}
        </Text>
      ))}
    </Box>
  );
}
