import { AIMessage } from '@langchain/core/messages';
import { callLlm } from '../model/llm.js';
import { TOOLS } from '../tools/index.js';
import { Task, TaskListSchema, SubTask, PlannedTask } from './schemas.js';
import { getPlanningSystemPrompt, getSubtaskPlanningSystemPrompt } from './prompts.js';

/**
 * Callbacks for task planning
 */
export interface TaskPlannerCallbacks {
  onLog?: (message: string) => void;
  onSubtasksPlanned?: (taskId: number, subTasks: SubTask[]) => void;
}

/**
 * Responsible for all planning operations:
 * 1. Planning high-level tasks from a user query
 * 2. Planning subtasks (tool calls) for each task
 */
export class TaskPlanner {
  constructor(private readonly model?: string) {}

  /**
   * Plans high-level tasks based on the user query.
   * Returns simple tasks with id, description, and done status.
   */
  async planTasks(query: string, callbacks?: TaskPlannerCallbacks): Promise<Task[]> {
    const toolDescriptions = this.buildToolDescriptions();
    const prompt = this.buildTaskPlanningPrompt(query);
    const systemPrompt = getPlanningSystemPrompt(toolDescriptions);

    try {
      const response = await callLlm(prompt, {
        systemPrompt,
        outputSchema: TaskListSchema,
        model: this.model,
      });
      const tasks = (response as { tasks: Task[] }).tasks;
      callbacks?.onLog?.(`[DEBUG] Tasks planned: ${JSON.stringify(tasks, null, 2)}`);
      
      if (!Array.isArray(tasks)) {
        return [];
      }
      
      // Ensure all tasks have proper initialization
      return tasks.map(task => ({
        ...task,
        done: task.done ?? false,
      }));
    } catch (error: unknown) {
      callbacks?.onLog?.(`[ERROR] Failed to plan tasks for query: ${query}`);
      callbacks?.onLog?.(`[ERROR] Error: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Plans subtasks (tool calls) for all tasks in parallel.
   * Uses bindTools to get native tool call format - avoids schema restrictions.
   */
  async planSubtasks(tasks: Task[], callbacks?: TaskPlannerCallbacks): Promise<PlannedTask[]> {
    const plannedTasks = await Promise.all(
      tasks.map(task => this.planTaskSubtasks(task, callbacks))
    );
    return plannedTasks;
  }

  /**
   * Plans subtasks for a single task.
   * Uses bindTools to determine which tools to call.
   */
  private async planTaskSubtasks(task: Task, callbacks?: TaskPlannerCallbacks): Promise<PlannedTask> {
    const prompt = this.buildSubtaskPlanningPrompt(task);
    const systemPrompt = getSubtaskPlanningSystemPrompt();

    try {
      // Call LLM with tools bound - returns AIMessage with tool_calls
      const response = await callLlm(prompt, {
        systemPrompt,
        tools: TOOLS,
        model: this.model,
      });

      // Extract subtasks from the AIMessage
      const subTasks = this.extractSubtasks(response as AIMessage);
      
      callbacks?.onLog?.(`[DEBUG] Task ${task.id} has ${subTasks.length} subtasks`);
      callbacks?.onSubtasksPlanned?.(task.id, subTasks);

      return { task, subTasks };
    } catch (error: unknown) {
      callbacks?.onLog?.(`[ERROR] Failed to plan subtasks for task ${task.id}: ${error instanceof Error ? error.message : String(error)}`);
      // Return task with no subtasks on error
      return { task, subTasks: [] };
    }
  }

  /**
   * Extracts subtasks (tool calls) from an AIMessage response.
   */
  private extractSubtasks(response: AIMessage): SubTask[] {
    if (!response.tool_calls || response.tool_calls.length === 0) {
      return [];
    }

    return response.tool_calls.map(tc => ({
      name: tc.name,
      args: tc.args as Record<string, unknown>,
    }));
  }

  /**
   * Builds simple tool descriptions for the LLM (name and description only).
   */
  private buildToolDescriptions(): string {
    return TOOLS.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n');
  }

  private buildTaskPlanningPrompt(query: string): string {
    return `Given the user query: "${query}"

Create a list of tasks to be completed. Each task should be a specific, actionable step.

Remember:
- Make tasks specific and focused
- Include relevant details like ticker symbols, time periods, metrics
- Tasks should map clearly to available tools`;
  }

  private buildSubtaskPlanningPrompt(task: Task): string {
    return `Task to complete: "${task.description}"

Analyze this task and determine which tool calls are needed to retrieve the required data.
Make the appropriate tool calls with correct parameters.`;
  }
}
