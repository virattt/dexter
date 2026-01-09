import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import { TaskListView } from './TaskListView.js';
import type { Phase, Task } from '../agent/state.js';

// ============================================================================
// Types
// ============================================================================

/**
 * State for the agent progress view.
 */
export interface AgentProgressState {
  currentPhase: Phase;
  understandComplete: boolean;
  planComplete: boolean;
  executeComplete: boolean;
  reflectComplete: boolean;
  tasks: Task[];
  isAnswering: boolean;
  progressMessage?: string;
}

// ============================================================================
// Agent Progress View
// ============================================================================

interface AgentProgressViewProps {
  state: AgentProgressState;
}

/**
 * Displays the agent's progress:
 * - Task list with status and tool calls
 * 
 * Phase indicators are now shown separately in PhaseStatusBar.
 */
export const AgentProgressView = React.memo(function AgentProgressView({
  state
}: AgentProgressViewProps) {
  const { tasks } = state;

  // Only render if there are tasks to show
  if (tasks.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Task list */}
      <Box marginLeft={2} flexDirection="column">
        <TaskListView tasks={tasks} />
      </Box>
    </Box>
  );
});

// ============================================================================
// Current Turn View
// ============================================================================

interface CurrentTurnViewProps {
  query: string;
  state: AgentProgressState;
}

/**
 * Full current turn view including query and task list.
 * Phase status is shown separately above the input.
 */
export const CurrentTurnView = React.memo(function CurrentTurnView({ 
  query, 
  state 
}: CurrentTurnViewProps) {
  return (
    <Box flexDirection="column">
      {/* User query */}
      <Box marginBottom={1}>
        <Text color={colors.primary} bold>{'❯ '}</Text>
        <Text color={colors.white} backgroundColor={colors.queryBg}>{` ${query} `}</Text>
      </Box>

      {/* Task list */}
      <AgentProgressView state={state} />
    </Box>
  );
});
