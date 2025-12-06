import React from 'react';
import { Box, Text } from 'ink';
import { colors, dimensions } from '../theme.js';

export function Intro() {
  const { introWidth } = dimensions;
  const welcomeText = 'Welcome to Dexter';
  const padding = Math.floor((introWidth - welcomeText.length - 2) / 2);

  return (
    <Box flexDirection="column" marginTop={2}>
      <Text color={colors.primary}>{'═'.repeat(introWidth)}</Text>
      <Text color={colors.primary}>
        ║{' '.repeat(padding)}
        <Text bold>{welcomeText}</Text>
        {' '.repeat(introWidth - welcomeText.length - padding - 2)}║
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

      <Box marginTop={1} flexDirection="column">
        <Text color={colors.primary}>Your AI assistant for deep financial research.</Text>
        <Text color={colors.muted}>Press Ctrl+C to quit. Type /model to change the model.</Text>
      </Box>
    </Box>
  );
}
