import { Agent } from '../agent.js';
import type { Task, TaskPlan } from './types.js';
import type { AgentEvent } from '../types.js';

/**
 * Task execution events
 */
export interface TaskStatusChangedEvent {
  type: 'task_status_changed';
  taskId: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  result?: string;
  error?: string;
}

export interface TaskPlanCreatedEvent {
  type: 'task_plan_created';
  plan: TaskPlan;
}

export type TaskEvent = TaskStatusChangedEvent | TaskPlanCreatedEvent | AgentEvent;

/**
 * Executes tasks from a plan, respecting dependencies
 */
export class TaskExecutor {
  private readonly agent: Agent;
  private readonly signal?: AbortSignal;

  constructor(agent: Agent, signal?: AbortSignal) {
    this.agent = agent;
    this.signal = signal;
  }

  /**
   * Execute a complete task plan, yielding events for each status change
   */
  async *execute(plan: TaskPlan): AsyncGenerator<TaskEvent> {
    yield {
      type: 'task_plan_created',
      plan,
    } as TaskPlanCreatedEvent;

    // Keep executing until all tasks are done or failed
    while (this.hasPendingTasks(plan)) {
      const readyTasks = this.getReadyTasks(plan);

      if (readyTasks.length === 0) {
        // No tasks ready - check if we're blocked
        const incompleteTasks = plan.tasks.filter(
          t => t.status === 'pending' || t.status === 'running'
        );
        if (incompleteTasks.length > 0) {
          // Tasks exist but none are ready = circular dependency or all failed
          throw new Error('Task execution blocked - possible circular dependencies or all dependencies failed');
        }
        break;
      }

      // Execute ready tasks sequentially (TODO: parallel execution in future)
      for (const task of readyTasks) {
        yield* this.executeTask(task, plan);
      }
    }
  }

  /**
   * Check if there are any tasks still pending or running
   */
  private hasPendingTasks(plan: TaskPlan): boolean {
    return plan.tasks.some(t => t.status === 'pending' || t.status === 'running');
  }

  /**
   * Get tasks that are ready to execute (dependencies satisfied)
   */
  private getReadyTasks(plan: TaskPlan): Task[] {
    return plan.tasks.filter(task => {
      if (task.status !== 'pending') return false;

      // Check all dependencies are complete
      return task.dependencies.every(depId => {
        const depTask = plan.tasks.find(t => t.id === depId);
        return depTask?.status === 'complete';
      });
    });
  }

  /**
 * Execute a single task by running its tool calls through the agent
   */
  private async *executeTask(task: Task, plan: TaskPlan): AsyncGenerator<TaskEvent> {
    task.status = 'running';
    task.startTime = Date.now();

    yield {
      type: 'task_status_changed',
      taskId: task.id,
      status: 'running',
    } as TaskStatusChangedEvent;

    try {
      // If task has no tool calls, it's a synthesis/reasoning step
      // Build a query from the task description + previous results
      let taskQuery: string;
      
      if (task.toolCalls.length === 0) {
        // Synthesis task - gather context from dependencies
        const depResults = task.dependencies
          .map(depId => {
            const depTask = plan.tasks.find(t => t.id === depId);
            return depTask?.result ? `${depTask.description}: ${depTask.result}` : '';
          })
          .filter(Boolean)
          .join('\n\n');

        taskQuery = `${task.description}\n\nContext from previous tasks:\n${depResults}`;
      } else {
        // Tool-based task - execute specific tool calls
        taskQuery = this.buildToolQuery(task, plan);
      }

      // Execute through agent (uses existing tool-calling loop)
      const results: string[] = [];
      
      for await (const event of this.agent.run(taskQuery)) {
        // Forward all agent events
        yield event as AgentEvent;

        if (event.type === 'done') {
          results.push(event.answer);
        }
      }

      task.status = 'complete';
      task.endTime = Date.now();
      task.result = results.join('\n\n');

      yield {
        type: 'task_status_changed',
        taskId: task.id,
        status: 'complete',
        result: task.result,
      } as TaskStatusChangedEvent;

    } catch (error) {
      task.status = 'failed';
      task.endTime = Date.now();
      task.error = error instanceof Error ? error.message : String(error);

      yield {
        type: 'task_status_changed',
        taskId: task.id,
        status: 'failed',
        error: task.error,
      } as TaskStatusChangedEvent;
    }
  }

  /**
   * Build a query string for tasks with explicit tool calls
   */
  private buildToolQuery(task: Task, plan: TaskPlan): string {
    // Get context from dependencies
    const depResults = task.dependencies
      .map(depId => {
        const depTask = plan.tasks.find(t => t.id === depId);
        return depTask?.result ? `Previous step "${depTask.description}": ${depTask.result}` : '';
      })
      .filter(Boolean);

    const contextPart = depResults.length > 0 
      ? `\n\nContext:\n${depResults.join('\n')}` 
      : '';

    return `${task.description}${contextPart}

Required tool calls: ${JSON.stringify(task.toolCalls, null, 2)}`;
  }
}
