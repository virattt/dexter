import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';
import type { ApprovalDecision } from '../agent/types.js';

const OPTIONS: { label: string; decision: ApprovalDecision }[] = [
  { label: 'Yes', decision: 'allow-once' },
  { label: 'Yes, allow all edits this session', decision: 'allow-session' },
  { label: 'No', decision: 'deny' },
];

interface ApprovalPromptProps {
  tool: string;
  args: Record<string, unknown>;
  onSelect: (decision: ApprovalDecision) => void;
}

function formatToolLabel(tool: string): string {
  return tool
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ApprovalPrompt({ tool, args, onSelect }: ApprovalPromptProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(prev => Math.min(OPTIONS.length - 1, prev + 1));
    } else if (key.return) {
      onSelect(OPTIONS[selectedIndex].decision);
    } else if (key.escape) {
      onSelect('deny');
    }
  });

  const path = (args.path as string) || '<unknown>';

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="yellow"
      borderLeft={false}
      borderRight={false}
      width="100%"
      paddingX={1}
    >
      <Text color="yellow" bold>Permission required</Text>
      <Text>{formatToolLabel(tool)} {path}</Text>
      <Text color={colors.muted}>Do you want to allow this?</Text>
      <Box marginTop={1} flexDirection="column">
        {OPTIONS.map((opt, idx) => {
          const isSelected = idx === selectedIndex;
          const prefix = isSelected ? '> ' : '  ';
          return (
            <Text
              key={opt.decision}
              color={isSelected ? colors.primaryLight : colors.primary}
              bold={isSelected}
            >
              {prefix}{idx + 1}. {opt.label}
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to confirm · esc to deny</Text>
      </Box>
    </Box>
  );
}
