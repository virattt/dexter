/**
 * Task management types for structured multi-step execution
 */

export type TaskStatus = 'pending' | 'running' | 'complete' | 'failed';

/**
 * A single executable task in a plan
 */
export interface Task {
  /** Unique task identifier (e.g., "task_001") */
  id: string;
  
  /** Human-readable task description */
  description: string;
  
  /** Current execution status */
  status: TaskStatus;
  
  /** Tool calls to execute for this task */
  toolCalls: ToolCall[];
  
  /** Task IDs that must complete before this task can run */
  dependencies: string[];
  
  /** Result after successful completion */
  result?: string;
  
  /** Error message if task failed */
  error?: string;
  
  /** Execution start timestamp */
  startTime?: number;
  
  /** Execution end timestamp */
  endTime?: number;
}

/**
 * Tool invocation specification
 */
export interface ToolCall {
  /** Tool name to invoke */
  tool: string;
  
  /** Arguments to pass to the tool */
  args: Record<string, unknown>;
}

/**
 * Complete task plan for a query
 */
export interface TaskPlan {
  /** Unique plan identifier */
  id: string;
  
  /** Original user query */
  query: string;
  
  /** Ordered list of tasks (DAG) */
  tasks: Task[];
  
  /** Plan creation timestamp */
  createdAt: number;
  
  /** Plan completion timestamp */
  completedAt?: number;
}

/**
 * Task plan validation result
 */
export interface TaskPlanValidation {
  valid: boolean;
  errors: string[];
}
