import { AIMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { PlannedTask, SubTask, SubTaskResult } from './schemas.js';
import { TOOLS } from '../tools/index.js';
import { callLlm } from '../model/llm.js';
import { getSubtaskExecutionSystemPrompt } from './prompts.js';
import { ContextManager } from '../utils/context.js';

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
 * Executes subtasks using an agentic loop.
 * Each subtask can use 0, 1, or many tools.
 * Tool outputs are saved to filesystem via ContextManager.
 */
export class TaskExecutor {
  private toolMap: Map<string, StructuredToolInterface>;
  private readonly maxIterationsPerSubTask: number;

  constructor(
    private readonly contextManager: ContextManager,
    private readonly model?: string,
    maxIterationsPerSubTask: number = 5
  ) {
    this.toolMap = new Map(TOOLS.map(t => [t.name, t]));
    this.maxIterationsPerSubTask = maxIterationsPerSubTask;
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
    const { task, subTasks } = plannedTask;

    if (subTasks.length === 0) {
      callbacks?.onTaskComplete?.(task.id, true);
      return [];
    }

    callbacks?.onTaskStart?.(task.id);

    try {
      const results = await Promise.all(
        subTasks.map(subTask => this.executeSubTask(task.id, task.description, subTask, queryId, callbacks))
      );
      const allSucceeded = results.every(r => r.success);
      callbacks?.onTaskComplete?.(task.id, allSucceeded);
      return results;
    } catch (error) {
      callbacks?.onTaskComplete?.(task.id, false);
      return [];
    }
  }

  /**
   * Execute a single subtask using an agentic loop.
   * The LLM decides which tools to call (0, 1, or many) until the subtask is complete.
   */
  private async executeSubTask(
    taskId: number,
    taskDescription: string,
    subTask: SubTask,
    queryId?: string,
    callbacks?: TaskExecutorCallbacks
  ): Promise<SubTaskResult> {
    callbacks?.onSubTaskStart?.(taskId, subTask.id);

    // Track tool output summaries for this subtask's loop
    const outputSummaries: string[] = [];
    let iterations = 0;

    try {
      while (iterations < this.maxIterationsPerSubTask) {
        iterations++;

        // Ask LLM what tool(s) to call next
        const aiMessage = await this.askForActions(
          taskDescription,
          subTask.description,
          outputSummaries
        );

        // If no tool calls, subtask is complete
        if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0) {
          break;
        }

        // Execute each tool call and save results
        for (const toolCall of aiMessage.tool_calls) {
          const toolName = toolCall.name;
          const args = toolCall.args as Record<string, unknown>;

          try {
            const result = await this.executeToolCall(toolName, args);
            
            // Save to filesystem via ContextManager
            await this.contextManager.saveContext(toolName, args, result, taskId, queryId);
            
            // Get the summary from the just-saved pointer
            const pointer = this.contextManager.pointers[this.contextManager.pointers.length - 1];
            const summary = `Output of ${toolName} with args ${JSON.stringify(args)}: ${pointer.summary}`;
            outputSummaries.push(summary);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            outputSummaries.push(`Error from ${toolName}: ${errorMsg}`);
          }
        }
      }

      callbacks?.onSubTaskComplete?.(taskId, subTask.id, true);
      return { taskId, subTaskId: subTask.id, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      callbacks?.onSubTaskComplete?.(taskId, subTask.id, false);
      return { taskId, subTaskId: subTask.id, success: false };
    }
  }

  /**
   * Ask LLM what actions to take for the current subtask.
   */
  private async askForActions(
    taskDescription: string,
    subTaskDescription: string,
    previousOutputs: string[]
  ): Promise<AIMessage> {
    const outputHistory = previousOutputs.length > 0 
      ? previousOutputs.join('\n') 
      : 'No tool outputs yet.';

    const prompt = `
Task: "${taskDescription}"
Subtask: "${subTaskDescription}"

Tool outputs so far:
${outputHistory}

Based on the subtask and any existing outputs, determine what tool calls (if any) are needed.
If the subtask can be completed with the existing data, return without tool calls.`;

    const response = await callLlm(prompt, {
      systemPrompt: getSubtaskExecutionSystemPrompt(),
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
