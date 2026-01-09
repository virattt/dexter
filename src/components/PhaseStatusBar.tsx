import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';
import type { Phase } from '../agent/state.js';
import { colors } from '../theme.js';

// ============================================================================
// Phase Labels
// ============================================================================

/**
 * Maps phase states to user-friendly labels.
 */
export const phaseLabels: Record<Phase, string> = {
  understand: 'Understanding...',
  plan: 'Planning...',
  execute: 'Working...',
  reflect: 'Reflecting...',
  answer: 'Answering...',
  complete: 'Complete',
};

// ============================================================================
// Phase Status Bar Component
// ============================================================================

interface PhaseStatusBarProps {
  phase: Phase;
  isAnswering?: boolean;
}

/**
 * Single-line status bar showing the current phase with a spinner.
 * Positioned directly above the input component.
 */
export const PhaseStatusBar = React.memo(function PhaseStatusBar({
  phase,
  isAnswering = false,
}: PhaseStatusBarProps) {
  // Don't show anything if complete
  if (phase === 'complete') {
    return null;
  }

  // Use answering label if in answer phase or explicitly answering
  const label = isAnswering ? phaseLabels.answer : phaseLabels[phase];

  return (
    <Box>
      <Text color={colors.primary}>
        <InkSpinner type="dots" />
      </Text>
      <Text> </Text>
      <Text color={colors.primary}>{label}</Text>
      <Text color={colors.muted}> (</Text>
      <Text color={colors.muted} bold>esc</Text>
      <Text color={colors.muted}> to interrupt)</Text>
    </Box>
  );
});
