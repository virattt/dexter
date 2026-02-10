import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';
import { PROVIDERS as PROVIDER_DEFS } from '@/providers';

export interface Model {
  id: string;          // API model identifier (e.g., "claude-opus-4-6")
  displayName: string; // Human-readable name (e.g., "Opus 4.6")
}

interface Provider {
  displayName: string;
  providerId: string;
  models: Model[];
}

// UI-specific model lists per provider (presentation data only)
const PROVIDER_MODELS: Record<string, Model[]> = {
  openai: [
    { id: 'gpt-5.2', displayName: 'GPT 5.2' },
    { id: 'gpt-4.1', displayName: 'GPT 4.1' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-5', displayName: 'Sonnet 4.5' },
    { id: 'claude-opus-4-6', displayName: 'Opus 4.6' },
  ],
  google: [
    { id: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash' },
    { id: 'gemini-3-pro-preview', displayName: 'Gemini 3 Pro' },
  ],
  xai: [
    { id: 'grok-4-0709', displayName: 'Grok 4' },
    { id: 'grok-4-1-fast-reasoning', displayName: 'Grok 4.1 Fast Reasoning' },
  ],
  moonshot: [
    { id: 'kimi-k2-5', displayName: 'Kimi K2.5' },
  ],
  deepseek: [
    { id: 'deepseek-chat', displayName: 'DeepSeek V3' },
    { id: 'deepseek-reasoner', displayName: 'DeepSeek R1' },
  ],
};

// Derive the provider list from the canonical registry, attaching local model lists
const PROVIDERS: Provider[] = PROVIDER_DEFS.map((p) => ({
  displayName: p.displayName,
  providerId: p.id,
  models: PROVIDER_MODELS[p.id] ?? [],
}));

export function getModelsForProvider(providerId: string): Model[] {
  const provider = PROVIDERS.find((p) => p.providerId === providerId);
  return provider?.models ?? [];
}

export function getModelIdsForProvider(providerId: string): string[] {
  return getModelsForProvider(providerId).map((m) => m.id);
}

export function getDefaultModelForProvider(providerId: string): string | undefined {
  const models = getModelsForProvider(providerId);
  return models[0]?.id;
}

export function getModelDisplayName(modelId: string): string {
  // Handle prefixed model IDs (e.g., "ollama:llama3", "openrouter:anthropic/claude-3.5")
  const normalizedId = modelId.replace(/^(ollama|openrouter):/, '');
  
  // Search through all providers for the model
  for (const provider of PROVIDERS) {
    const model = provider.models.find((m) => m.id === normalizedId || m.id === modelId);
    if (model) {
      return model.displayName;
    }
  }
  
  // Fallback: return the model ID as-is (for dynamic models like Ollama or OpenRouter)
  return normalizedId;
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
  models: Model[];
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
      const idx = models.findIndex((m) => m.id === normalizedCurrentModel);
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
        onSelect(models[selectedIndex].id);
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
          const isCurrent = normalizedCurrentModel === model.id;
          const prefix = isSelected ? '> ' : '  ';

          return (
            <Text
              key={model.id}
              color={isSelected ? colors.primaryLight : colors.primary}
              bold={isSelected}
            >
              {prefix}
              {idx + 1}. {model.displayName}
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
