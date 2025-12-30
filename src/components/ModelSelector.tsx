import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';

interface Model {
  displayName: string;
  modelId: string;
  description: string;
}

const MODELS: Model[] = [
  {
    displayName: 'GPT 5.2',
    modelId: 'gpt-5.2',
    description: "OpenAI's flagship model",
  },
  {
    displayName: 'GPT 5 Mini',
    modelId: 'gpt-5-mini',
    description: "OpenAI's fast, cost-efficient model",
  },
  {
    displayName: 'Azure GPT-4o',
    modelId: 'azure-gpt-4o',
    description: 'Azure OpenAI (deployment: gpt-4o)',
  },
   {
    displayName: 'Azure GPT-5-mini',
    modelId: 'azure-gpt-5-mini',
    description: 'Azure OpenAI (deployment: gpt-5-mini)',
  },
  {
    displayName: 'Sonnet 4.5',
    modelId: 'claude-sonnet-4-5',
    description: "Anthropic's best model for complex agents",
  },
  {
    displayName: 'Gemini 3',
    modelId: 'gemini-3',
    description: "Google's most intelligent model",
  },
];

interface ModelSelectorProps {
  model?: string;
  models?: Model[];
  title?: string;
  subtitle?: string;
  onSelect: (modelId: string | null) => void;
}

export function ModelSelector({ model, models, title, subtitle, onSelect }: ModelSelectorProps) {
  const modelList = models ?? MODELS;
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (model) {
      const idx = modelList.findIndex((m) => m.modelId === model);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(modelList.length - 1, prev + 1));
    } else if (key.return) {
      onSelect(modelList[selectedIndex].modelId);
    } else if (key.escape) {
      onSelect(null);
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        {title ?? 'Select model'}
      </Text>
      <Text color={colors.muted}>
        {subtitle ?? 'Switch between LLM models. Applies to this session and future sessions.'}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {modelList.map((m, idx) => {
          const isSelected = idx === selectedIndex;
          const isCurrent = model === m.modelId;
          const prefix = isSelected ? '> ' : '  ';

          return (
            <Text
              key={m.modelId}
              color={isSelected ? colors.primaryLight : colors.primary}
              bold={isSelected}
            >
              {prefix}
              {idx + 1}. {m.displayName} · {m.description}
              {isCurrent ? ' ✓' : ''}
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to confirm · Esc to exit</Text>
      </Box>
    </Box>
  );
}

export { MODELS };
