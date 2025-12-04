import { callLlm } from '../model/llm.js';
import { TOOLS } from '../tools/index.js';
import { Task, TaskListSchema, SubTask, SubTaskListSchema, PlannedTask } from './schemas.js';
import { getPlanningSystemPrompt, getSubtaskPlanningSystemPrompt } from './prompts.js';

/**
 * Callbacks for task planning
 */
export interface TaskPlannerCallbacks {
  onDebug?: (message: string) => void;
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
      // callbacks?.onDebug?.(`Tasks planned: ${JSON.stringify(tasks, null, 2)}`);
      
      if (!Array.isArray(tasks)) {
        return [];
      }
      
      // Ensure all tasks have proper initialization
      return tasks.map(task => ({
        ...task,
        done: task.done ?? false,
      }));
    } catch (error: unknown) {
      // callbacks?.onDebug?.(`Error: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Plans subtasks for all tasks in parallel.
   * Uses structured output to generate human-readable subtask descriptions.
   */
  async planSubtasks(tasks: Task[], callbacks?: TaskPlannerCallbacks): Promise<PlannedTask[]> {
    const plannedTasks = await Promise.all(
      tasks.map(task => this.planTaskSubtasks(task, callbacks))
    );
    // callbacks?.onDebug?.(`Subtasks planned: ${JSON.stringify(plannedTasks, null, 2)}`);
    return plannedTasks;
  }

  /**
   * Plans subtasks for a single task.
   * Uses structured output to get human-readable subtask descriptions.
   */
  private async planTaskSubtasks(task: Task, callbacks?: TaskPlannerCallbacks): Promise<PlannedTask> {
    const prompt = this.buildSubtaskPlanningPrompt(task);
    const systemPrompt = getSubtaskPlanningSystemPrompt();

    try {
      const response = await callLlm(prompt, {
        systemPrompt,
        outputSchema: SubTaskListSchema,
        model: this.model,
      });

      const subTasks = (response as { subTasks: SubTask[] }).subTasks || [];
      
      // callbacks?.onDebug?.(`Task ${task.id} has ${subTasks.length} subtasks`);
      callbacks?.onSubtasksPlanned?.(task.id, subTasks);

      return { task, subTasks };
    } catch (error: unknown) {
      // callbacks?.onDebug?.(`Error: ${error instanceof Error ? error.message : String(error)}`);
      return { task, subTasks: [] };
    }
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
- Make tasks specific, focused, and concise in 50 characters or less
- Include relevant details like ticker`;
  }

  private buildSubtaskPlanningPrompt(task: Task): string {
    const toolDescriptions = this.buildToolDescriptions();
    return `Task to complete: "${task.description}"

Available tools for reference:
${toolDescriptions}

Break down this task into specific, actionable subtasks. Each subtask should describe a clear data retrieval or analysis action.  Keep the subtask short and concise.`;
  }
}
