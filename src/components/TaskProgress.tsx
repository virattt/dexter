import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { colors } from '../theme.js';
import type { Task } from '../agent/agent.js';
import type { PlannedTask } from '../agent/schemas.js';

/**
 * Status type for UI display
 */
export type DisplayStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Subtask state for UI display
 */
export interface SubTaskState {
  id: number;
  description: string;
  status: DisplayStatus;
}

/**
 * Task state for UI display
 */
export interface TaskState {
  id: number;
  description: string;
  status: DisplayStatus;
  subTasks: SubTaskState[];
}

/**
 * Returns the appropriate status icon for a given status
 */
function StatusIcon({ status }: { status: DisplayStatus }) {
  switch (status) {
    case 'pending':
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
  }
}

/**
 * Truncates description for display if too long
 */
function truncateDescription(desc: string, maxLen = 60): string {
  return desc.length > maxLen ? desc.slice(0, maxLen - 3) + '...' : desc;
}

interface TaskProgressProps {
  tasks: TaskState[];
  title?: string;
}

/**
 * TaskProgress component displays all tasks with their subtasks and real-time status.
 * Shows:
 * - Task description with status icon
 * - Nested subtasks (tool calls) with their status
 * - Tool name and arguments for each subtask
 */
export function TaskProgress({ tasks, title = 'Tasks' }: TaskProgressProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        ╭─ {title}
      </Text>
      
      {tasks.map((task, taskIndex) => (
        <Box key={task.id} flexDirection="column">
          {/* Task row */}
          <Box>
            <Text color={colors.primary}>│</Text>
            <Text> </Text>
            <StatusIcon status={task.status} />
            <Text> {truncateDescription(task.description)}</Text>
          </Box>
          
          {/* Subtask rows - only show if more than 1 sub-task */}
          {task.subTasks.length > 1 && task.subTasks.map((subTask, subTaskIndex) => {
            const isLastSubTask = subTaskIndex === task.subTasks.length - 1;
            
            return (
              <Box key={`${task.id}-${subTask.id}`}>
                <Text color={colors.primary}>│</Text>
                <Text>   </Text>
                <Text color={colors.muted}>{isLastSubTask ? '└' : '├'}</Text>
                <Text> </Text>
                <StatusIcon status={subTask.status} />
                <Text> </Text>
                <Text color={colors.accent}>{truncateDescription(subTask.description)}</Text>
              </Box>
            );
          })}
          
          {/* Empty line between tasks for readability */}
          {taskIndex < tasks.length - 1 && (
            <Text color={colors.primary}>│</Text>
          )}
        </Box>
      ))}
      
      <Text color={colors.primary}>╰{'─'.repeat(50)}</Text>
    </Box>
  );
}

/**
 * Converts agent Task to UI TaskState (before subtask planning)
 */
export function taskToState(task: Task): TaskState {
  return {
    id: task.id,
    description: task.description,
    status: 'pending',
    subTasks: [],
  };
}

/**
 * Converts PlannedTask to UI TaskState (after subtask planning)
 */
export function plannedTaskToState(plannedTask: PlannedTask): TaskState {
  return {
    id: plannedTask.id,
    description: plannedTask.description,
    status: 'pending',
    subTasks: plannedTask.subTasks.map(st => ({
      id: st.id,
      description: st.description,
      status: 'pending',
    })),
  };
}
