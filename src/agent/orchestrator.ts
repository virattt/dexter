import { StructuredToolInterface } from '@langchain/core/tools';
import { AIMessage } from '@langchain/core/messages';
import { ToolContextManager } from '../utils/context.js';
import { MessageHistory } from '../utils/message-history.js';
import { callLlm, callLlmStream } from '../model/llm.js';
import { TOOLS } from '../tools/index.js';
import { UnderstandPhase } from './phases/understand.js';
import { PlanPhase } from './phases/plan.js';
import { ExecutePhase } from './phases/execute.js';
import { 
  getFinalAnswerSystemPrompt, 
  buildFinalAnswerUserPrompt,
  getToolSelectionSystemPrompt,
  buildToolSelectionPrompt,
} from './prompts.js';
import type { 
  Phase, 
  Task, 
  TaskStatus, 
  Plan, 
  Understanding,
  TaskResult,
  ToolCallStatus,
  Entity,
} from './state.js';

// ============================================================================
// Constants
// ============================================================================

const SMALL_MODEL = 'gpt-5-mini';

// ============================================================================
// Callbacks Interface
// ============================================================================

/**
 * Callbacks for observing agent execution.
 */
export interface AgentCallbacks {
  // Phase transitions
  onPhaseStart?: (phase: Phase) => void;
  onPhaseComplete?: (phase: Phase) => void;

  // Understanding
  onUnderstandingComplete?: (understanding: Understanding) => void;

  // Planning
  onPlanCreated?: (plan: Plan) => void;

  // Task execution
  onTaskUpdate?: (taskId: string, status: TaskStatus) => void;
  onTaskToolCallsSet?: (taskId: string, toolCalls: ToolCallStatus[]) => void;
  onToolCallUpdate?: (taskId: string, toolIndex: number, status: ToolCallStatus['status']) => void;
  onToolCallError?: (taskId: string, toolIndex: number, toolName: string, args: Record<string, unknown>, error: Error) => void;

  // Answer
  onAnswerStart?: () => void;
  onAnswerStream?: (stream: AsyncGenerator<string>) => void;
}

// ============================================================================
// Agent Options
// ============================================================================

export interface AgentOptions {
  model: string;
  callbacks?: AgentCallbacks;
}

// ============================================================================
// Task Execution Node
// ============================================================================

interface TaskNode {
  task: Task;
  status: 'pending' | 'ready' | 'running' | 'completed';
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Agent - Planning with just-in-time tool selection and parallel task execution.
 * 
 * Architecture:
 * 1. Understand: Extract intent and entities from query
 * 2. Plan: Create task list with taskType and dependencies
 * 3. Execute: Run tasks with just-in-time tool selection (gpt-5-mini)
 * 4. Answer: Synthesize final answer from task results
 */
export class Agent {
  private readonly model: string;
  private readonly callbacks: AgentCallbacks;
  private readonly contextManager: ToolContextManager;
  private readonly tools: StructuredToolInterface[];
  private readonly toolMap: Map<string, StructuredToolInterface>;
  
  private readonly understandPhase: UnderstandPhase;
  private readonly planPhase: PlanPhase;
  private readonly executePhase: ExecutePhase;

  constructor(options: AgentOptions) {
    this.model = options.model;
    this.callbacks = options.callbacks ?? {};
    this.contextManager = new ToolContextManager('.dexter/context', this.model);
    this.tools = TOOLS;
    this.toolMap = new Map(TOOLS.map(t => [t.name, t]));

    // Initialize phases
    this.understandPhase = new UnderstandPhase({ model: this.model });
    this.planPhase = new PlanPhase({ model: this.model });
    this.executePhase = new ExecutePhase({ model: this.model });
  }

  /**
   * Main entry point - runs the agent on a user query.
   */
  async run(query: string, messageHistory?: MessageHistory): Promise<string> {
    const taskResults: Map<string, TaskResult> = new Map();

    // ========================================================================
    // Phase 1: Understand
    // ========================================================================
    this.callbacks.onPhaseStart?.('understand');
    
    const understanding = await this.understandPhase.run({
      query,
      conversationHistory: messageHistory,
    });
    
    this.callbacks.onUnderstandingComplete?.(understanding);
    this.callbacks.onPhaseComplete?.('understand');

    // ========================================================================
    // Phase 2: Plan (with taskType and dependencies)
    // ========================================================================
    this.callbacks.onPhaseStart?.('plan');
    
    const plan = await this.planPhase.run({
      query,
      understanding,
    });
    
    this.callbacks.onPlanCreated?.(plan);
    this.callbacks.onPhaseComplete?.('plan');

    // ========================================================================
    // Phase 3: Execute Tasks with Parallelization
    // Tool selection happens just-in-time during execution
    // ========================================================================
    this.callbacks.onPhaseStart?.('execute');

    await this.executeTasks(query, plan, understanding, taskResults);

    this.callbacks.onPhaseComplete?.('execute');

    // ========================================================================
    // Phase 4: Generate Final Answer
    // ========================================================================
    return this.generateFinalAnswer(query, plan, taskResults);
  }

