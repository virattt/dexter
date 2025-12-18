import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { colors } from '../theme.js';
import type { AgentState, Iteration } from '../agent/schemas.js';

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Status icon - dots spinner when active, checkmark when complete
 */
function StatusIcon({ active }: { active: boolean }) {
  if (active) {
    return (
      <Text color={colors.accent}>
        <InkSpinner type="dots" />
      </Text>
    );
  }
  return <Text color={colors.success}>✓</Text>;
}

// ============================================================================
// Iteration View (Claude Code style)
// ============================================================================

interface IterationViewProps {
  iteration: Iteration;
  isActive: boolean;
}

const IterationView = React.memo(function IterationView({ iteration, isActive }: IterationViewProps) {
  if (!iteration.thinking) {
    return (
      <Box>
        <StatusIcon active={true} />
        <Text color={colors.primary}> Thinking...</Text>
      </Box>
    );
  }

  return (
    <Box marginBottom={1}>
      <StatusIcon active={isActive} />
      <Text> </Text>
      <Text color={colors.muted}>{iteration.thinking.thought}</Text>
    </Box>
  );
});

// ============================================================================
// Main Component
// ============================================================================

interface AgentProgressViewProps {
  state: AgentState;
}

/**
 * Displays the agent's progress in Claude Code style.
 * Shows tasks with progress circles and nested tool calls.
 */
export const AgentProgressView = React.memo(function AgentProgressView({ state }: AgentProgressViewProps) {
  if (state.iterations.length === 0) {
    return (
      <Box marginTop={1}>
        <StatusIcon active={true} />
        <Text color={colors.primary}> Starting...</Text>
      </Box>
    );
  }

  const isAnswering = state.status === 'answering';
  const isDone = state.status === 'done';
  const allComplete = isAnswering || isDone;

  // When answering/done, only show iterations that have thinking content
  const visibleIterations = allComplete
    ? state.iterations.filter(it => it.thinking)
    : state.iterations;

  return (
    <Box flexDirection="column" marginTop={1}>
      {visibleIterations.map((iteration) => (
        <IterationView
          key={iteration.id}
          iteration={iteration}
          isActive={!allComplete && iteration.status !== 'completed'}
        />
      ))}
      {isAnswering && (
        <Box>
          <StatusIcon active={true} />
          <Text color={colors.primary}> Generating answer...</Text>
        </Box>
      )}
    </Box>
  );
});

// ============================================================================
// Current Turn View V2
// ============================================================================

interface CurrentTurnViewV2Props {
  query: string;
  state: AgentState;
}

/**
 * Full current turn view including query and progress
 */
export const CurrentTurnViewV2 = React.memo(function CurrentTurnViewV2({ query, state }: CurrentTurnViewV2Props) {
  return (
    <Box flexDirection="column">
      {/* User query */}
      <Box marginBottom={1}>
        <Text color={colors.primary} bold>{'> '}</Text>
        <Text>{query}</Text>
      </Box>

      {/* Agent progress */}
      <AgentProgressView state={state} />
    </Box>
  );
});
