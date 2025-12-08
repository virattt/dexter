import { StructuredToolInterface } from '@langchain/core/tools';
import { PlannedTask, SubTask, SubTaskResult } from './schemas.js';
import { TOOLS } from '../tools/index.js';
import { ToolContextManager } from '../utils/context.js';

/**
 * Callbacks for observing task execution progress
 */
export interface TaskExecutorCallbacks {
  onSubTaskStart?: (taskId: number, subTaskId: number) => void;
  onSubTaskComplete?: (taskId: number, subTaskId: number, success: boolean) => void;
  onTaskStart?: (taskId: number) => void;
  onTaskComplete?: (taskId: number, success: boolean) => void;
}

/**
 * Executes planned subtasks directly without LLM calls.
 * Each subtask has explicit toolName and toolArgs from the planner.
 * Tool outputs are saved to filesystem via ToolContextManager.
 */
export class TaskExecutor {
  private toolMap: Map<string, StructuredToolInterface>;

  constructor(
    private readonly toolContextManager: ToolContextManager,
  ) {
    this.toolMap = new Map(TOOLS.map(t => [t.name, t]));
  }

  /**
   * Execute all planned tasks in parallel.
   */
  async executeTasks(plannedTasks: PlannedTask[], queryId?: string, callbacks?: TaskExecutorCallbacks): Promise<SubTaskResult[]> {
    const taskResultArrays = await Promise.all(
      plannedTasks.map(plannedTask => this.executeTask(plannedTask, queryId, callbacks))
    );
    return taskResultArrays.flat();
  }

  /**
   * Execute a single planned task by running all its subtasks in parallel.
   */
  private async executeTask(plannedTask: PlannedTask, queryId?: string, callbacks?: TaskExecutorCallbacks): Promise<SubTaskResult[]> {
    const { id: taskId, subTasks } = plannedTask;

    if (subTasks.length === 0) {
      callbacks?.onTaskComplete?.(taskId, true);
      return [];
    }

    callbacks?.onTaskStart?.(taskId);

    try {
      const results = await Promise.all(
        subTasks.map(subTask => this.executeSubTask(taskId, subTask, queryId, callbacks))
      );
      const allSucceeded = results.every(r => r.success);
      callbacks?.onTaskComplete?.(taskId, allSucceeded);
      return results;
    } catch (error) {
      callbacks?.onTaskComplete?.(taskId, false);
      return [];
    }
  }

  /**
   * Execute a single subtask by calling its specified tool directly.
   * No LLM call needed - the planner already determined the exact tool and args.
   */
  private async executeSubTask(
    taskId: number,
    subTask: SubTask,
    queryId?: string,
    callbacks?: TaskExecutorCallbacks
  ): Promise<SubTaskResult> {
    callbacks?.onSubTaskStart?.(taskId, subTask.id);

    try {
      // Direct execution - no LLM call needed
      const result = await this.executeToolCall(subTask.toolName, subTask.toolArgs);

      // Save to filesystem via ToolContextManager
      this.toolContextManager.saveContext(
        subTask.toolName,
        subTask.toolArgs,
        result,
        taskId,
        queryId
      );

      callbacks?.onSubTaskComplete?.(taskId, subTask.id, true);
      return { taskId, subTaskId: subTask.id, success: true };
    } catch (error) {
      callbacks?.onSubTaskComplete?.(taskId, subTask.id, false);
      return { taskId, subTaskId: subTask.id, success: false };
    }
  }

  /**
   * Execute a tool call and return the result.
   */
  private async executeToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const tool = this.toolMap.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return await tool.invoke(args);
  }
}
