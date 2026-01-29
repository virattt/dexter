/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Model to use for LLM calls (e.g., 'gpt-5.2', 'claude-sonnet-4-20250514') */
  model?: string;
  /** Model provider (e.g., 'openai', 'anthropic', 'google', 'ollama') */
  modelProvider?: string;
  /** Maximum agent loop iterations (default: 10) */
  maxIterations?: number;
  /** AbortSignal for cancelling agent execution */
  signal?: AbortSignal;
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
 * Token usage statistics
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Agent completed with final result
 */
export interface DoneEvent {
  type: 'done';
  answer: string;
  toolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  iterations: number;
  totalTime: number;
  tokenUsage?: TokenUsage;
  tokensPerSecond?: number;
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
  | DoneEvent;
