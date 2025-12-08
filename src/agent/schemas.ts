import { z } from 'zod';

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

export const OptimizedToolArgsSchema = z.object({
  arguments: z
    .looseObject({})
    .describe('The optimized arguments dictionary for the tool call.'),
});

export type OptimizedToolArgs = z.infer<typeof OptimizedToolArgsSchema>;

// Subtask schema with explicit tool call - used in combined planning
export const SubTaskSchema = z.object({
  id: z.number().describe('Unique identifier for the subtask'),
  description: z.string().describe('Human-readable description of the subtask'),
  toolName: z.string().describe('Name of the tool to call'),
  toolArgs: z.looseObject({}).describe('Arguments to pass to the tool'),
});

// Subtask with explicit tool call
export interface SubTask {
  id: number;
  description: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
}

// Combined planning output - task with its subtasks and tool calls
export const PlannedTaskSchema = z.object({
  id: z.number().describe('Unique identifier for the task'),
  description: z.string().describe('High-level description of the research task'),
  subTasks: z.array(SubTaskSchema).describe('Subtasks with tool calls to execute'),
});

export const ExecutionPlanSchema = z.object({
  tasks: z.array(PlannedTaskSchema).describe('Tasks with their subtasks and tool calls'),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

// Task with its planned subtasks (used at runtime)
export interface PlannedTask {
  id: number;
  description: string;
  subTasks: SubTask[];
}

// Result of executing a subtask
export interface SubTaskResult {
  taskId: number;
  subTaskId: number;
  success: boolean;
}
