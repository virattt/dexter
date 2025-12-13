import { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import TextInput from 'ink-text-input';

import { colors } from '../theme.js';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

function useTerminalWidth(): number {
  const { stdout } = useStdout();
  const [width, setWidth] = useState(stdout?.columns ?? 80);

  useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      setWidth(stdout.columns);
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return width;
}

function HorizontalBar() {
  const width = useTerminalWidth();
  return <Text color={colors.muted}>{'─'.repeat(width)}</Text>;
}

export function Input({ value, onChange, onSubmit }: InputProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <HorizontalBar />
      <Box>
        <Text color={colors.primary} bold>
          {'> '}
        </Text>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          focus={true}
        />
      </Box>
      <HorizontalBar />
    </Box>
  );
}
