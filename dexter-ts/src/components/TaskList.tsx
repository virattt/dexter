import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import type { Task } from '../agent/schemas.js';

interface TaskListProps {
  tasks: Task[];
  title?: string;
}

export function TaskList({ tasks, title = 'Planned Tasks' }: TaskListProps) {
  if (tasks.length === 0) {
    return <></>;
  }

  return (
    <Box flexDirection="column">
      <Text color={colors.primary} bold>
        ╭─ {title}
      </Text>
      {tasks.map((task) => {
        const status = task.done ? '✓' : '+';
        const color = task.done ? colors.success : colors.muted;
        return (
          <Text key={task.id}>
            <Text color={colors.primary}>│</Text>{' '}
            <Text color={color}>{status}</Text> {task.description}
          </Text>
        );
      })}
      <Text color={colors.primary}>╰{'─'.repeat(50)}</Text>
    </Box>
  );
}

interface TaskStartProps {
  description: string;
}

export function TaskStart({ description }: TaskStartProps) {
  return (
    <Box marginTop={1}>
      <Text color={colors.accent} bold>
        ▶ Task:
      </Text>
      <Text> {description}</Text>
    </Box>
  );
}

interface TaskDoneProps {
  description: string;
}

export function TaskDone({ description }: TaskDoneProps) {
  return (
    <Box>
      <Text color={colors.success}>  ✓ Completed</Text>
      <Text dimColor> │ {description}</Text>
    </Box>
  );
}

interface ToolRunProps {
  params: Record<string, unknown>;
  result: string;
}

export function ToolRun({ params, result }: ToolRunProps) {
  const paramsStr = JSON.stringify(params);
  const resultPreview = result.length > 150 ? `${result.slice(0, 150)}...` : result;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.highlight}>  →</Text>
        <Text>  Parameters: </Text>
        <Text dimColor>{paramsStr}</Text>
      </Box>
      <Box>
        <Text color={colors.warning}>  ⚡</Text>
        <Text> Result: </Text>
        <Text dimColor>({resultPreview})</Text>
      </Box>
    </Box>
  );
}
