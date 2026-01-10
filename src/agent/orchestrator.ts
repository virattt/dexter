import { ToolContextManager } from '../utils/context.js';
import { MessageHistory } from '../utils/message-history.js';
import { TOOLS } from '../tools/index.js';
import { UnderstandPhase } from './phases/understand.js';
import { PlanPhase } from './phases/plan.js';
import { ExecutePhase } from './phases/execute.js';
import { ReflectPhase } from './phases/reflect.js';
import { AnswerPhase } from './phases/answer.js';
import { ToolExecutor } from './tool-executor.js';
import { TaskExecutor, TaskExecutorCallbacks } from './task-executor.js';
import type { 
  Phase, 
  Plan, 
  Understanding,
  TaskResult,
  ReflectionResult,
} from './state.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_ITERATIONS = 5;

// ============================================================================
// Callbacks Interface
// ============================================================================

/**
 * Callbacks for observing agent execution.
 */
export interface AgentCallbacks extends TaskExecutorCallbacks {
  // Phase transitions
  onPhaseStart?: (phase: Phase) => void;
  onPhaseComplete?: (phase: Phase) => void;

  // Understanding
  onUnderstandingComplete?: (understanding: Understanding) => void;

  // Planning
  onPlanCreated?: (plan: Plan, iteration: number) => void;

  // Reflection
  onReflectionComplete?: (result: ReflectionResult, iteration: number) => void;
  onIterationStart?: (iteration: number) => void;

  // Answer
  onAnswerStart?: () => void;
  onAnswerStream?: (stream: AsyncGenerator<string>) => void;

  // Progress
  onProgressMessage?: (message: string) => void;
}

// ============================================================================
// Agent Options
// ============================================================================

export interface AgentOptions {
  model: string;
  callbacks?: AgentCallbacks;
  maxIterations?: number;
  signal?: AbortSignal;
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Agent - Planning with just-in-time tool selection, parallel task execution,
 * and iterative reflection loop.
 * 
 * Architecture:
 * 1. Understand: Extract intent and entities from query (once)
 * 2. Plan: Create task list with taskType and dependencies
 * 3. Execute: Run tasks with just-in-time tool selection (gpt-5-mini)
 * 4. Reflect: Evaluate if we have enough data or need another iteration
 * 5. Answer: Synthesize final answer from all task results
 * 
 * The Plan → Execute → Reflect loop repeats until reflection determines
 * we have sufficient data or max iterations is reached.
 */
export class Agent {
  private readonly model: string;
  private readonly callbacks: AgentCallbacks;
  private readonly contextManager: ToolContextManager;
  private readonly maxIterations: number;
  private readonly signal?: AbortSignal;
  
  private readonly understandPhase: UnderstandPhase;
  private readonly planPhase: PlanPhase;
  private readonly executePhase: ExecutePhase;
  private readonly reflectPhase: ReflectPhase;
  private readonly answerPhase: AnswerPhase;
  private readonly taskExecutor: TaskExecutor;

  constructor(options: AgentOptions) {
    this.model = options.model;
    this.callbacks = options.callbacks ?? {};
    this.maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.signal = options.signal;
    this.contextManager = new ToolContextManager('.dexter/context', this.model);

    // Initialize phases
    this.understandPhase = new UnderstandPhase({ model: this.model });
    this.planPhase = new PlanPhase({ model: this.model });
    this.executePhase = new ExecutePhase({ model: this.model });
    this.reflectPhase = new ReflectPhase({ model: this.model, maxIterations: this.maxIterations });
    this.answerPhase = new AnswerPhase({ model: this.model, contextManager: this.contextManager });

    // Initialize executors
    const toolExecutor = new ToolExecutor({
      tools: TOOLS,
      contextManager: this.contextManager,
    });

    this.taskExecutor = new TaskExecutor({
      model: this.model,
      toolExecutor,
      executePhase: this.executePhase,
      contextManager: this.contextManager,
    });
  }

  /**
   * Throws if the abort signal has been triggered.
   */
  private checkAborted(): void {
    if (this.signal?.aborted) {
      const error = new Error('Operation was cancelled');
      error.name = 'AbortError';
      throw error;
    }
  }

  /**
   * Main entry point - runs the agent with iterative reflection.
   */
  async run(query: string, messageHistory?: MessageHistory): Promise<string> {
    const taskResults: Map<string, TaskResult> = new Map();
    const completedPlans: Plan[] = [];

    // ========================================================================
    // Phase 1: Understand (only once)
    // ========================================================================
    this.checkAborted();
    this.callbacks.onPhaseStart?.('understand');
    this.callbacks.onProgressMessage?.('Analyzing your query...');

    const understanding = await this.understandPhase.run({
      query,
      conversationHistory: messageHistory,
    });

    this.checkAborted();
    this.callbacks.onUnderstandingComplete?.(understanding);
    this.callbacks.onPhaseComplete?.('understand');

    // ========================================================================
    // Iterative Plan → Execute → Reflect Loop
    // ========================================================================
    let iteration = 1;
    let guidanceFromReflection: string | undefined;

    while (iteration <= this.maxIterations) {
      this.checkAborted();
      this.callbacks.onIterationStart?.(iteration);

      // ======================================================================
      // Phase 2: Plan
      // ======================================================================
      this.callbacks.onPhaseStart?.('plan');
      this.callbacks.onProgressMessage?.(
        iteration > 1
          ? `Planning next steps (iteration ${iteration})...`
          : 'Planning approach...'
      );

      const plan = await this.planPhase.run({
        query,
        understanding,
        priorPlans: completedPlans.length > 0 ? completedPlans : undefined,
        priorResults: taskResults.size > 0 ? taskResults : undefined,
        guidanceFromReflection,
      });

      this.checkAborted();
      this.callbacks.onPlanCreated?.(plan, iteration);
      this.callbacks.onPhaseComplete?.('plan');

      // ======================================================================
      // Phase 3: Execute
      // ======================================================================
      this.callbacks.onPhaseStart?.('execute');
      this.callbacks.onProgressMessage?.(`Executing ${plan.tasks.length} task${plan.tasks.length !== 1 ? 's' : ''}...`);

      await this.taskExecutor.executeTasks(
        query,
        plan,
        understanding,
        taskResults,
        this.callbacks,
        this.signal
      );

      this.checkAborted();
      this.callbacks.onPhaseComplete?.('execute');
      
      // Track completed plan
      completedPlans.push(plan);

      // ======================================================================
      // Phase 4: Reflect - Should we continue?
      // ======================================================================
      this.callbacks.onPhaseStart?.('reflect');

      const reflection = await this.reflectPhase.run({
        query,
        understanding,
        completedPlans,
        taskResults,
        iteration,
      });

      this.checkAborted();
      this.callbacks.onReflectionComplete?.(reflection, iteration);
      this.callbacks.onPhaseComplete?.('reflect');

      // Check if we're done
      if (reflection.isComplete) {
        break;
      }

      // Prepare guidance for next iteration
      guidanceFromReflection = this.reflectPhase.buildPlanningGuidance(reflection);

      iteration++;
    }

    // ========================================================================
    // Phase 5: Generate Final Answer
    // ========================================================================
    this.checkAborted();
    this.callbacks.onPhaseStart?.('answer');
    this.callbacks.onAnswerStart?.();

    const stream = this.answerPhase.run({
      query,
      completedPlans,
      taskResults,
    });

    this.callbacks.onAnswerStream?.(stream);
    this.callbacks.onPhaseComplete?.('answer');

    return '';
  }
}
