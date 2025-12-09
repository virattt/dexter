import { StructuredToolInterface } from '@langchain/core/tools';
import { AIMessage } from '@langchain/core/messages';
import { PlannedTask, SubTaskResult } from './schemas.js';
import { TOOLS } from '../tools/index.js';
import { ToolContextManager } from '../utils/context.js';
import { callLlm } from '../model/llm.js';
import { getTaskExecutionSystemPrompt } from './prompts.js';

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
 * Executes planned tasks by resolving subtasks to tool calls via LLM.
 * Tool outputs are saved to filesystem via ToolContextManager.
 */
export class TaskExecutor {
  private toolMap: Map<string, StructuredToolInterface>;

  constructor(
    private readonly toolContextManager: ToolContextManager,
    private readonly model?: string,
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
   * Execute a single planned task by resolving subtasks to tool calls via LLM.
   */
  private async executeTask(plannedTask: PlannedTask, queryId?: string, callbacks?: TaskExecutorCallbacks): Promise<SubTaskResult[]> {
    const { id: taskId, subTasks } = plannedTask;

    if (subTasks.length === 0) {
      callbacks?.onTaskComplete?.(taskId, true);
      return [];
    }

    callbacks?.onTaskStart?.(taskId);

    try {
      // Resolve subtasks to tool calls via LLM
      const aiMessage = await this.generateToolCalls(plannedTask);
      const toolCalls = aiMessage.tool_calls || [];

      if (toolCalls.length === 0) {
        callbacks?.onTaskComplete?.(taskId, true);
        return [];
      }

      // Notify about subtask starts (one per tool call)
      toolCalls.forEach((_, index) => {
        callbacks?.onSubTaskStart?.(taskId, index + 1);
      });

      // Execute all tool calls in parallel
      const results = await Promise.all(
        toolCalls.map(async (toolCall, index) => {
          const subTaskId = index + 1;
          try {
            const result = await this.executeToolCall(toolCall.name, toolCall.args);

            // Save to filesystem via ToolContextManager
            this.toolContextManager.saveContext(
              toolCall.name,
              toolCall.args,
              result,
              taskId,
              queryId
            );

            callbacks?.onSubTaskComplete?.(taskId, subTaskId, true);
            return { taskId, subTaskId, success: true };
          } catch {
            callbacks?.onSubTaskComplete?.(taskId, subTaskId, false);
            return { taskId, subTaskId, success: false };
          }
        })
      );

      const allSucceeded = results.every(r => r.success);
      callbacks?.onTaskComplete?.(taskId, allSucceeded);
      return results;
    } catch {
      callbacks?.onTaskComplete?.(taskId, false);
      return [];
    }
  }

  /**
   * Ask the LLM to resolve a task's subtasks into tool calls.
   */
  private async generateToolCalls(task: PlannedTask): Promise<AIMessage> {
    const subtaskList = task.subTasks
      .map(s => `- ${s.description}`)
      .join('\n');

    const prompt = `Task: "${task.description}"

Subtasks to complete:
${subtaskList}

Call the appropriate tools to gather data for these subtasks.`;

    const response = await callLlm(prompt, {
      systemPrompt: getTaskExecutionSystemPrompt(),
      tools: TOOLS,
      model: this.model,
    });

    return response as AIMessage;
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
