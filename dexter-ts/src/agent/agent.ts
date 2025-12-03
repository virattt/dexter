import { Task, PlannedTask, SubTaskResult } from './schemas.js';
import { TaskPlanner } from './task-planner.js';
import { TaskExecutor } from './task-executor.js';
import { AnswerGenerator } from './answer-generator.js';

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
  /** Called when a tool is executed */
  onToolRun?: (taskId: number, tool: string, args: Record<string, unknown>, result: string) => void;
  /** Called for general log messages */
  onLog?: (message: string) => void;
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
 * 2. TaskPlanner.planSubtasks: For each task IN PARALLEL, determines tool calls using bindTools
 * 3. TaskExecutor: Executes all subtasks (tool calls) in parallel
 * 4. AnswerGenerator: Generates final answer from all tool outputs
 * 
 * This avoids structured output schema limitations by using bindTools for subtask planning.
 */
export class Agent {
  private readonly callbacks: AgentCallbacks;
  private readonly model: string;
  
  // Collaborators
  private readonly taskPlanner: TaskPlanner;
  private readonly taskExecutor: TaskExecutor;
  private readonly answerGenerator: AnswerGenerator;

  constructor(options: AgentOptions) {
    this.callbacks = options.callbacks ?? {};
    this.model = options.model;
    
    // Create collaborators
    this.taskPlanner = new TaskPlanner(this.model);
    this.taskExecutor = new TaskExecutor();
    this.answerGenerator = new AnswerGenerator(this.model);
  }

  /**
   * Main entry point - runs the agent on a user query.
   * 
   * Flow:
   * 1. Plan high-level tasks
   * 2. Plan subtasks for each task (parallel)
   * 3. Execute subtasks (parallel)
   * 4. Generate answer
   */
  async run(query: string): Promise<string> {
    // Notify that query was received
    this.callbacks.onUserQuery?.(query);

    // Phase 1: Plan high-level tasks
    const tasks = await this.withProgress(
      'Planning tasks...',
      'Tasks planned',
      () => this.taskPlanner.planTasks(query, { onLog: this.callbacks.onLog })
    );
    
    if (tasks.length === 0) {
      // No tasks planned - answer directly without tools
      return await this.generateAnswer(query, []);
    }

    // Notify UI about planned tasks
    this.callbacks.onTasksPlanned?.(tasks);

    // Phase 2: Plan subtasks for each task (parallel)
    const plannedTasks = await this.withProgress(
      'Planning subtasks...',
      'Subtasks planned',
      () => this.taskPlanner.planSubtasks(tasks, { onLog: this.callbacks.onLog })
    );

    // Notify UI about planned subtasks
    this.callbacks.onSubtasksPlanned?.(plannedTasks);

    // Phase 3: Execute all subtasks (parallel)
    const results = await this.withProgress(
      'Executing subtasks...',
      'Subtasks executed',
      () => this.taskExecutor.executeAll(plannedTasks, {
        onLog: this.callbacks.onLog,
        onToolRun: (taskId, tool, args, result) => {
          this.callbacks.onToolRun?.(taskId, tool, args, result);
        },
      })
    );

    // Phase 4: Generate answer from all subtask outputs
    return await this.generateAnswer(query, results);
  }

  /**
   * Generates the final answer based on subtask results.
   */
  private async generateAnswer(query: string, results: SubTaskResult[]): Promise<string> {
    const stream = await this.answerGenerator.generateFromResults(query, results);
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
