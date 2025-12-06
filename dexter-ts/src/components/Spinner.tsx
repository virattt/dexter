import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { colors } from '../theme.js';

interface SpinnerProps {
  message: string;
  color?: string;
}

export function Spinner({ message, color = colors.primary }: SpinnerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box>
      <Text color={color}>
        <InkSpinner type="dots" />
      </Text>
      <Text color={color}> {message}</Text>
      <Text color={colors.muted}> ({elapsedSeconds}s)</Text>
    </Box>
  );
}

interface SpinnerResultProps {
  message: string;
  success: boolean;
}

export function SpinnerResult({ message, success }: SpinnerResultProps) {
  return (
    <Box>
      <Text color={success ? colors.success : colors.error}>{success ? '✓' : '✗'}</Text>
      <Text> {message}</Text>
    </Box>
  );
}
