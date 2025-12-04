import { z } from 'zod';

// Simple task schema matching Python version
// Subtasks (tool calls) are determined in a separate planning phase
export const TaskSchema = z.object({
  id: z.number().describe('Unique identifier for the task.'),
  description: z.string().describe('The description of the task.'),
  done: z.boolean().default(false).describe('Whether the task is completed.'),
});

export type Task = z.infer<typeof TaskSchema>;

export const TaskListSchema = z.object({
  tasks: z.array(TaskSchema).describe('The list of tasks.'),
});

export type TaskList = z.infer<typeof TaskListSchema>;

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
    .record(z.string(), z.any())
    .describe('The optimized arguments dictionary for the tool call.'),
});

export type OptimizedToolArgs = z.infer<typeof OptimizedToolArgsSchema>;

// Subtask schema for structured output generation
export const SubTaskSchema = z.object({
  id: z.number().describe('Unique identifier for the subtask'),
  description: z.string().describe('Human-readable description of the subtask'),
});

export const SubTaskListSchema = z.object({
  subTasks: z.array(SubTaskSchema).describe('List of subtasks to complete the task'),
});

// Subtask - human-readable unit of work (can use 0, 1, or many tools)
export interface SubTask {
  id: number;
  description: string;
}

// Task with its planned subtasks
export interface PlannedTask {
  task: Task;
  subTasks: SubTask[];
}

// Result of executing a subtask
export interface SubTaskResult {
  taskId: number;
  subTaskId: number;
  success: boolean;
}
