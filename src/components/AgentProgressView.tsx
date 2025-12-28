import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';
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
  reflectComplete: boolean;
  tasks: Task[];
  isAnswering: boolean;
}

// ============================================================================
// Status Icon Component
// ============================================================================

interface StatusIconProps {
  complete: boolean;
  active: boolean;
  pending?: boolean;
}

function StatusIcon({ complete, active, pending }: StatusIconProps) {
  if (complete) {
    return <Text color={colors.success}>✓</Text>;
  }
  if (active) {
    return (
      <Text color={colors.accent}>
        <InkSpinner type="dots" />
      </Text>
    );
  }
  if (pending) {
    return <Text color={colors.muted}>○</Text>;
  }
  return null;
}

// ============================================================================
// Phase Indicator Component
// ============================================================================

interface PhaseIndicatorProps {
  label: string;
  complete: boolean;
  active: boolean;
}

function PhaseIndicator({ label, complete, active }: PhaseIndicatorProps) {
  if (!complete && !active) return null;
  
  const textColor = complete ? colors.muted : colors.primary;
  
  return (
    <Box>
      <StatusIcon complete={complete} active={active} />
      <Text> </Text>
      <Text color={textColor}>{label}</Text>
    </Box>
  );
}


// ============================================================================
// Agent Progress View
// ============================================================================

interface AgentProgressViewProps {
  state: AgentProgressState;
}

/**
 * Displays the agent's progress including:
 * - Phase indicators (understand, planning)
 * - Task list with status and tool calls
 * - Answering indicator
 */
export const AgentProgressView = React.memo(function AgentProgressView({ 
  state 
}: AgentProgressViewProps) {
  const { 
    currentPhase, 
    understandComplete,
    planComplete,
    reflectComplete,
    tasks,
    isAnswering 
  } = state;

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Understand phase */}
      <PhaseIndicator 
        label="Understanding query..."
        complete={understandComplete}
        active={currentPhase === 'understand'}
      />
      
      {/* Planning phase */}
      <PhaseIndicator 
        label="Planning next moves..."
        complete={planComplete}
        active={currentPhase === 'plan'}
      />

      {/* Reflect phase */}
      <PhaseIndicator 
        label="Checking work..."
        complete={reflectComplete}
        active={currentPhase === 'reflect'}
      />

      {/* Task list */}
      {tasks.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.primary}>Working on your request:</Text>
          <Box marginTop={1} marginLeft={2} flexDirection="column">
            <TaskListView tasks={tasks} />
          </Box>
        </Box>
      )}

      {/* Answering indicator */}
      {isAnswering && (
        <Box marginTop={1}>
          <Text color={colors.accent}>
            <InkSpinner type="dots" />
          </Text>
          <Text> </Text>
          <Text color={colors.primary}>Generating answer...</Text>
        </Box>
      )}
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
 * Full current turn view including query and progress.
 */
export const CurrentTurnView = React.memo(function CurrentTurnView({ 
  query, 
  state 
}: CurrentTurnViewProps) {
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
