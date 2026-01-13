import { StructuredToolInterface } from '@langchain/core/tools';

/**
 * Parsed skill metadata from SKILL.md frontmatter
 */
export interface Skill {
  name: string;
  description: string;
  toolNames: string[];
  tools: StructuredToolInterface[];
  /** Raw markdown content (instructions) from SKILL.md body */
  instructions: string;
}

/**
 * Result of a tool execution for conversation history
 */
export interface ToolCallResult {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  timestamp: Date;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Model to use for LLM calls (e.g., 'gpt-5.2', 'claude-sonnet-4-20250514') */
  model?: string;
  /** Maximum agent loop iterations (default: 10) */
  maxIterations?: number;
}

/**
 * Message in conversation history
 */
export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

// ============================================================================
// Agent Events (for real-time streaming UI)
// ============================================================================

/**
 * Agent is processing/thinking
 */
export interface ThinkingEvent {
  type: 'thinking';
  message: string;
}

/**
 * Tool execution started
 */
export interface ToolStartEvent {
  type: 'tool_start';
  tool: string;
  args: Record<string, unknown>;
}

/**
 * Tool execution completed successfully
 */
export interface ToolEndEvent {
  type: 'tool_end';
  tool: string;
  args: Record<string, unknown>;
  result: string;
  duration: number;
}

/**
 * Tool execution failed
 */
export interface ToolErrorEvent {
  type: 'tool_error';
  tool: string;
  error: string;
}

/**
 * Final answer generation started
 */
export interface AnswerStartEvent {
  type: 'answer_start';
}

/**
 * Chunk of the final answer
 */
export interface AnswerChunkEvent {
  type: 'answer_chunk';
  text: string;
}

/**
 * Agent completed with final result
 */
export interface DoneEvent {
  type: 'done';
  answer: string;
  toolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  iterations: number;
}

/**
 * Union type for all agent events
 */
export type AgentEvent =
  | ThinkingEvent
  | ToolStartEvent
  | ToolEndEvent
  | ToolErrorEvent
  | AnswerStartEvent
  | AnswerChunkEvent
  | DoneEvent;
