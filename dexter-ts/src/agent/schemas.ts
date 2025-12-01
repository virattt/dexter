import { z } from 'zod';

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

export const OptimizedToolArgsSchema = z.object({
  arguments: z
    .record(z.string(), z.unknown())
    .describe('The optimized arguments dictionary for the tool call.'),
});

export type OptimizedToolArgs = z.infer<typeof OptimizedToolArgsSchema>;

export const SelectedContextsSchema = z.object({
  context_ids: z
    .array(z.number())
    .describe(
      'List of context pointer IDs (0-indexed) that are relevant for answering the query.'
    ),
});

export type SelectedContexts = z.infer<typeof SelectedContextsSchema>;

