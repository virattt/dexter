import type { Task, ToolCallStatus } from '../agent/state.js';

/**
 * Summary of a task for batch output.
 */
export interface TaskSummary {
  id: string;
  description: string;
  taskType: 'use_tools' | 'reason';
  status: 'completed' | 'failed';
  toolCalls?: {
    tool: string;
    args: Record<string, unknown>;
    status: 'completed' | 'failed';
  }[];
  durationMs?: number;
}

/**
 * Result of a single batch research query.
 */
export interface BatchResult {
  ticker: string;
  query: string;
  answer: string;
  tasks: TaskSummary[];
  metadata: {
    model: string;
    startTime: string;
    endTime: string;
    durationMs: number;
    iterations: number;
  };
}

/**
 * Options for batch processing.
 */
export interface BatchOptions {
  inputFile: string;
  outputDir: string;
  template: string;
  model: string;
}

/**
 * Default query template for financial research.
 */
export const DEFAULT_TEMPLATE =
  'Investigate fundamentals of {TICKER} and determine whether a sensible investment thesis can be defended';

/**
 * Converts Task[] to TaskSummary[] for JSON output.
 */
export function tasksToSummary(tasks: Task[]): TaskSummary[] {
  return tasks.map(task => ({
    id: task.id,
    description: task.description,
    taskType: task.taskType ?? 'use_tools',
    status: task.status === 'completed' ? 'completed' : 'failed',
    toolCalls: task.toolCalls?.map(tc => ({
      tool: tc.tool,
      args: tc.args,
      status: tc.status === 'completed' ? 'completed' : 'failed',
    })),
    durationMs: task.startTime && task.endTime
      ? task.endTime - task.startTime
      : undefined,
  }));
}
