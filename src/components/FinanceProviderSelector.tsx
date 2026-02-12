import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

interface FinanceProviderSelectorProps {
  currentProvider?: any;
  onSelect: (provider: string) => void;
  onCancel?: () => void;
}

export function FinanceProviderSelector({ currentProvider, onSelect, onCancel }: FinanceProviderSelectorProps) {
  return (
    <Box flexDirection="column">
      <Text color={colors.primary}>Select Finance Provider</Text>
    </Box>
  );
}
