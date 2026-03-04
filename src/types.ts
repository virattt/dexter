import type { DisplayEvent, TokenUsage } from './agent/types.js';

export type WorkingState =
  | { status: 'idle' }
  | { status: 'thinking' }
  | { status: 'tool'; toolName: string }
  | { status: 'approval'; toolName: string };

export type HistoryItemStatus = 'processing' | 'complete' | 'error' | 'interrupted';

export interface HistoryItem {
  id: string;
  query: string;
  events: DisplayEvent[];
  answer: string;
  status: HistoryItemStatus;
  activeToolId?: string;
  startTime?: number;
  duration?: number;
  tokenUsage?: TokenUsage;
  tokensPerSecond?: number;
}
