import { StructuredToolInterface } from '@langchain/core/tools';
import { AIMessage } from '@langchain/core/messages';
import { callLlm } from '../model/llm.js';
import { ToolContextManager } from '../utils/context.js';
import { getToolSelectionSystemPrompt, buildToolSelectionPrompt } from './prompts.js';
import type { Task, ToolCallStatus, Understanding } from './state.js';

// ============================================================================
// Constants
// ============================================================================

const SMALL_MODEL = 'gpt-5-mini';

// ============================================================================
// Tool Executor Options
// ============================================================================

export interface ToolExecutorOptions {
  tools: StructuredToolInterface[];
  contextManager: ToolContextManager;
}

// ============================================================================
// Tool Executor Callbacks
// ============================================================================

export interface ToolExecutorCallbacks {
  onToolCallUpdate?: (taskId: string, toolIndex: number, status: ToolCallStatus['status']) => void;
  onToolCallError?: (taskId: string, toolIndex: number, toolName: string, args: Record<string, unknown>, error: Error) => void;
}

// ============================================================================
// Tool Executor Implementation
// ============================================================================

/**
 * Handles tool selection and execution for tasks.
 * Uses a small, fast model (gpt-5-mini) for tool selection.
 */
export class ToolExecutor {
  private readonly tools: StructuredToolInterface[];
  private readonly toolMap: Map<string, StructuredToolInterface>;
  private readonly contextManager: ToolContextManager;

  constructor(options: ToolExecutorOptions) {
    this.tools = options.tools;
    this.toolMap = new Map(options.tools.map(t => [t.name, t]));
    this.contextManager = options.contextManager;
  }

  /**
   * Selects tools for a task using gpt-5-mini with bound tools.
   * Uses a precise, well-defined prompt optimized for small models.
   */
  async selectTools(
    task: Task,
    understanding: Understanding
  ): Promise<ToolCallStatus[]> {
    const tickers = understanding.entities
      .filter(e => e.type === 'ticker')
      .map(e => e.value);
    
    const periods = understanding.entities
      .filter(e => e.type === 'period')
      .map(e => e.value);

    const prompt = buildToolSelectionPrompt(task.description, tickers, periods);
    const systemPrompt = getToolSelectionSystemPrompt(this.formatToolDescriptions());

    const response = await callLlm(prompt, {
      model: SMALL_MODEL,
      systemPrompt,
      tools: this.tools,
    });

    const toolCalls = this.extractToolCalls(response);
    return toolCalls.map(tc => ({ ...tc, status: 'pending' as const }));
  }

  /**
   * Executes tool calls for a task and saves results to context.
   * Returns true if all tool calls succeeded, false if any failed.
   */
  async executeTools(
    task: Task,
    queryId: string,
    callbacks?: ToolExecutorCallbacks
  ): Promise<boolean> {
    if (!task.toolCalls) return true;

    let allSucceeded = true;

    await Promise.all(
      task.toolCalls.map(async (toolCall, index) => {
        callbacks?.onToolCallUpdate?.(task.id, index, 'running');
        
        try {
          const tool = this.toolMap.get(toolCall.tool);
          if (!tool) {
            throw new Error(`Tool not found: ${toolCall.tool}`);
          }

          const result = await tool.invoke(toolCall.args);

          this.contextManager.saveContext(
            toolCall.tool,
            toolCall.args,
            result,
            undefined,
            queryId
          );

          toolCall.status = 'completed';
          callbacks?.onToolCallUpdate?.(task.id, index, 'completed');
        } catch (error) {
          allSucceeded = false;
          toolCall.status = 'failed';
          callbacks?.onToolCallUpdate?.(task.id, index, 'failed');
          callbacks?.onToolCallError?.(
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
}

