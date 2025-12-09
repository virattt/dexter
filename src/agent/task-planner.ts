import { callLlm } from '../model/llm.js';
import { TOOLS } from '../tools/index.js';
import { ExecutionPlanSchema, PlannedTask } from './schemas.js';
import { getPlanningSystemPrompt } from './prompts.js';
import { MessageHistory } from '../utils/message-history.js';

/**
 * Callbacks for task planning
 */
export interface TaskPlannerCallbacks {
  onDebug?: (message: string) => void;
}

/**
 * Responsible for planning tasks and subtasks.
 * Tool resolution happens at execution time, not during planning.
 */
export class TaskPlanner {
  constructor(private readonly model?: string) {}

  /**
   * Plans tasks with subtasks that describe what data to gather.
   * 
   * @param query - The user's query
   * @param callbacks - Optional callbacks for debugging
   * @param messageHistory - Optional message history for multi-turn context
   */
  async planTasks(
    query: string,
    callbacks?: TaskPlannerCallbacks,
    messageHistory?: MessageHistory
  ): Promise<PlannedTask[]> {
    const toolSchemas = this.buildToolSchemas();
    const systemPrompt = getPlanningSystemPrompt(toolSchemas);
    const prompt = await this.getUserPrompt(query, messageHistory);

    try {
      const response = await callLlm(prompt, {
        systemPrompt,
        outputSchema: ExecutionPlanSchema,
        model: this.model,
      });

      const tasks = (response as { tasks: PlannedTask[] }).tasks;

      if (!Array.isArray(tasks)) {
        return [];
      }

      // Validate and clean up the response
      return tasks.map((task, taskIndex) => ({
        id: task.id ?? taskIndex + 1,
        description: task.description,
        subTasks: (task.subTasks || []).map((subTask, subTaskIndex) => ({
          id: subTask.id ?? subTaskIndex + 1,
          description: subTask.description,
        })),
      }));
    } catch (error: unknown) {
      callbacks?.onDebug?.(`Planning error: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Builds tool schemas with parameter information for the LLM.
   * Includes tool name, description, and JSON schema of parameters.
   */
  private buildToolSchemas(): string {
    return TOOLS.map((tool) => {
      // The schema property is already a JSON schema from LangChain
      const jsonSchema = tool.schema as Record<string, unknown>;
      
      // Extract just the properties for cleaner output
      const properties = (jsonSchema.properties as Record<string, unknown>) || {};
      const required = (jsonSchema.required as string[]) || [];
      
      // Format parameters in a readable way
      const paramLines = Object.entries(properties).map(([name, prop]) => {
        const propObj = prop as { type?: string; description?: string; enum?: string[]; default?: unknown };
        const isRequired = required.includes(name);
        const reqLabel = isRequired ? ' (required)' : '';
        const enumValues = propObj.enum ? ` [${propObj.enum.join(', ')}]` : '';
        const defaultVal = propObj.default !== undefined ? ` default=${propObj.default}` : '';
        return `    - ${name}: ${propObj.type || 'any'}${enumValues}${reqLabel}${defaultVal} - ${propObj.description || ''}`;
      });

      return `${tool.name}: ${tool.description}
  Parameters:
${paramLines.join('\n')}`;
    }).join('\n\n');
  }

  /**
   * Builds the prompt for combined task and subtask planning.
   */
  private async getUserPrompt(query: string, messageHistory?: MessageHistory): Promise<string> {
    let conversationContext = '';

    // If message history exists, select relevant messages and include them
    if (messageHistory && messageHistory.hasMessages()) {
      const relevantMessages = await messageHistory.selectRelevantMessages(query);
      if (relevantMessages.length > 0) {
        const formattedHistory = messageHistory.formatForPlanning(relevantMessages);
        conversationContext = `
Previous conversation context (for reference when interpreting the current query):
${formattedHistory}

---

`;
      }
    }

    return `${conversationContext}User query: "${query}"

Create an execution plan with tasks and subtasks.

Remember:
- Each subtask should describe one specific data fetch
- Be specific about ticker symbols, time periods, and data needed
- If comparing multiple companies, create separate subtasks for each`;
  }
}
