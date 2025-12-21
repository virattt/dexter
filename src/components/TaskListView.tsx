import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { colors } from '../theme.js';
import type { Task, TaskStatus, ToolCallStatus } from '../agent/state.js';

// ============================================================================
// Status Icon Component
// ============================================================================

interface StatusIconProps {
  status: TaskStatus | ToolCallStatus['status'];
}

function StatusIcon({ status }: StatusIconProps) {
  switch (status) {
    case 'pending':
      return <Text color={colors.muted}>○</Text>;
    case 'in_progress':
    case 'running':
      return (
        <Text color={colors.accent}>
          <InkSpinner type="dots" />
        </Text>
      );
    case 'completed':
      return <Text color={colors.success}>✓</Text>;
    case 'failed':
      return <Text color={colors.error}>✗</Text>;
    default:
      return <Text color={colors.muted}>○</Text>;
  }
}

// ============================================================================
// Tool Call Row Component
// ============================================================================

interface ToolCallRowProps {
  toolCall: ToolCallStatus;
  isLast: boolean;
}

function formatArgs(args: Record<string, unknown>): string {
  if (Object.keys(args).length === 1 && args.ticker) {
    return String(args.ticker);
  }
  return Object.entries(args)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
}

function ToolCallRow({ toolCall, isLast }: ToolCallRowProps) {
  const prefix = isLast ? '└─' : '├─';
  const argsStr = formatArgs(toolCall.args);
  // Replace underscores with spaces for readability
  const toolName = toolCall.tool.replace(/_/g, ' ');
  // Completed tool calls get default text color, others stay muted
  const textColor = toolCall.status === 'completed' ? undefined : colors.muted;
  
  return (
    <Box>
      <Text color={textColor}>{prefix} </Text>
      <Text color={textColor}>{toolName} </Text>
      <Text color={textColor}>({argsStr}) </Text>
      <StatusIcon status={toolCall.status} />
    </Box>
  );
}

// ============================================================================
// Tool Calls Tree Component
// ============================================================================

interface ToolCallsTreeProps {
  toolCalls: ToolCallStatus[];
}

function ToolCallsTree({ toolCalls }: ToolCallsTreeProps) {
  return (
    <Box flexDirection="column" marginLeft={4}>
      {toolCalls.map((tc, i) => (
        <ToolCallRow 
          key={`${tc.tool}-${i}`} 
          toolCall={tc} 
          isLast={i === toolCalls.length - 1}
        />
      ))}
    </Box>
  );
}

// ============================================================================
// Task Row Component
// ============================================================================

interface TaskRowProps {
  task: Task;
}

const TaskRow = React.memo(function TaskRow({ task }: TaskRowProps) {
  const textColor = task.status === 'pending' ? colors.muted : undefined;
  const hasToolCalls = task.toolCalls && task.toolCalls.length > 0;
  const isActive = task.status === 'in_progress' || task.status === 'completed';
  
  // Show tool calls tree for active tasks with tool calls
  const showToolCalls = hasToolCalls && isActive;
  
  return (
    <Box flexDirection="column">
      {/* Main task row */}
      <Box>
        <StatusIcon status={task.status} />
        <Text> </Text>
        <Text color={textColor}>{task.description}</Text>
      </Box>
      
      {/* Tool calls tree */}
      {showToolCalls && task.toolCalls && (
        <ToolCallsTree toolCalls={task.toolCalls} />
      )}
    </Box>
  );
});

// ============================================================================
// Task List View Component
// ============================================================================

interface TaskListViewProps {
  tasks: Task[];
}

/**
 * Renders a list of tasks with:
 * - Status icons (○ pending, spinner in_progress, ✓ completed, ✗ failed)
 * - Tool call tree showing individual tool statuses
 */
export const TaskListView = React.memo(function TaskListView({ 
  tasks,
}: TaskListViewProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {tasks.map(task => (
        <TaskRow key={task.id} task={task} />
      ))}
    </Box>
  );
});
