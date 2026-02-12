import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';

export type OpenAIAuthMethod = 'oauth' | 'api_key';

interface OpenAIAuthMethodPromptProps {
  onSelect: (method: OpenAIAuthMethod | null) => void;
}

const AUTH_METHODS: Array<{ id: OpenAIAuthMethod; label: string; description: string }> = [
  {
    id: 'oauth',
    label: 'OpenAI OAuth (ChatGPT Pro/Plus)',
    description: 'Login in browser with a one-time code.',
  },
  {
    id: 'api_key',
    label: 'Manual API Key',
    description: 'Enter OPENAI_API_KEY directly.',
  },
];

export function OpenAIAuthMethodPrompt({ onSelect }: OpenAIAuthMethodPromptProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(AUTH_METHODS.length - 1, prev + 1));
    } else if (key.return) {
      onSelect(AUTH_METHODS[selectedIndex]?.id ?? null);
    } else if (key.escape) {
      onSelect(null);
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        OpenAI Authentication
      </Text>
      <Text color={colors.muted}>
        Choose how Dexter should authenticate with OpenAI.
      </Text>
      <Box marginTop={1} flexDirection="column">
        {AUTH_METHODS.map((method, idx) => {
          const isSelected = idx === selectedIndex;
          const prefix = isSelected ? '> ' : '  ';

          return (
            <Box key={method.id} flexDirection="column" marginBottom={1}>
              <Text color={isSelected ? colors.primaryLight : colors.primary} bold={isSelected}>
                {prefix}
                {idx + 1}. {method.label}
              </Text>
              <Text color={colors.muted}>   {method.description}</Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to confirm · esc to go back</Text>
      </Box>
    </Box>
  );
}

interface OpenAIOAuthWaitProps {
  verificationUrl: string;
  userCode: string;
}

export function OpenAIOAuthWait({ verificationUrl, userCode }: OpenAIOAuthWaitProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        OpenAI OAuth
      </Text>
      <Text>1. Open: <Text color={colors.primaryLight}>{verificationUrl}</Text></Text>
      <Text>2. Enter code: <Text color={colors.primaryLight} bold>{userCode}</Text></Text>
      <Text>3. Complete approval in browser.</Text>
      <Box marginTop={1}>
        <Text color={colors.muted}>Waiting for authorization... Press esc to cancel.</Text>
      </Box>
    </Box>
  );
}
