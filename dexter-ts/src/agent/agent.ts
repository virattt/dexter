import { Task, PlannedTask, SubTaskResult } from './schemas.js';
import { TaskPlanner } from './task-planner.js';
import { TaskExecutor } from './task-executor.js';
import { AnswerGenerator } from './answer-generator.js';
import { ContextManager } from '../utils/context.js';

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
  /** Called for general log messages */
  onLog?: (message: string) => void;
  /** Called for debug messages (accumulated, not overwritten) */
  onDebug?: (message: string) => void;
  /** Called when a spinner should start */
  onSpinnerStart?: (message: string) => void;
  /** Called when a spinner should stop */
  onSpinnerStop?: (message: string, success: boolean) => void;
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
 * Dexter Agent - Orchestrates financial research with hybrid task architecture.
 * 
 * Architecture:
 * 1. TaskPlanner.planTasks: Creates high-level tasks from user query
 * 2. TaskPlanner.planSubtasks: For each task, generates human-readable subtasks
 * 3. TaskExecutor: Executes subtasks using agentic loops (0, 1, or many tools per subtask)
 * 4. AnswerGenerator: Loads relevant contexts and generates final answer
 * 
 * Tool outputs are saved to filesystem via ContextManager during execution,
 * and only loaded at answer generation time for memory efficiency.
 */
export class Agent {
  private readonly callbacks: AgentCallbacks;
  private readonly model: string;
  
  // Shared context manager for tool outputs
  private readonly contextManager: ContextManager;
  
  // Collaborators
  private readonly taskPlanner: TaskPlanner;
  private readonly taskExecutor: TaskExecutor;
  private readonly answerGenerator: AnswerGenerator;

  constructor(options: AgentOptions) {
    this.callbacks = options.callbacks ?? {};
    this.model = options.model;
    
    // Create shared context manager
    this.contextManager = new ContextManager('.dexter/context', this.model);
    
    // Create collaborators with shared context manager
    this.taskPlanner = new TaskPlanner(this.model);
    this.taskExecutor = new TaskExecutor(this.contextManager, this.model);
    this.answerGenerator = new AnswerGenerator(this.contextManager, this.model);
  }

  /**
   * Main entry point - runs the agent on a user query.
   * 
   * Flow:
   * 1. Plan high-level tasks
   * 2. Plan subtasks for each task (parallel)
   * 3. Execute subtasks with agentic loops (parallel)
   * 4. Generate answer from saved contexts
   */
  async run(query: string): Promise<string> {
    // Notify that query was received
    this.callbacks.onUserQuery?.(query);

    // Phase 1: Plan high-level tasks
    const tasks = await this.withProgress(
      'Planning tasks...',
      'Tasks planned',
      () => this.taskPlanner.planTasks(query, { onLog: this.callbacks.onLog, onDebug: this.callbacks.onDebug })
    );

    if (tasks.length === 0) {
      // No tasks planned - answer directly without tools
      return await this.generateAnswer(query);
    }

    // Notify UI about planned tasks
    this.callbacks.onTasksPlanned?.(tasks);

    // Phase 2: Plan subtasks for each task (parallel)
    const plannedTasks = await this.withProgress(
      'Planning subtasks...',
      'Subtasks planned',
      () => this.taskPlanner.planSubtasks(tasks, { onLog: this.callbacks.onLog, onDebug: this.callbacks.onDebug })
    );

    // Notify UI about planned subtasks
    this.callbacks.onSubtasksPlanned?.(plannedTasks);

    // Phase 3: Execute all subtasks with agentic loops (parallel)
    await this.withProgress(
      'Executing subtasks...',
      'Subtasks executed',
      () => this.taskExecutor.executeAll(plannedTasks, {
        onLog: this.callbacks.onLog,
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
      })
    );

    // Phase 4: Generate answer from saved contexts
    return await this.generateAnswer(query);
  }

  /**
   * Generates the final answer by loading relevant contexts.
   */
  private async generateAnswer(query: string): Promise<string> {
    const stream = await this.answerGenerator.generateAnswer(query);
    this.callbacks.onAnswerStream?.(stream);
    return '';
  }

  /**
   * Wraps an async operation with spinner callbacks.
   */
  private async withProgress<T>(
    message: string,
    successMessage: string,
    fn: () => Promise<T>
  ): Promise<T> {
    this.callbacks.onSpinnerStart?.(message);
    try {
      const result = await fn();
      this.callbacks.onSpinnerStop?.(successMessage || message.replace('...', ' ✓'), true);
      return result;
    } catch (e) {
      this.callbacks.onSpinnerStop?.(`Failed: ${e}`, false);
      throw e;
    }
  }
}
