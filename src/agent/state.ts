import type { MessageHistory } from '../utils/message-history.js';

// ============================================================================
// Phase Types
// ============================================================================

/**
 * The current phase of the agent execution.
 */
export type Phase = 'understand' | 'plan' | 'execute' | 'reflect' | 'answer' | 'complete';

/**
 * Status of a task in the task list.
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Type of task - determines execution strategy.
 */
export type TaskType = 'use_tools' | 'reason';

// ============================================================================
// Entity Types
// ============================================================================

/**
 * Type of entity extracted from a query.
 */
export type EntityType = 'ticker' | 'date' | 'metric' | 'company' | 'period' | 'other';

/**
 * An entity extracted from the user's query.
 */
export interface Entity {
  type: EntityType;
  value: string;
}

// ============================================================================
// Understanding Phase Types
// ============================================================================

/**
 * Input to the Understand phase.
 */
export interface UnderstandInput {
  query: string;
  conversationHistory?: MessageHistory;
}

/**
 * Output from the Understand phase.
 */
export interface Understanding {
  intent: string;
  entities: Entity[];
}

// ============================================================================
// Tool Call Types
// ============================================================================

/**
 * A tool call specification.
 */
export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

/**
 * A tool call with execution status (for UI tracking).
 */
export interface ToolCallStatus extends ToolCall {
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ============================================================================
// Plan Phase Types
// ============================================================================

/**
 * Input to the Plan phase.
 */
export interface PlanInput {
  query: string;
  understanding: Understanding;
  priorPlans?: Plan[];
  priorResults?: Map<string, TaskResult>;
  guidanceFromReflection?: string;
}

/**
 * A task in the execution plan.
 * Includes taskType and dependencies from planning.
 * toolCalls are populated during execution for use_tools tasks.
 */
export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  taskType?: TaskType;
  toolCalls?: ToolCallStatus[];
  dependsOn?: string[];
}

/**
 * Output from the Plan phase.
 */
export interface Plan {
  summary: string;
  tasks: Task[];
}

// ============================================================================
// Execute Phase Types
// ============================================================================

/**
 * Input to the Execute phase (for reason tasks only).
 */
export interface ExecuteInput {
  query: string;
  task: Task;
  plan: Plan;
  contextData: string;
}

/**
 * Output from task execution.
 */
export interface TaskResult {
  taskId: string;
  output?: string;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * A summary of a tool call result (kept in context).
 */
export interface ToolSummary {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
}

// ============================================================================
// Agent State
// ============================================================================

/**
 * The complete state of the agent during execution.
 */
export interface AgentState {
  query: string;
  currentPhase: Phase;
  understanding?: Understanding;
  plan?: Plan;
  taskResults: Map<string, TaskResult>;
  currentTaskId?: string;
}

/**
 * Creates an initial agent state for a query.
 */
export function createInitialState(query: string): AgentState {
  return {
    query,
    currentPhase: 'understand',
    taskResults: new Map(),
  };
}

// ============================================================================
// Reflect Phase Types
// ============================================================================

/**
 * Input to the Reflect phase.
 */
export interface ReflectInput {
  query: string;
  understanding: Understanding;
  completedPlans: Plan[];
  taskResults: Map<string, TaskResult>;
  iteration: number;
}

/**
 * Result of the reflection phase.
 */
export interface ReflectionResult {
  isComplete: boolean;
  reasoning: string;
  missingInfo: string[];
  suggestedNextSteps: string;
}

// ============================================================================
// Answer Phase Types
// ============================================================================

/**
 * Input to the Answer phase.
 */
export interface AnswerInput {
  query: string;
  completedPlans: Plan[];
  taskResults: Map<string, TaskResult>;
}
