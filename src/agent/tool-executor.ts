import { StructuredToolInterface } from '@langchain/core/tools';
import { AIMessage } from '@langchain/core/messages';
import { callLlm } from '../model/llm.js';
import { ToolContextManager } from '../utils/context.js';
import { getToolSelectionSystemPrompt, buildToolSelectionPrompt } from './prompts.js';
import type { Task, ToolCallStatus, Understanding } from './state.js';

// ============================================================================
// Tool Executor Options
// ============================================================================

export interface ToolExecutorOptions {
  model: string;
  tools: StructuredToolInterface[];
  contextManager: ToolContextManager;
}

// ============================================================================
// Tool Executor Callbacks
// ============================================================================

export interface ToolExecutorCallbacks {
  onToolCallUpdate?: (taskId: string, toolIndex: number, status: ToolCallStatus['status'], output?: string, error?: string) => void;
}

// ============================================================================
// Tool Executor Implementation
// ============================================================================

/**
 * Handles tool selection and execution for tasks.
 * Uses TOOL_SELECTION_MODEL env var if set, otherwise falls back to the configured model.
 */
export class ToolExecutor {
  private readonly model: string;
  private readonly toolSelectionModel: string;
  private readonly tools: StructuredToolInterface[];
  private readonly toolMap: Map<string, StructuredToolInterface>;
  private readonly contextManager: ToolContextManager;

  constructor(options: ToolExecutorOptions) {
    this.model = options.model;
    // Allow overriding the tool selection model via env vars
    const toolProvider = process.env.TOOL_SELECTION_PROVIDER;
    const toolModel = process.env.TOOL_SELECTION_MODEL;
    if (toolProvider && toolModel) {
      // Add provider prefix for local LLMs
      if (toolProvider === 'ollama') {
        this.toolSelectionModel = `ollama:${toolModel}`;
      } else if (toolProvider === 'lmstudio') {
        this.toolSelectionModel = `lmstudio:${toolModel}`;
      } else {
        this.toolSelectionModel = toolModel;
      }
    } else if (toolProvider || toolModel) {
      // Warn on partial configuration and fall back to the default model
      console.warn(
        'ToolExecutor: Both TOOL_SELECTION_PROVIDER and TOOL_SELECTION_MODEL must be set to override the tool selection model. ' +
        'Received a partial configuration; falling back to the default model.'
      );
      this.toolSelectionModel = options.model;
    } else {
      this.toolSelectionModel = options.model;
    }
    this.tools = options.tools;
    this.toolMap = new Map(options.tools.map(t => [t.name, t]));
    this.contextManager = options.contextManager;
  }

  /**
   * Selects tools for a task using the configured model with bound tools.
   * Uses a precise, well-defined prompt optimized for tool selection.
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
      model: this.toolSelectionModel,
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
    callbacks?: ToolExecutorCallbacks,
    signal?: AbortSignal
  ): Promise<boolean> {
    if (!task.toolCalls) return true;

    // Check for abort before starting
    if (signal?.aborted) {
      const error = new Error('Operation was cancelled');
      error.name = 'AbortError';
      throw error;
    }

    let allSucceeded = true;

    await Promise.all(
      task.toolCalls.map(async (toolCall, index) => {
        // Check for abort before each tool call
        if (signal?.aborted) {
          const error = new Error('Operation was cancelled');
          error.name = 'AbortError';
          throw error;
        }

        callbacks?.onToolCallUpdate?.(task.id, index, 'running');

        try {
          const tool = this.toolMap.get(toolCall.tool);
          if (!tool) {
            throw new Error(`Tool not found: ${toolCall.tool}`);
          }

          const result = await tool.invoke(toolCall.args);

          // Check for abort after tool execution
          if (signal?.aborted) {
            const error = new Error('Operation was cancelled');
            error.name = 'AbortError';
            throw error;
          }

          this.contextManager.saveContext(
            toolCall.tool,
            toolCall.args,
            result,
            undefined,
            queryId
          );

          // Capture output for UI display
          const output = typeof result === 'string' ? result : JSON.stringify(result);
          toolCall.status = 'completed';
          toolCall.output = output;
          callbacks?.onToolCallUpdate?.(task.id, index, 'completed', output);
        } catch (error) {
          // Re-throw abort errors immediately
          if ((error as Error).name === 'AbortError') {
            throw error;
          }

          allSucceeded = false;
          const errorMessage = error instanceof Error ? error.message : String(error);
          toolCall.status = 'failed';
          toolCall.error = errorMessage;
          callbacks?.onToolCallUpdate?.(task.id, index, 'failed', undefined, errorMessage);
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