  /**
   * Executes tasks with dependency-aware parallelization.
   */
  private async executeTasks(
    query: string,
    plan: Plan,
    understanding: Understanding,
    taskResults: Map<string, TaskResult>
  ): Promise<void> {
    // Build dependency graph
    const nodes = new Map<string, TaskNode>();
    for (const task of plan.tasks) {
      nodes.set(task.id, { task, status: 'pending' });
    }

    // Execute until all tasks complete
    while (this.hasPendingTasks(nodes)) {
      // Find ready tasks (dependencies satisfied)
      const readyTasks = this.getReadyTasks(nodes);
      
      if (readyTasks.length === 0) {
        break; // No tasks can proceed - might be a dependency cycle
      }

      // Execute ready tasks in parallel
      await Promise.all(
        readyTasks.map(task => this.executeTask(query, task, plan, understanding, taskResults, nodes))
      );
    }
  }

  /**
   * Checks if there are pending tasks.
   */
  private hasPendingTasks(nodes: Map<string, TaskNode>): boolean {
    return Array.from(nodes.values()).some(
      n => n.status === 'pending' || n.status === 'ready' || n.status === 'running'
    );
  }

  /**
   * Gets tasks whose dependencies are all completed.
   */
  private getReadyTasks(nodes: Map<string, TaskNode>): Task[] {
    const ready: Task[] = [];
    
    for (const node of nodes.values()) {
      if (node.status !== 'pending') continue;
      
      const deps = node.task.dependsOn || [];
      const depsCompleted = deps.every(depId => {
        const depNode = nodes.get(depId);
        return depNode?.status === 'completed';
      });
      
      if (depsCompleted) {
        node.status = 'ready';
        ready.push(node.task);
      }
    }
    
    return ready;
  }

  /**
   * Executes a single task.
   */
  private async executeTask(
    query: string,
    task: Task,
    plan: Plan,
    understanding: Understanding,
    taskResults: Map<string, TaskResult>,
    nodes: Map<string, TaskNode>
  ): Promise<void> {
    const node = nodes.get(task.id);
    if (!node) return;
    
    node.status = 'running';
    this.callbacks.onTaskUpdate?.(task.id, 'in_progress');

    const queryId = this.contextManager.hashQuery(query);

    // For use_tools tasks, select and execute tools
    if (task.taskType === 'use_tools') {
      // Step 1: Select tools using small model
      const toolCalls = await this.selectTools(task, understanding);
      task.toolCalls = toolCalls;
      
      // Notify UI of the selected tool calls
      if (toolCalls.length > 0) {
        this.callbacks.onTaskToolCallsSet?.(task.id, toolCalls);
      }

      // Step 2: Execute the selected tools
      let toolsSucceeded = true;
      if (toolCalls.length > 0) {
        toolsSucceeded = await this.executeTools(task, queryId);
      }

      if (toolsSucceeded) {
        taskResults.set(task.id, {
          taskId: task.id,
          output: `Data gathered: ${task.toolCalls?.map(tc => tc.tool).join(', ') || 'none'}`,
        });
        node.status = 'completed';
        this.callbacks.onTaskUpdate?.(task.id, 'completed');
      } else {
        const failedTools = task.toolCalls?.filter(tc => tc.status === 'failed').map(tc => tc.tool) || [];
        taskResults.set(task.id, {
          taskId: task.id,
          output: `Failed to gather data: ${failedTools.join(', ')}`,
        });
        node.status = 'completed'; // Still mark completed so dependent tasks can proceed
        this.callbacks.onTaskUpdate?.(task.id, 'failed');
      }
      return;
    }

    // For reason tasks, call LLM to analyze gathered data
    if (task.taskType === 'reason') {
      const contextData = this.buildContextData(query, taskResults, plan);
      
      const result = await this.executePhase.run({
        query,
        task,
        plan,
        contextData,
      });
      
      taskResults.set(task.id, result);
      node.status = 'completed';
      this.callbacks.onTaskUpdate?.(task.id, 'completed');
    }
  }

  /**
   * Selects tools for a task using gpt-5-mini with bound tools.
   * Uses a precise, well-defined prompt optimized for small models.
   */
  private async selectTools(
    task: Task,
    understanding: Understanding
  ): Promise<ToolCallStatus[]> {
    // Extract entities for the prompt
    const tickers = understanding.entities
      .filter(e => e.type === 'ticker')
      .map(e => e.value);
    
    const periods = understanding.entities
      .filter(e => e.type === 'period')
      .map(e => e.value);

    const prompt = buildToolSelectionPrompt(task.description, tickers, periods);
    const systemPrompt = getToolSelectionSystemPrompt(this.formatToolDescriptions());

    // Use small model with bound tools
    const response = await callLlm(prompt, {
      model: SMALL_MODEL,
      systemPrompt,
      tools: this.tools,
    });

    // Extract tool_calls from AIMessage
    const toolCalls = this.extractToolCalls(response);
    return toolCalls.map(tc => ({ ...tc, status: 'pending' as const }));
  }

