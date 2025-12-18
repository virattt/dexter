import { z } from 'zod';

// ============================================================================
// Agent Loop Types
// ============================================================================

/**
 * A thinking step in the agent loop - the agent's reasoning
 */
export interface ThinkingStep {
  thought: string;
}

/**
 * A tool call step with its execution status
 */
export interface ToolCallStep {
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * A single iteration in the agent loop
 */
export interface Iteration {
  id: number;
  thinking: ThinkingStep | null;
  toolCalls: ToolCallStep[];
  status: 'thinking' | 'acting' | 'completed';
}

/**
 * Overall state of the agent for UI display
 */
export interface AgentState {
  iterations: Iteration[];
  currentIteration: number;
  status: 'reasoning' | 'executing' | 'answering' | 'done';
}

// ============================================================================
// Tool Summary Types
// ============================================================================

/**
 * Lightweight summary of a tool call result (kept in context during loop)
 */
export interface ToolSummary {
  id: string;           // Filepath pointer to full data on disk
  toolName: string;
  args: Record<string, unknown>;
  summary: string;      // Deterministic description
}

// ============================================================================
// LLM Response Schemas
// ============================================================================

/**
 * Schema for the "finish" tool that signals the agent is ready to answer.
 * Using a tool for this is cleaner with LangChain's tool binding.
 */
export const FinishToolSchema = z.object({
  reason: z.string().describe('Brief explanation of why you have enough data to answer'),
});

export type FinishToolArgs = z.infer<typeof FinishToolSchema>;

/**
 * Schema for extracting the agent's thinking from its response.
 * The thought explains the reasoning before tool calls.
 */
export const ThinkingSchema = z.object({
  thought: z.string().describe('Your reasoning about what data you need or why you are ready to answer'),
});

export type Thinking = z.infer<typeof ThinkingSchema>;

// ============================================================================
// Context Selection Schema (used by utils/context.ts)
// ============================================================================

export const SelectedContextsSchema = z.object({
  context_ids: z
    .array(z.number())
    .describe(
      'List of context pointer IDs (0-indexed) that are relevant for answering the query.'
    ),
});

export type SelectedContexts = z.infer<typeof SelectedContextsSchema>;
