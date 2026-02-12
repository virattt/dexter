import React, { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';
import { WEB_SEARCH_PROVIDER_DEFS, type WebSearchProviderId, getWebSearchProviderDisplayName } from '../tools/search/providers.js';

interface WebSearchProviderSelectorProps {
  currentProvider?: WebSearchProviderId;
  onSelect: (provider: WebSearchProviderId | null) => void;
  onCancel?: () => void;
}

export function WebSearchProviderSelector({ currentProvider, onSelect, onCancel }: WebSearchProviderSelectorProps) {
  const providers = useMemo(
    () => (
      [
        { id: 'auto' as const, displayName: getWebSearchProviderDisplayName('auto') },
        ...WEB_SEARCH_PROVIDER_DEFS.map((p) => ({ id: p.id, displayName: p.displayName })),
      ]
    ),
    [],
  );

  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (!currentProvider) return 0;
    const idx = providers.findIndex((p) => p.id === currentProvider);
    return idx >= 0 ? idx : 0;
  });

  const wrapIndex = (index: number, length: number): number => {
    if (length <= 0) return 0;
    return (index + length) % length;
  };

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => wrapIndex(prev - 1, providers.length));
      return;
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => wrapIndex(prev + 1, providers.length));
      return;
    }
    if (key.return) {
      const selected = providers[selectedIndex];
      onSelect(selected?.id ?? null);
      return;
    }
    if (key.escape) {
      onCancel?.();
      onSelect(null);
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Select web search provider
      </Text>
      <Text color={colors.muted}>Choose which web search tool to use for browsing the web.</Text>
      <Box marginTop={1} flexDirection="column">
        {providers.map((p, idx) => {
          const isSelected = idx === selectedIndex;
          const isCurrent = currentProvider === p.id;
          const prefix = isSelected ? '> ' : '  ';
          return (
            <Text
              key={p.id}
              color={isSelected ? colors.primaryLight : colors.primary}
              bold={isSelected}
            >
              {prefix}
              {idx + 1}. {p.displayName}
              {isCurrent ? ' ✓' : ''}
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to confirm · esc to exit</Text>
      </Box>
    </Box>
  );
}
