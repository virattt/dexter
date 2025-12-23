import { ToolContextManager } from '../utils/context.js';
import { ToolExecutor, ToolExecutorCallbacks } from './tool-executor.js';
import { ExecutePhase } from './phases/execute.js';
import type { 
  Task, 
  TaskStatus, 
  Plan, 
  Understanding,
  TaskResult,
  ToolCallStatus,
} from './state.js';

// ============================================================================
// Task Node (Internal State)
// ============================================================================

interface TaskNode {
  task: Task;
  status: 'pending' | 'ready' | 'running' | 'completed';
}

// ============================================================================
// Task Executor Options
// ============================================================================

export interface TaskExecutorOptions {
  model: string;
  toolExecutor: ToolExecutor;
  executePhase: ExecutePhase;
  contextManager: ToolContextManager;
}

// ============================================================================
// Task Executor Callbacks
// ============================================================================

export interface TaskExecutorCallbacks extends ToolExecutorCallbacks {
  onTaskUpdate?: (taskId: string, status: TaskStatus) => void;
  onTaskToolCallsSet?: (taskId: string, toolCalls: ToolCallStatus[]) => void;
}

// ============================================================================
// Task Executor Implementation
// ============================================================================

/**
 * Handles task scheduling and execution with dependency-aware parallelization.
 * Delegates tool selection/execution to ToolExecutor and reasoning to ExecutePhase.
 */
export class TaskExecutor {
  private readonly model: string;
  private readonly toolExecutor: ToolExecutor;
  private readonly executePhase: ExecutePhase;
  private readonly contextManager: ToolContextManager;

  constructor(options: TaskExecutorOptions) {
    this.model = options.model;
    this.toolExecutor = options.toolExecutor;
    this.executePhase = options.executePhase;
    this.contextManager = options.contextManager;
  }

  /**
   * Executes all tasks with dependency-aware parallelization.
   */
  async executeTasks(
    query: string,
    plan: Plan,
    understanding: Understanding,
    taskResults: Map<string, TaskResult>,
    callbacks?: TaskExecutorCallbacks
  ): Promise<void> {
    const nodes = new Map<string, TaskNode>();
    for (const task of plan.tasks) {
      nodes.set(task.id, { task, status: 'pending' });
    }

    while (this.hasPendingTasks(nodes)) {
      const readyTasks = this.getReadyTasks(nodes);
      
      if (readyTasks.length === 0) {
        break; // No tasks can proceed - might be a dependency cycle
      }

      await Promise.all(
        readyTasks.map(task => 
          this.executeTask(query, task, plan, understanding, taskResults, nodes, callbacks)
        )
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
    nodes: Map<string, TaskNode>,
    callbacks?: TaskExecutorCallbacks
  ): Promise<void> {
    const node = nodes.get(task.id);
    if (!node) return;
    
    node.status = 'running';
    callbacks?.onTaskUpdate?.(task.id, 'in_progress');

    const queryId = this.contextManager.hashQuery(query);

    if (task.taskType === 'use_tools') {
      const toolCalls = await this.toolExecutor.selectTools(task, understanding);
      task.toolCalls = toolCalls;
      
      if (toolCalls.length > 0) {
        callbacks?.onTaskToolCallsSet?.(task.id, toolCalls);
      }

      let toolsSucceeded = true;
      if (toolCalls.length > 0) {
        toolsSucceeded = await this.toolExecutor.executeTools(task, queryId, callbacks);
      }

      if (toolsSucceeded) {
        taskResults.set(task.id, {
          taskId: task.id,
          output: `Data gathered: ${task.toolCalls?.map(tc => tc.tool).join(', ') || 'none'}`,
        });
        node.status = 'completed';
        callbacks?.onTaskUpdate?.(task.id, 'completed');
      } else {
        const failedTools = task.toolCalls?.filter(tc => tc.status === 'failed').map(tc => tc.tool) || [];
        taskResults.set(task.id, {
          taskId: task.id,
          output: `Failed to gather data: ${failedTools.join(', ')}`,
        });
        node.status = 'completed';
        callbacks?.onTaskUpdate?.(task.id, 'failed');
      }
      return;
    }

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
      callbacks?.onTaskUpdate?.(task.id, 'completed');
    }
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

    for (const task of plan.tasks) {
      const result = taskResults.get(task.id);
      if (result?.output) {
        parts.push(`Previous task "${task.description}":\n${result.output}`);
      }
    }

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
}

