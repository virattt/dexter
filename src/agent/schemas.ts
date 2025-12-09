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

// Subtask schema - describes what data to fetch (tool resolution happens at execution time)
export const SubTaskSchema = z.object({
  id: z.number().describe('Unique identifier for the subtask'),
  description: z.string().describe('What data to fetch or action to perform'),
});

// Subtask interface
export interface SubTask {
  id: number;
  description: string;
}

// Combined planning output - task with its subtasks
export const PlannedTaskSchema = z.object({
  id: z.number().describe('Unique identifier for the task'),
  description: z.string().describe('High-level description of the research task'),
  subTasks: z.array(SubTaskSchema).describe('Subtasks to execute'),
});

export const ExecutionPlanSchema = z.object({
  tasks: z.array(PlannedTaskSchema).describe('Tasks with their subtasks'),
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
