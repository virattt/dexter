import React from 'react';
import { Box } from 'ink';
import { AnswerBox, UserQuery } from './AnswerBox.js';
import { TaskProgress } from './TaskProgress.js';
import type { CompletedTurn } from '../cli/types.js';

interface CompletedTurnViewProps {
  turn: CompletedTurn;
}

/**
 * Renders a completed conversation turn
 */
export function CompletedTurnView({ turn }: CompletedTurnViewProps) {
  return (
    <Box flexDirection="column">
      <UserQuery query={turn.query} />
      {turn.tasks.length > 0 && <TaskProgress tasks={turn.tasks} title="Completed Tasks" />}
      <AnswerBox text={turn.answer} />
    </Box>
  );
}

