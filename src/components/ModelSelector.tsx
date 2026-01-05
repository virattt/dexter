import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';

export interface ModelConfig {
  small: string;
  medium: string;
  large: string;
}

interface Provider {
  displayName: string;
  providerId: string;
  modelConfig: ModelConfig;
  description: string;
}

const PROVIDERS: Provider[] = [
  {
    displayName: 'OpenAI',
    providerId: 'openai',
    modelConfig: {
      small: 'gpt-5.2',
      medium: 'gpt-5.2',
      large: 'gpt-5.2',
    },
    description: "GPT 5.2 - OpenAI's flagship model",
  },
  {
    displayName: 'Anthropic',
    providerId: 'anthropic',
    modelConfig: {
      small: 'claude-sonnet-4-5',
      medium: 'claude-sonnet-4-5',
      large: 'claude-sonnet-4-5',
    },
    description: "Sonnet 4.5 - Best for complex agents",
  },
  {
    displayName: 'Google',
    providerId: 'google',
    modelConfig: {
      small: 'gemini-3',
      medium: 'gemini-3',
      large: 'gemini-3',
    },
    description: "Gemini 3 - Google's most intelligent model",
  },
];

export function getModelConfigForProvider(providerId: string): ModelConfig | undefined {
  const provider = PROVIDERS.find((p) => p.providerId === providerId);
  return provider?.modelConfig;
}

export function getModelForProvider(
  providerId: string,
  size: 'small' | 'medium' | 'large'
): string | undefined {
  const config = getModelConfigForProvider(providerId);
  return config?.[size];
}

export function getModelIdForProvider(providerId: string): string | undefined {
  const config = getModelConfigForProvider(providerId);
  return config?.large;
}

export function getProviderIdForModel(modelId: string): string | undefined {
  const provider = PROVIDERS.find((p) => 
    p.modelConfig.small === modelId || 
    p.modelConfig.medium === modelId || 
    p.modelConfig.large === modelId
  );
  return provider?.providerId;
}

interface ProviderSelectorProps {
  provider?: string;
  onSelect: (providerId: string | null) => void;
}

export function ProviderSelector({ provider, onSelect }: ProviderSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (provider) {
      const idx = PROVIDERS.findIndex((p) => p.providerId === provider);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(PROVIDERS.length - 1, prev + 1));
    } else if (key.return) {
      onSelect(PROVIDERS[selectedIndex].providerId);
    } else if (key.escape) {
      onSelect(null);
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Select provider
      </Text>
      <Text color={colors.muted}>
        Switch between LLM providers. Applies to this session and future sessions.
      </Text>
      <Box marginTop={1} flexDirection="column">
        {PROVIDERS.map((p, idx) => {
          const isSelected = idx === selectedIndex;
          const isCurrent = provider === p.providerId;
          const prefix = isSelected ? '> ' : '  ';

          return (
            <Text
              key={p.providerId}
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

export { PROVIDERS };
