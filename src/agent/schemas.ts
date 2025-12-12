import { z } from 'zod';

// ============================================================================
// Simple Response Schemas
// ============================================================================

export const IsDoneSchema = z.object({
  done: z.boolean().describe('Whether the task is done or not.'),
});

export type IsDone = z.infer<typeof IsDoneSchema>;

export const AnswerSchema = z.object({
  answer: z
    .string()
    .describe(
      "A comprehensive answer to the user's query, including relevant numbers, data, reasoning, and insights."
    ),
});

export type Answer = z.infer<typeof AnswerSchema>;

export const SelectedContextsSchema = z.object({
  context_ids: z
    .array(z.number())
    .describe(
      'List of context pointer IDs (0-indexed) that are relevant for answering the query.'
    ),
});

export type SelectedContexts = z.infer<typeof SelectedContextsSchema>;

// ============================================================================
// Task Planning Schemas
// ============================================================================

/**
 * Subtask schema - describes what data to fetch.
 * Tool resolution happens at execution time.
 */
export const SubTaskSchema = z.object({
  id: z.number().describe('Unique identifier for the subtask'),
  description: z.string().describe('What data to fetch or action to perform'),
});

export type SubTask = z.infer<typeof SubTaskSchema>;

/**
 * Planned task schema - a task with its subtasks.
 * Used for planning and validation.
 */
export const PlannedTaskSchema = z.object({
  id: z.number().describe('Unique identifier for the task'),
  description: z.string().describe('High-level description of the research task'),
  subTasks: z.array(SubTaskSchema).describe('Subtasks to execute'),
});

export type PlannedTask = z.infer<typeof PlannedTaskSchema>;

/**
 * Execution plan schema - collection of planned tasks.
 * Used as output schema for task planning.
 */
export const ExecutionPlanSchema = z.object({
  tasks: z.array(PlannedTaskSchema).describe('Tasks with their subtasks'),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

// ============================================================================
// Runtime Types
// ============================================================================

/**
 * Result of executing a subtask.
 * Used internally by TaskExecutor to track execution results.
 */
export interface SubTaskResult {
  taskId: number;
  subTaskId: number;
  success: boolean;
}
