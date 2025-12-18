import { DynamicStructuredTool } from '@langchain/core/tools';
import { StructuredToolInterface } from '@langchain/core/tools';
import { AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { ToolSummary } from './schemas.js';
import { ToolContextManager } from '../utils/context.js';
import { MessageHistory } from '../utils/message-history.js';
import { callLlm, callLlmStream } from '../model/llm.js';
import { TOOLS } from '../tools/index.js';
import { getSystemPrompt, buildUserPrompt, getAnswerSystemPrompt } from './prompts.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Tool call information for callbacks
 */
export interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Tool call result for callbacks
 */
export interface ToolCallResult {
  name: string;
  args: Record<string, unknown>;
  summary: string;
  success: boolean;
}

/**
 * Callbacks for observing agent execution
 */
export interface AgentCallbacks {
  /** Called when a new iteration starts */
  onIterationStart?: (iteration: number) => void;
  /** Called when the agent expresses its thinking */
  onThinking?: (thought: string) => void;
  /** Called when tool calls are about to be executed */
  onToolCallsStart?: (toolCalls: ToolCallInfo[]) => void;
  /** Called when a single tool call completes */
  onToolCallComplete?: (result: ToolCallResult) => void;
  /** Called when an iteration completes */
  onIterationComplete?: (iteration: number) => void;
  /** Called when the answer generation phase starts */
  onAnswerStart?: () => void;
  /** Called with the answer stream */
  onAnswerStream?: (stream: AsyncGenerator<string>) => void;
}

/**
 * Options for creating an Agent
 */
export interface AgentOptions {
  /** LLM model to use */
  model: string;
  /** Callbacks to observe agent execution */
  callbacks?: AgentCallbacks;
  /** Maximum number of iterations (default: 5) */
  maxIterations?: number;
}

// ============================================================================
// Finish Tool
// ============================================================================

const FinishToolSchema = z.object({
  reason: z.string().describe('Brief explanation of why you have enough data to answer the query'),
});

/**
 * Creates the "finish" tool that signals the agent is ready to generate an answer.
 */
function createFinishTool(onFinish: (reason: string) => void): StructuredToolInterface {
  return new DynamicStructuredTool({
    name: 'finish',
    description: 'Call this tool when you have gathered enough data to comprehensively answer the user\'s query. Do not call this until you have all the data you need.',
    schema: FinishToolSchema,
    func: async ({ reason }) => {
      onFinish(reason);
      return 'Ready to generate answer.';
    },
  });
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Agent that iteratively reasons and acts until it has enough data.
 * 
 * Architecture:
 * 1. Agent Loop: Reason about query → Call tools → Observe summaries → Repeat
 * 2. Context Management: Tool outputs saved to disk, only summaries kept in context
 * 3. Answer Generation: Load relevant full data from disk, generate comprehensive answer
 */
export class Agent {
  private readonly callbacks: AgentCallbacks;
  private readonly model: string;
  private readonly maxIterations: number;
  private readonly toolContextManager: ToolContextManager;
  private readonly toolMap: Map<string, StructuredToolInterface>;

  constructor(options: AgentOptions) {
    this.callbacks = options.callbacks ?? {};
    this.model = options.model;
    this.maxIterations = options.maxIterations ?? 5;
    this.toolContextManager = new ToolContextManager('.dexter/context', this.model);
    this.toolMap = new Map(TOOLS.map(t => [t.name, t]));
  }

  /**
   * Main entry point - runs the agent loop on a user query.
   */
  async run(query: string, messageHistory?: MessageHistory): Promise<string> {
    const summaries: ToolSummary[] = [];
    const queryId = this.toolContextManager.hashQuery(query);
    let finishReason: string | null = null;

    // Create finish tool with callback to capture finish reason
    const finishTool = createFinishTool((reason) => {
      finishReason = reason;
    });

    // All tools available to the agent (including finish)
    const allTools = [...TOOLS, finishTool];

    // Build tool schemas for the system prompt
    const toolSchemas = this.buildToolSchemas();

    // Select relevant conversation history for context (done once at the start)
    let conversationContext: string | undefined;
    if (messageHistory && messageHistory.hasMessages()) {
      const relevantMessages = await messageHistory.selectRelevantMessages(query);
      if (relevantMessages.length > 0) {
        conversationContext = messageHistory.formatForPlanning(relevantMessages);
      }
    }

    // Main loop
    for (let i = 0; i < this.maxIterations; i++) {
      const iterationNum = i + 1;
      this.callbacks.onIterationStart?.(iterationNum);

      // Build the prompt for this iteration
      const systemPrompt = getSystemPrompt(toolSchemas);
      const userPrompt = buildUserPrompt(query, summaries, iterationNum, conversationContext);

      // Call LLM with tools bound
      const response = await callLlm(userPrompt, {
        systemPrompt,
        tools: allTools,
        model: this.model,
      }) as AIMessage;

      // Extract thinking from response content
      const thought = this.extractThought(response);
      if (thought) {
        this.callbacks.onThinking?.(thought);
      }

      // Check if agent called finish or has no more tool calls
      const toolCalls = response.tool_calls || [];
      
      // Check for finish tool call
      const finishCall = toolCalls.find(tc => tc.name === 'finish');
      if (finishCall) {
        // Execute finish to capture the reason
        await finishTool.invoke(finishCall.args);
        this.callbacks.onIterationComplete?.(iterationNum);
        break;
      }

      // If no tool calls, agent is done (implicit finish)
      if (toolCalls.length === 0) {
        this.callbacks.onIterationComplete?.(iterationNum);
        break;
      }

      // Filter out finish calls from tool calls to execute
      const dataToolCalls = toolCalls.filter(tc => tc.name !== 'finish');

      if (dataToolCalls.length > 0) {
        // Notify about tool calls starting
        const toolCallInfos: ToolCallInfo[] = dataToolCalls.map(tc => ({
          name: tc.name,
          args: tc.args as Record<string, unknown>,
        }));
        this.callbacks.onToolCallsStart?.(toolCallInfos);

        // Execute all tool calls in parallel
        const results = await Promise.all(
          dataToolCalls.map(async (toolCall) => {
            const toolName = toolCall.name;
            const args = toolCall.args as Record<string, unknown>;

            try {
              const tool = this.toolMap.get(toolName);
              if (!tool) {
                throw new Error(`Tool not found: ${toolName}`);
              }

              const result = await tool.invoke(args);

              // Save to disk and get summary
              const summary = this.toolContextManager.saveAndGetSummary(
                toolName,
                args,
                result,
                queryId
              );

              const callResult: ToolCallResult = {
                name: toolName,
                args,
                summary: summary.summary,
                success: true,
              };
              this.callbacks.onToolCallComplete?.(callResult);

              return summary;
            } catch (error) {
              const callResult: ToolCallResult = {
                name: toolName,
                args,
                summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
                success: false,
              };
              this.callbacks.onToolCallComplete?.(callResult);
              return null;
            }
          })
        );

        // Add successful summaries to context
        for (const summary of results) {
          if (summary) {
            summaries.push(summary);
          }
        }
      }

      this.callbacks.onIterationComplete?.(iterationNum);
    }

    // Generate answer from collected data
    return this.generateAnswer(query, queryId, messageHistory);
  }

  /**
   * Extracts the thinking/reasoning from the LLM response content.
   */
  private extractThought(response: AIMessage): string | null {
    const content = response.content;
    
    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }
    
    // Handle array content (some models return this)
    if (Array.isArray(content)) {
      const textParts = content
        .filter((part): part is { type: 'text'; text: string } => 
          typeof part === 'object' && part !== null && 'type' in part && part.type === 'text'
        )
        .map(part => part.text);
      
      if (textParts.length > 0) {
        return textParts.join('\n').trim();
      }
    }
    
    return null;
  }

  /**
   * Builds tool schemas string for the system prompt.
   */
  private buildToolSchemas(): string {
    return TOOLS.map((tool) => {
      const jsonSchema = tool.schema as Record<string, unknown>;
      const properties = (jsonSchema.properties as Record<string, unknown>) || {};
      const required = (jsonSchema.required as string[]) || [];
      
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
   * Generates the final answer by selecting and loading relevant contexts.
   */
  private async generateAnswer(
    query: string,
    queryId: string,
    messageHistory?: MessageHistory
  ): Promise<string> {
    this.callbacks.onAnswerStart?.();

    const pointers = this.toolContextManager.getPointersForQuery(queryId);

    // Build conversation context from message history
    let conversationContext = '';
    if (messageHistory && messageHistory.hasMessages()) {
      const relevantMessages = await messageHistory.selectRelevantMessages(query);
      if (relevantMessages.length > 0) {
        const formattedHistory = messageHistory.formatForAnswerGeneration(relevantMessages);
        conversationContext = `Previous conversation context (for reference):
${formattedHistory}

---

`;
      }
    }

    if (pointers.length === 0) {
      // No data collected - generate answer without tool data
      const stream = await this.generateNoDataAnswer(query, conversationContext);
      this.callbacks.onAnswerStream?.(stream);
      return '';
    }

    // Select relevant contexts using LLM
    const selectedFilepaths = await this.toolContextManager.selectRelevantContexts(query, pointers);
    
    // Load the full context data
    const selectedContexts = this.toolContextManager.loadContexts(selectedFilepaths);

    if (selectedContexts.length === 0) {
      const stream = await this.generateNoDataAnswer(query, conversationContext);
      this.callbacks.onAnswerStream?.(stream);
      return '';
    }

    // Format contexts for the prompt
    const formattedResults = selectedContexts.map(ctx => {
      const toolName = ctx.toolName || 'unknown';
      const args = ctx.args || {};
      const result = ctx.result;
      const sourceUrls = ctx.sourceUrls || [];
      const sourceLine = sourceUrls.length > 0 ? `\nSource URLs: ${sourceUrls.join(', ')}` : '';
      return `Output of ${toolName} with args ${JSON.stringify(args)}:${sourceLine}\n${JSON.stringify(result, null, 2)}`;
    });

    // Collect all available sources for reference
    const allSources = selectedContexts
      .filter(ctx => ctx.sourceUrls && ctx.sourceUrls.length > 0)
      .map(ctx => ({
        toolDescription: ctx.toolDescription || ctx.toolName,
        urls: ctx.sourceUrls!,
      }));

    const allResults = formattedResults.join('\n\n');

    const prompt = `${conversationContext}Original user query: "${query}"

Data and results collected from tools:
${allResults}

${allSources.length > 0 ? `Available sources for citation:\n${JSON.stringify(allSources, null, 2)}\n\n` : ''}Based on the data above, provide a comprehensive answer to the user's query.
Include specific numbers, calculations, and insights.`;

    const stream = callLlmStream(prompt, {
      systemPrompt: getAnswerSystemPrompt(),
      model: this.model,
    });

    this.callbacks.onAnswerStream?.(stream);
    return '';
  }

  /**
   * Generates a streaming answer when no data was collected.
   */
  private async generateNoDataAnswer(
    query: string,
    conversationContext: string = ''
  ): Promise<AsyncGenerator<string>> {
    const prompt = `${conversationContext}Original user query: "${query}"

No data was collected from tools. Answer the query using your general knowledge, or explain what information would be needed.`;

    return callLlmStream(prompt, {
      systemPrompt: getAnswerSystemPrompt(),
      model: this.model,
    });
  }
}
