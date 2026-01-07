import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';

interface Provider {
  displayName: string;
  providerId: string;
  models: string[];
}

const PROVIDERS: Provider[] = [
  {
    displayName: 'OpenAI',
    providerId: 'openai',
    models: ['gpt-5.2', 'gpt-4.1'],
  },
  {
    displayName: 'Anthropic',
    providerId: 'anthropic',
    models: ['claude-sonnet-4-5', 'claude-opus-4-5'],
  },
  {
    displayName: 'Google',
    providerId: 'google',
    models: ['gemini-3-flash-preview', 'gemini-3-pro-preview'],
  },
  {
    displayName: 'Ollama',
    providerId: 'ollama',
    models: [], // Populated dynamically from local Ollama API
  },
];

export function getModelsForProvider(providerId: string): string[] {
  const provider = PROVIDERS.find((p) => p.providerId === providerId);
  return provider?.models ?? [];
}

export function getDefaultModelForProvider(providerId: string): string | undefined {
  const models = getModelsForProvider(providerId);
  return models[0];
}

export function getProviderIdForModel(modelId: string): string | undefined {
  // For ollama models, they're prefixed with "ollama:"
  if (modelId.startsWith('ollama:')) {
    return 'ollama';
  }
  for (const provider of PROVIDERS) {
    if (provider.models.includes(modelId)) {
      return provider.providerId;
    }
  }
  return undefined;
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

interface ModelSelectorProps {
  providerId: string;
  models: string[];
  currentModel?: string;
  onSelect: (modelId: string | null) => void;
}

export function ModelSelector({ providerId, models, currentModel, onSelect }: ModelSelectorProps) {
  // For Ollama, the currentModel is stored with "ollama:" prefix, but models list doesn't have it
  const normalizedCurrentModel = providerId === 'ollama' && currentModel?.startsWith('ollama:')
    ? currentModel.replace(/^ollama:/, '')
    : currentModel;

  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (normalizedCurrentModel) {
      const idx = models.findIndex((m) => m === normalizedCurrentModel);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  const provider = PROVIDERS.find((p) => p.providerId === providerId);
  const providerName = provider?.displayName ?? providerId;

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(models.length - 1, prev + 1));
    } else if (key.return) {
      if (models.length > 0) {
        onSelect(models[selectedIndex]);
      }
    } else if (key.escape) {
      onSelect(null);
    }
  });

  if (models.length === 0) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.primary} bold>
          Select model for {providerName}
        </Text>
        <Box marginTop={1}>
          <Text color={colors.muted}>No models available. </Text>
          {providerId === 'ollama' && (
            <Text color={colors.muted}>
              Make sure Ollama is running and you have models downloaded.
            </Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text color={colors.muted}>esc to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Select model for {providerName}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {models.map((model, idx) => {
          const isSelected = idx === selectedIndex;
          const isCurrent = normalizedCurrentModel === model;
          const prefix = isSelected ? '> ' : '  ';

          return (
            <Text
              key={model}
              color={isSelected ? colors.primaryLight : colors.primary}
              bold={isSelected}
            >
              {prefix}
              {idx + 1}. {model}
              {isCurrent ? ' ✓' : ''}
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to confirm · esc to go back</Text>
      </Box>
    </Box>
  );
}

export { PROVIDERS };