  /**
   * Extracts tool calls from an LLM response.
   */
  private extractToolCalls(response: unknown): Array<{ tool: string; args: Record<string, unknown> }> {
    if (!response || typeof response !== 'object') return [];
    
    const message = response as AIMessage;
    if (!message.tool_calls || !Array.isArray(message.tool_calls)) return [];

    return message.tool_calls.map(tc => ({
      tool: tc.name,
      args: tc.args as Record<string, unknown>,
    }));
  }

  /**
   * Formats tool descriptions for the prompt.
   */
  private formatToolDescriptions(): string {
    return this.tools.map(tool => {
      const schema = tool.schema;
      let argsDescription = '';
      
      if (schema && typeof schema === 'object' && 'shape' in schema) {
        const shape = schema.shape as Record<string, { description?: string }>;
        const args = Object.entries(shape)
          .map(([key, value]) => `  - ${key}: ${value.description || 'No description'}`)
          .join('\n');
        argsDescription = args ? `\n  Arguments:\n${args}` : '';
      }
      
      return `- ${tool.name}: ${tool.description}${argsDescription}`;
    }).join('\n\n');
  }

  /**
   * Executes tool calls for a task and saves results to context.
   * Returns true if all tool calls succeeded, false if any failed.
   */
  private async executeTools(task: Task, queryId: string): Promise<boolean> {
    if (!task.toolCalls) return true;

    let allSucceeded = true;

    // Execute tool calls in parallel
    await Promise.all(
      task.toolCalls.map(async (toolCall, index) => {
        this.callbacks.onToolCallUpdate?.(task.id, index, 'running');
        
        try {
          const tool = this.toolMap.get(toolCall.tool);
          if (!tool) {
            throw new Error(`Tool not found: ${toolCall.tool}`);
          }

          const result = await tool.invoke(toolCall.args);

          // Save to context
          this.contextManager.saveContext(
            toolCall.tool,
            toolCall.args,
            result,
            undefined,
            queryId
          );

          toolCall.status = 'completed';
          this.callbacks.onToolCallUpdate?.(task.id, index, 'completed');
        } catch (error) {
          allSucceeded = false;
          toolCall.status = 'failed';
          this.callbacks.onToolCallUpdate?.(task.id, index, 'failed');
          this.callbacks.onToolCallError?.(
            task.id, 
            index, 
            toolCall.tool,
            toolCall.args,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      })
    );

    return allSucceeded;
  }

  /**
   * Builds context data string from previous task results and context manager.
   */
  private buildContextData(
    query: string,
    taskResults: Map<string, TaskResult>,
    plan: Plan
  ): string {
    const parts: string[] = [];

    // Add previous task outputs
    for (const task of plan.tasks) {
      const result = taskResults.get(task.id);
      if (result?.output) {
        parts.push(`Previous task "${task.description}":\n${result.output}`);
      }
    }

    // Add gathered data from context manager
    const queryId = this.contextManager.hashQuery(query);
    const pointers = this.contextManager.getPointersForQuery(queryId);
    
    if (pointers.length > 0) {
      const contexts = this.contextManager.loadContexts(pointers.map(p => p.filepath));
      
      for (const ctx of contexts) {
        const toolName = ctx.toolName || 'unknown';
        const args = ctx.args || {};
        const result = ctx.result;
        const sourceUrls = ctx.sourceUrls || [];
        const sourceLine = sourceUrls.length > 0 
          ? `\nSource URLs: ${sourceUrls.join(', ')}` 
          : '';
        
        parts.push(`Data from ${toolName} (${JSON.stringify(args)}):${sourceLine}\n${JSON.stringify(result, null, 2)}`);
      }
    }

    return parts.length > 0 ? parts.join('\n\n---\n\n') : 'No data available.';
  }

  /**
   * Generates the final answer from all task results.
   */
  private async generateFinalAnswer(
    query: string,
    plan: Plan,
    taskResults: Map<string, TaskResult>
  ): Promise<string> {
    this.callbacks.onAnswerStart?.();

    // Format task outputs
    const taskOutputs = plan.tasks
      .map(task => {
        const result = taskResults.get(task.id);
        const output = result?.output ?? 'No output';
        return `Task: ${task.description}\nOutput: ${output}`;
      })
      .join('\n\n---\n\n');

    // Collect sources from context manager
    const queryId = this.contextManager.hashQuery(query);
    const pointers = this.contextManager.getPointersForQuery(queryId);
    
    const sources = pointers
      .filter(p => p.sourceUrls && p.sourceUrls.length > 0)
      .map(p => ({
        description: p.toolDescription,
        urls: p.sourceUrls!,
      }));

    const sourcesStr = sources.length > 0
      ? sources.map(s => `${s.description}: ${s.urls.join(', ')}`).join('\n')
      : '';

    // Build the final answer prompt
    const systemPrompt = getFinalAnswerSystemPrompt();
    const userPrompt = buildFinalAnswerUserPrompt(query, taskOutputs, sourcesStr);

    // Stream the answer
    const stream = callLlmStream(userPrompt, {
      systemPrompt,
      model: this.model,
    });

    this.callbacks.onAnswerStream?.(stream);

    return '';
  }
}
