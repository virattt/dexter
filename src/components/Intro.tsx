import React from 'react';
import { Box, Text } from 'ink';
import { colors, dimensions } from '../theme.js';
import packageJson from '../../package.json';

interface IntroProps {
  provider: string;
  model: string;
}

export function Intro({ provider, model }: IntroProps) {
  const { introWidth } = dimensions;
  const welcomeText = 'Welcome to Ubbex';
  const versionText = ` v${packageJson.version}`;
  const fullText = welcomeText + versionText;
  const padding = Math.floor((introWidth - fullText.length - 2) / 2);

  return (
    <Box flexDirection="column" marginTop={2}>
      <Text color={colors.primary}>{'═'.repeat(introWidth)}</Text>
      <Text color={colors.primary}>
        ║{' '.repeat(padding)}
        <Text bold>{welcomeText}</Text>
        <Text color={colors.muted}>{versionText}</Text>
        {' '.repeat(introWidth - fullText.length - padding - 2)}║
      </Text>
      <Text color={colors.primary}>{'═'.repeat(introWidth)}</Text>

      <Box marginTop={1}>
        <Text color={colors.primary} bold>
          {`
██████╗ ███████╗██╗  ██╗████████╗███████╗██████╗ 
██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝██╔════╝██╔══██╗
██║  ██║█████╗   ╚███╔╝    ██║   █████╗  ██████╔╝
██║  ██║██╔══╝   ██╔██╗    ██║   ██╔══╝  ██╔══██╗
██████╔╝███████╗██╔╝ ██╗   ██║   ███████╗██║  ██║
╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝`}
        </Text>
      </Box>

      <Box marginY={1} flexDirection="column">
        <Text>An agentic coding assistant that lives in your terminal.</Text>
        <Text color={colors.muted}>Understands codebases • Writes & debugs code • Automates tasks • Handles git workflows</Text>
        <Text color={colors.muted}>Current model: <Text color={colors.primary}>{model}</Text></Text>
        {/* <Text color={colors.muted}>Current provider: <Text color={colors.primary}>{getProviderDisplayName(provider)}</Text></Text> */}
        <Text color={colors.muted}>Type /model to change the provider.</Text>
      </Box>
    </Box>
  );
}
