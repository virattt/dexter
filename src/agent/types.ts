import type { GroupContext } from './prompts.js';
import type { MessageQueue } from '../utils/message-queue.js';

// ============================================================================
// Channel Profiles
// ============================================================================

/**
 * Per-channel formatting profile that controls how the agent responds.
 * Add new entries to CHANNEL_PROFILES in prompts.ts when adding channels.
 */
export interface ChannelProfile {
  /** Human-readable label used in the system prompt preamble (e.g., "CLI", "WhatsApp") */
  label: string;
  /** One-liner describing the output surface, injected after the date line */
  preamble: string;
  /** Bullet points for the ## Behavior section */
  behavior: string[];
  /** Bullet points for the ## Response Format section */
  responseFormat: string[];
  /** Full tables instruction block, or null to omit the section entirely */
  tables: string | null;
}

// ============================================================================
// Approval
// ============================================================================

/**
 * User's response to a tool approval prompt.
 * - 'allow-once': approve this single invocation
 * - 'allow-session': approve all invocations of this tool for the rest of the session
 * - 'deny': reject and immediately end the agent's turn
 */
export type ApprovalDecision = 'allow-once' | 'allow-session' | 'deny';

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Model to use for LLM calls (e.g., 'gpt-5.4', 'claude-sonnet-4-20250514') */
  model?: string;
  /** Model provider (e.g., 'openai', 'anthropic', 'google', 'ollama') */
  modelProvider?: string;
  /** Maximum agent loop iterations (default: 10) */
  maxIterations?: number;
  /** AbortSignal for cancelling agent execution */
  signal?: AbortSignal;
  /** Delivery channel (e.g., 'whatsapp', 'cli') — affects response formatting */
  channel?: string;
  /** Group chat context — when set, adds group-specific instructions to system prompt */
  groupContext?: GroupContext;
  /** Called when a tool needs explicit user approval to proceed */
  requestToolApproval?: (request: { tool: string; args: Record<string, unknown> }) => Promise<ApprovalDecision>;
  /** Shared set of tool names that have been session-approved (persists across queries) */
  sessionApprovedTools?: Set<string>;
  /** Enable/disable persistent memory integration for this run */
  memoryEnabled?: boolean;
  /** Message queue for mid-run injection of new user messages. */
  messageQueue?: MessageQueue;
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
  /** Unique tool_call ID from the AIMessage (for concurrent execution ordering). */
  toolCallId?: string;
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
  /** Unique tool_call ID from the AIMessage (for concurrent execution ordering). */
  toolCallId?: string;
}

/**
 * Tool execution failed
 */
export interface ToolErrorEvent {
  type: 'tool_error';
  tool: string;
  error: string;
  /** Unique tool_call ID from the AIMessage (for concurrent execution ordering). */
  toolCallId?: string;
}

/**
 * Mid-execution progress update from a subagent tool
 */
export interface ToolProgressEvent {
  type: 'tool_progress';
  tool: string;
  message: string;
}

/**
 * Tool call warning due to approaching/exceeding suggested limits
 */
export interface ToolLimitEvent {
  type: 'tool_limit';
  tool: string;
  /** Warning message about tool usage limits */
  warning?: string;
  /** Whether the tool call was blocked (always false - we only warn, never block) */
  blocked: boolean;
}

/**
 * Tool approval decision event for sensitive tools.
 */
export interface ToolApprovalEvent {
  type: 'tool_approval';
  tool: string;
  args: Record<string, unknown>;
  approved: ApprovalDecision;
}

/**
 * Tool execution was denied by user approval flow.
 */
export interface ToolDeniedEvent {
  type: 'tool_denied';
  tool: string;
  args: Record<string, unknown>;
  /** Unique tool_call ID from the AIMessage (for concurrent execution ordering). */
  toolCallId?: string;
}

/**
 * Context was cleared due to exceeding token threshold (Anthropic-style)
 */
export interface ContextClearedEvent {
  type: 'context_cleared';
  /** Number of tool results that were cleared from context */
  clearedCount: number;
  /** Number of most recent tool results that were kept */
  keptCount: number;
}

/**
 * Session-start memory context was loaded into the system prompt.
 */
export interface MemoryRecalledEvent {
  type: 'memory_recalled';
  filesLoaded: string[];
  tokenCount: number;
}

/**
 * Pre-compaction memory flush lifecycle event.
 */
export interface MemoryFlushEvent {
  type: 'memory_flush';
  phase: 'start' | 'end';
  filesWritten?: string[];
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
 * Queued messages were drained and injected into the conversation.
 */
export interface QueueDrainEvent {
  type: 'queue_drain';
  /** Number of messages drained from the queue. */
  messageCount: number;
  /** The merged text injected as a HumanMessage. */
  mergedText: string;
}

/**
 * Microcompact: per-turn lightweight trimming of old ToolMessage content.
 */
export interface MicrocompactEvent {
  type: 'microcompact';
  /** Number of ToolMessages whose content was cleared. */
  cleared: number;
  /** Estimated tokens saved by clearing. */
  tokensSaved: number;
}

/**
 * Context compaction lifecycle event (LLM summarization).
 */
export interface CompactionEvent {
  type: 'compaction';
  phase: 'start' | 'end';
  /** Whether compaction succeeded (only present on 'end' phase). */
  success?: boolean;
  /** Estimated tokens before compaction. */
  preCompactTokens?: number;
  /** Estimated tokens after compaction. */
  postCompactTokens?: number;
  /** Model used for the compaction call. */
  compactionModel?: string;
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
  | ToolProgressEvent
  | ToolEndEvent
  | ToolErrorEvent
  | ToolApprovalEvent
  | ToolDeniedEvent
  | ToolLimitEvent
  | ContextClearedEvent
  | QueueDrainEvent
  | MicrocompactEvent
  | CompactionEvent
  | MemoryRecalledEvent
  | MemoryFlushEvent
  | DoneEvent;

/**
 * Aggregated event used by the CLI history renderer.
 * Combines lifecycle events (tool_start/tool_end/tool_error) into a single display row.
 */
export interface DisplayEvent {
  id: string;
  event: AgentEvent;
  completed?: boolean;
  endEvent?: AgentEvent;
  progressMessage?: string;
}
