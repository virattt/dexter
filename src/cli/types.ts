import type { TaskState } from '../components/TaskProgress.js';

/**
 * Application state for the CLI
 */
export type AppState = 'idle' | 'running' | 'model_select';

/**
 * Represents a completed conversation turn (query + answer)
 */
export interface CompletedTurn {
  id: string;
  query: string;
  tasks: TaskState[];
  answer: string;
}

/**
 * Represents the current in-progress conversation turn
 */
export interface CurrentTurn {
  id: string;
  query: string;
  tasks: TaskState[];
}

/**
 * Generate a unique ID for turns
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

