import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

interface WebSearchProviderSelectorProps {
  currentProvider?: any;
  onSelect: (provider: string) => void;
  onCancel?: () => void;
}

export function WebSearchProviderSelector({ currentProvider, onSelect, onCancel }: WebSearchProviderSelectorProps) {
  return (
    <Box flexDirection="column">
      <Text color={colors.primary}>Select Web Search Provider</Text>
    </Box>
  );
}
