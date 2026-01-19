import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { colors } from '../theme.js';

type ConfigStep = 'name' | 'baseUrl' | 'apiKey' | 'modelId';

interface CustomProviderPromptProps {
  onSubmit: (config: {
    name: string;
    baseUrl: string;
    apiKey: string;
    modelId: string;
  } | null) => void;
}

export function CustomProviderPrompt({ onSubmit }: CustomProviderPromptProps) {
  const [step, setStep] = useState<ConfigStep>('name');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [inputValue, setInputValue] = useState('');

  useInput((input, key) => {
    if (key.escape) {
      onSubmit(null);
    }
  });

  const handleSubmit = (value: string) => {
    if (!value.trim()) {
      return;
    }

    switch (step) {
      case 'name':
        setName(value);
        setInputValue('');
        setStep('baseUrl');
        break;
      case 'baseUrl':
        setBaseUrl(value);
        setInputValue('');
        setStep('apiKey');
        break;
      case 'apiKey':
        setApiKey(value);
        setInputValue('');
        setStep('modelId');
        break;
      case 'modelId':
        setModelId(value);
        onSubmit({
          name,
          baseUrl,
          apiKey,
          modelId: value,
        });
        break;
    }
  };

  const getPromptText = (): string => {
    switch (step) {
      case 'name':
        return 'Enter provider name (e.g., "Groq", "Together AI"):';
      case 'baseUrl':
        return 'Enter base URL (e.g., "https://api.groq.com/openai/v1"):';
      case 'apiKey':
        return 'Enter API key:';
      case 'modelId':
        return 'Enter model ID (e.g., "mixtral-8x7b-32768"):';
    }
  };

  const getExampleText = (): string => {
    switch (step) {
      case 'name':
        return 'Examples: Groq, Together AI, Perplexity, OpenRouter';
      case 'baseUrl':
        return 'Must be OpenAI-compatible endpoint (usually ends with /v1)';
      case 'apiKey':
        return 'Your API key will be stored in .dexter/settings.json';
      case 'modelId':
        return 'Check your provider\'s documentation for available models';
    }
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Configure Custom Provider
      </Text>
      <Box marginTop={1}>
        <Text color={colors.muted}>{getExampleText()}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={colors.primary}>{getPromptText()}</Text>
        <Box marginTop={1}>
          <Text color={colors.primary} bold>{'> '}</Text>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            mask={step === 'apiKey' ? '*' : undefined}
          />
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>esc to cancel</Text>
      </Box>
    </Box>
  );
}
