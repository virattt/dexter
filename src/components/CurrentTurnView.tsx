import React from 'react';
import { Box } from 'ink';
import { UserQuery } from './AnswerBox.js';
import { TaskProgress } from './TaskProgress.js';
import type { CurrentTurn } from '../cli/types.js';

interface CurrentTurnViewProps {
  turn: CurrentTurn;
}

/**
 * Renders the current in-progress conversation turn
 */
export function CurrentTurnView({ turn }: CurrentTurnViewProps) {
  return (
    <Box flexDirection="column">
      <UserQuery query={turn.query} />
      {turn.tasks.length > 0 && (
        <TaskProgress tasks={turn.tasks} />
      )}
    </Box>
  );
}

