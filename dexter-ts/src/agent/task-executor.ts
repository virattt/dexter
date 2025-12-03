import { StructuredToolInterface } from '@langchain/core/tools';
import { PlannedTask, SubTask, SubTaskResult } from './schemas.js';
import { TOOLS } from '../tools/index.js';

/**
 * Callbacks for observing task execution progress
 */
export interface TaskExecutorCallbacks {
  onLog?: (message: string) => void;
  onToolRun?: (taskId: number, tool: string, args: Record<string, unknown>, result: string) => void;
  onTaskComplete?: (taskId: number, success: boolean) => void;
}

/**
 * Executes subtasks (tool calls) from planned tasks.
 * Each planned task contains the subtasks determined by the TaskPlanner.
 */
export class TaskExecutor {
  private toolMap: Map<string, StructuredToolInterface>;

  constructor() {
    // Build a map for quick tool lookup
    this.toolMap = new Map(TOOLS.map(t => [t.name, t]));
  }

  /**
   * Execute all planned tasks in parallel.
   * Returns results from all subtask executions.
   */
  async executeAll(plannedTasks: PlannedTask[], callbacks?: TaskExecutorCallbacks): Promise<SubTaskResult[]> {
    // Execute all tasks in parallel, each task executes its subtasks
    const taskResultArrays = await Promise.all(
      plannedTasks.map(plannedTask => this.executeTask(plannedTask, callbacks))
    );
    
    // Flatten all results
    return taskResultArrays.flat();
  }

  /**
   * Execute a single planned task by running all its subtasks in parallel.
   */
  private async executeTask(plannedTask: PlannedTask, callbacks?: TaskExecutorCallbacks): Promise<SubTaskResult[]> {
    const { task, subTasks } = plannedTask;

    if (subTasks.length === 0) {
      callbacks?.onLog?.(`[INFO] Task ${task.id} has no subtasks to execute`);
      callbacks?.onTaskComplete?.(task.id, true);
      return [];
    }

    try {
      // Run all subtasks in parallel within this task
      const results = await Promise.all(
        subTasks.map(subTask => this.executeSubTask(task.id, subTask, callbacks))
      );

      // Determine overall task success
      const allSucceeded = results.every(r => r.success);
      callbacks?.onTaskComplete?.(task.id, allSucceeded);

      return results;
    } catch (error) {
      callbacks?.onLog?.(`[ERROR] Task ${task.id} execution failed: ${error}`);
      callbacks?.onTaskComplete?.(task.id, false);
      return [];
    }
  }

  /**
   * Execute a single subtask (tool call).
   */
  private async executeSubTask(
    taskId: number,
    subTask: SubTask,
    callbacks?: TaskExecutorCallbacks
  ): Promise<SubTaskResult> {
    const tool = this.toolMap.get(subTask.name);
    
    if (!tool) {
      const errorResult: SubTaskResult = {
        taskId,
        tool: subTask.name,
        args: subTask.args,
        result: '',
        success: false,
        error: `Tool not found: ${subTask.name}`,
      };
      callbacks?.onLog?.(`[ERROR] Tool not found: ${subTask.name}`);
      return errorResult;
    }

    try {
      const rawResult = await tool.invoke(subTask.args);
      const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);

      callbacks?.onToolRun?.(taskId, subTask.name, subTask.args, result);
      callbacks?.onLog?.(`[INFO] Executed ${subTask.name} for task ${taskId}`);

      return {
        taskId,
        tool: subTask.name,
        args: subTask.args,
        result,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      callbacks?.onLog?.(`[ERROR] Tool ${subTask.name} failed: ${errorMessage}`);

      return {
        taskId,
        tool: subTask.name,
        args: subTask.args,
        result: '',
        success: false,
        error: errorMessage,
      };
    }
  }
}
