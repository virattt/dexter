import { PlannedTask } from './schemas.js';
import { TaskPlanner } from './task-planner.js';
import { TaskExecutor } from './task-executor.js';
import { AnswerGenerator } from './answer-generator.js';
import { ToolContextManager } from '../utils/context.js';
import { MessageHistory } from '../utils/message-history.js';

/**
 * Task type for UI callbacks (simplified view)
 */
export interface Task {
  id: number;
  description: string;
  done: boolean;
}

/**
 * Callbacks for observing agent execution
 */
export interface AgentCallbacks {
  /** Called when user query is received */
  onUserQuery?: (query: string) => void;
  /** Called when tasks are planned */
  onTasksPlanned?: (tasks: Task[]) => void;
  /** Called when subtasks are planned for tasks */
  onSubtasksPlanned?: (plannedTasks: PlannedTask[]) => void;
  /** Called when a subtask starts executing */
  onSubTaskStart?: (taskId: number, subTaskId: number) => void;
  /** Called when a subtask finishes executing */
  onSubTaskComplete?: (taskId: number, subTaskId: number, success: boolean) => void;
  /** Called when a task starts executing */
  onTaskStart?: (taskId: number) => void;
  /** Called when a task completes */
  onTaskComplete?: (taskId: number, success: boolean) => void;
  /** Called for debug messages (accumulated, not overwritten) */
  onDebug?: (message: string) => void;
  /** Called when a spinner should start */
  onSpinnerStart?: (message: string) => void;
  /** Called when a spinner should stop */
  onSpinnerStop?: () => void;
  /** Called with the answer stream */
  onAnswerStream?: (stream: AsyncGenerator<string>) => void;
}

/**
 * Options for creating an Agent
 */
export interface AgentOptions {
  /** LLM model to use */
  model: string;
  /** Callbacks to observe agent execution */
  callbacks: AgentCallbacks;
}

/**
 * Dexter Agent - Orchestrates financial research with two-pass architecture.
 * 
 * Architecture:
 * 1. TaskPlanner: Creates tasks and subtasks (descriptions only)
 * 2. TaskExecutor: Resolves subtasks to tool calls via LLM, then executes them
 * 3. AnswerGenerator: Loads relevant contexts and generates final answer
 * 
 * Tool outputs are saved to filesystem via ToolContextManager during execution,
 * and only loaded at answer generation time for memory efficiency.
 */
export class Agent {
  private readonly callbacks: AgentCallbacks;
  private readonly model: string;
  
  // Shared context manager for tool outputs
  private readonly toolContextManager: ToolContextManager;
  
  // Collaborators
  private readonly taskPlanner: TaskPlanner;
  private readonly taskExecutor: TaskExecutor;
  private readonly answerGenerator: AnswerGenerator;

  constructor(options: AgentOptions) {
    this.callbacks = options.callbacks ?? {};
    this.model = options.model;
    
    // Create shared tool context manager
    this.toolContextManager = new ToolContextManager('.dexter/context', this.model);
    
    // Create collaborators with shared tool context manager
    this.taskPlanner = new TaskPlanner(this.model);
    this.taskExecutor = new TaskExecutor(this.toolContextManager, this.model);
    this.answerGenerator = new AnswerGenerator(this.toolContextManager, this.model);
  }

  /**
   * Main entry point - runs the agent on a user query.
   * 
   * Flow:
   * 1. Plan tasks with subtasks (LLM call)
   * 2. Execute: resolve subtasks to tool calls (LLM call per task), then execute tools
   * 3. Generate answer from saved contexts
   * 
   * @param query - The user's query
   * @param messageHistory - Optional message history for multi-turn context
   */
  async run(query: string, messageHistory?: MessageHistory): Promise<string> {
    this.callbacks.onSpinnerStart?.('Planning...');

    // Generate queryId to scope pointers to this query
    const queryId = this.toolContextManager.hashQuery(query);

    // Notify that query was received
    this.callbacks.onUserQuery?.(query);

    // Planning call - creates tasks and subtasks
    const plannedTasks = await this.taskPlanner.planTasks(
      query,
      { onDebug: this.callbacks.onDebug },
      messageHistory
    );

    if (plannedTasks.length === 0) {
      // No tasks planned - answer directly without tools
      return await this.generateAnswer(query, queryId, messageHistory);
    }

    // Extract tasks for UI callback
    const tasks: Task[] = plannedTasks.map(pt => ({
      id: pt.id,
      description: pt.description,
      done: false,
    }));
    this.callbacks.onTasksPlanned?.(tasks);
    this.callbacks.onSubtasksPlanned?.(plannedTasks);

    // Execute tasks: resolve subtasks to tool calls via LLM, then execute
    await this.taskExecutor.executeTasks(plannedTasks, queryId, {
      onSubTaskStart: (taskId, subTaskId) => {
        this.callbacks.onSubTaskStart?.(taskId, subTaskId);
      },
      onSubTaskComplete: (taskId, subTaskId, success) => {
        this.callbacks.onSubTaskComplete?.(taskId, subTaskId, success);
      },
      onTaskStart: (taskId) => {
        this.callbacks.onTaskStart?.(taskId);
      },
      onTaskComplete: (taskId, success) => {
        this.callbacks.onTaskComplete?.(taskId, success);
      },
    });

    this.callbacks.onSpinnerStop?.();

    // Generate answer from saved contexts
    return await this.generateAnswer(query, queryId, messageHistory);
  }

  /**
   * Generates the final answer by loading relevant contexts.
   */
  private async generateAnswer(query: string, queryId: string, messageHistory?: MessageHistory): Promise<string> {
    this.callbacks.onSpinnerStart?.('Answering...');
    const stream = await this.answerGenerator.generateAnswer(query, queryId, messageHistory);
    this.callbacks.onAnswerStream?.(stream);
    return '';
  }
}
