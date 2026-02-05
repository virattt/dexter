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
    models: ['claude-sonnet-4-5', 'claude-opus-4-6'],
  },
  {
    displayName: 'Google',
    providerId: 'google',
    models: ['gemini-3-flash-preview', 'gemini-3-pro-preview'],
  },
  {
    displayName: 'xAI',
    providerId: 'xai',
    models: ['grok-4-0709', 'grok-4-1-fast-reasoning'],
  },
  {
    displayName: 'OpenRouter',
    providerId: 'openrouter',
    models: [], // User types model name directly
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

interface ModelInputFieldProps {
  providerId: string;
  currentModel?: string;
  onSubmit: (modelId: string | null) => void;
}

export function ModelInputField({ providerId, currentModel, onSubmit }: ModelInputFieldProps) {
  // Extract existing model name if it has the openrouter: prefix
  const initialValue = currentModel?.startsWith('openrouter:')
    ? currentModel.replace(/^openrouter:/, '')
    : '';
  
  const [inputValue, setInputValue] = useState(initialValue);
  
  const provider = PROVIDERS.find((p) => p.providerId === providerId);
  const providerName = provider?.displayName ?? providerId;

  useInput((input, key) => {
    if (key.return) {
      const trimmed = inputValue.trim();
      if (trimmed) {
        onSubmit(trimmed);
      }
    } else if (key.escape) {
      onSubmit(null);
    } else if (key.backspace || key.delete) {
      setInputValue((prev) => prev.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setInputValue((prev) => prev + input);
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Enter model name for {providerName}
      </Text>
      <Text color={colors.muted}>
        Type or paste the model name from openrouter.ai/models
      </Text>
      <Box marginTop={1}>
        <Text color={colors.primaryLight}>{'> '}</Text>
        <Text color={colors.primary}>{inputValue}</Text>
        <Text color={colors.primaryLight}>_</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={colors.muted}>
          Examples: anthropic/claude-3.5-sonnet, openai/gpt-4-turbo, meta-llama/llama-3-70b
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to confirm · esc to go back</Text>
      </Box>
    </Box>
  );
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
