import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';
import { EventListView } from './AgentEventView.js';
import type { DisplayEvent } from './AgentEventView.js';
import { AnswerBox } from '../../components/AnswerBox.js';

/**
 * Format duration in milliseconds to human-readable string
 * e.g., "1m 31s", "45s", "2m 5s"
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes === 0) {
    return `${seconds}s`;
  }
  
  return `${minutes}m ${seconds}s`;
}

export type HistoryItemStatus = 'processing' | 'complete' | 'error' | 'interrupted';

export interface HistoryItem {
  id: string;
  query: string;
  events: DisplayEvent[];
  answer: string;
  status: HistoryItemStatus;
  activeToolId?: string;
  /** Timestamp when this query started processing */
  startTime?: number;
  /** Total duration in milliseconds (set when complete) */
  duration?: number;
}

interface HistoryItemViewProps {
  item: HistoryItem;
}

export function HistoryItemView({ item }: HistoryItemViewProps) {
  return (
    <Box flexDirection="column">
      {/* Query */}
      <Box>
        <Text color={colors.muted} backgroundColor={colors.queryBg}>{'❯ '}</Text>
        <Text color={colors.white} backgroundColor={colors.queryBg}>{`${item.query} `}</Text>
      </Box>
            
      {/* Interrupted indicator */}
      {item.status === 'interrupted' && (
        <Box marginLeft={2}>
          <Text color={colors.muted}>⎿  Interrupted · What should Dexter do instead?</Text>
        </Box>
      )}
      
      {/* Events (tool calls, thinking) */}
      <EventListView 
        events={item.events} 
        activeToolId={item.status === 'processing' ? item.activeToolId : undefined}
      />
      
      {/* Answer - only show if we have one */}
      {item.answer && (
        <Box>
          <AnswerBox text={item.answer} />
        </Box>
      )}
      
      {/* Duration display - show when complete and duration > 15 seconds */}
      {item.status === 'complete' && item.duration !== undefined && item.duration > 15000 && (
        <Box marginTop={1}>
          <Text color={colors.muted}>✻ Worked for {formatDuration(item.duration)}</Text>
        </Box>
      )}
    </Box>
  );
}
