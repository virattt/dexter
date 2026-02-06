import { AIMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { callLlm } from '../model/llm.js';
import { Scratchpad, type ToolContext } from './scratchpad.js';
import { getTools } from '../tools/registry.js';
import { buildSystemPrompt, buildIterationPrompt, buildFinalAnswerPrompt } from '../agent/prompts.js';
import { extractTextContent, hasToolCalls } from '../utils/ai-message.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { getToolDescription } from '../utils/tool-description.js';
import { estimateTokens, CONTEXT_THRESHOLD, KEEP_TOOL_USES } from '../utils/tokens.js';
import { createProgressChannel } from '../utils/progress-channel.js';
import type { AgentConfig, AgentEvent, ToolStartEvent, ToolProgressEvent, ToolEndEvent, ToolErrorEvent, ToolLimitEvent, ContextClearedEvent, TokenUsage } from '../agent/types.js';
import { TokenCounter } from './token-counter.js';


const DEFAULT_MAX_ITERATIONS = 10;

/**
 * The core agent class that handles the agent loop and tool execution.
 */
export class Agent {
  private readonly model: string;
  private readonly modelProvider: string;
  private readonly maxIterations: number;
  private readonly tools: StructuredToolInterface[];
  private readonly toolMap: Map<string, StructuredToolInterface>;
  private readonly systemPrompt: string;
  private readonly signal?: AbortSignal;

  private constructor(
    config: AgentConfig,
    tools: StructuredToolInterface[],
    systemPrompt: string
  ) {
    this.model = config.model ?? 'gpt-5.2';
    this.modelProvider = config.modelProvider ?? 'openai';
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.tools = tools;
    this.toolMap = new Map(tools.map(t => [t.name, t]));
    this.systemPrompt = systemPrompt;
    this.signal = config.signal;
  }

  /**
   * Create a new Agent instance with tools.
   */
  static create(config: AgentConfig = {}): Agent {
    const model = config.model ?? 'gpt-5.2';
    const tools = getTools(model);
    const systemPrompt = buildSystemPrompt(model);
    return new Agent(config, tools, systemPrompt);
  }

  /**
   * Run the agent and yield events for real-time UI updates.
   * Anthropic-style context management: full tool results during iteration,
   * with threshold-based clearing of oldest results when context exceeds limit.
   */
  async *run(query: string, inMemoryHistory?: InMemoryChatHistory): AsyncGenerator<AgentEvent> {
    const startTime = Date.now();
    const tokenCounter = new TokenCounter();
    
    if (this.tools.length === 0) {
      yield { type: 'done', answer: 'No tools available. Please check your API key configuration.', toolCalls: [], iterations: 0, totalTime: Date.now() - startTime };
      return;
    }

    // Create scratchpad for this query - single source of truth for all work done
    const scratchpad = new Scratchpad(query);
    
    // Build initial prompt with conversation history context
    let currentPrompt = this.buildInitialPrompt(query, inMemoryHistory);
    
    let iteration = 0;

    // Main agent loop
    while (iteration < this.maxIterations) {
      iteration++;

      const { response, usage } = await this.callModel(currentPrompt);
      tokenCounter.add(usage);
      const responseText = typeof response === 'string' ? response : extractTextContent(response);

      // Emit thinking if there are also tool calls (skip whitespace-only responses)
      if (responseText?.trim() && typeof response !== 'string' && hasToolCalls(response)) {
        const trimmedText = responseText.trim();
        scratchpad.addThinking(trimmedText);
        yield { type: 'thinking', message: trimmedText };
      }

      // No tool calls = ready to generate final answer
      if (typeof response === 'string' || !hasToolCalls(response)) {
        // If no tools were called at all, just use the direct response
        // This handles greetings, clarifying questions, etc.
        if (!scratchpad.hasToolResults() && responseText) {
          yield { type: 'answer_start' };
          const totalTime = Date.now() - startTime;
          yield { type: 'done', answer: responseText, toolCalls: [], iterations: iteration, totalTime, tokenUsage: tokenCounter.getUsage(), tokensPerSecond: tokenCounter.getTokensPerSecond(totalTime) };
          return;
        }

        // Generate final answer with full context from scratchpad
        const fullContext = this.buildFullContextForAnswer(query, scratchpad);
        const finalPrompt = buildFinalAnswerPrompt(query, fullContext);
        
        yield { type: 'answer_start' };
        const { response: finalResponse, usage: finalUsage } = await this.callModel(finalPrompt, false);
        tokenCounter.add(finalUsage);
        const answer = typeof finalResponse === 'string' 
          ? finalResponse 
          : extractTextContent(finalResponse);

        const totalTime = Date.now() - startTime;
        yield { type: 'done', answer, toolCalls: scratchpad.getToolCallRecords(), iterations: iteration, totalTime, tokenUsage: tokenCounter.getUsage(), tokensPerSecond: tokenCounter.getTokensPerSecond(totalTime) };
        return;
      }

      // Execute tools and add results to scratchpad (response is AIMessage here)
      const generator = this.executeToolCalls(response, query, scratchpad);
      let result = await generator.next();

      // Yield tool events
      while (!result.done) {
        yield result.value;
        result = await generator.next();
      }
      
      // Anthropic-style context management: get full tool results
      let fullToolResults = scratchpad.getToolResults();
      
      // Check context threshold and clear oldest tool results if needed
      const estimatedContextTokens = estimateTokens(this.systemPrompt + query + fullToolResults);
      if (estimatedContextTokens > CONTEXT_THRESHOLD) {
        const clearedCount = scratchpad.clearOldestToolResults(KEEP_TOOL_USES);
        if (clearedCount > 0) {
          yield { type: 'context_cleared', clearedCount, keptCount: KEEP_TOOL_USES } as ContextClearedEvent;
          // Re-fetch after clearing
          fullToolResults = scratchpad.getToolResults();
        }
      }
      
      // Build iteration prompt with full tool results (Anthropic-style)
      currentPrompt = buildIterationPrompt(
        query, 
        fullToolResults,
        scratchpad.formatToolUsageForPrompt()
      );
    }

    // Max iterations reached - still generate proper final answer
    const fullContext = this.buildFullContextForAnswer(query, scratchpad);
    const finalPrompt = buildFinalAnswerPrompt(query, fullContext);
    
    yield { type: 'answer_start' };
    const { response: finalResponse, usage: finalUsage } = await this.callModel(finalPrompt, false);
    tokenCounter.add(finalUsage);
    const answer = typeof finalResponse === 'string' 
      ? finalResponse 
      : extractTextContent(finalResponse);

    const totalTime = Date.now() - startTime;
    yield {
      type: 'done',
      answer: answer || `Reached maximum iterations (${this.maxIterations}).`,
      toolCalls: scratchpad.getToolCallRecords(),
      iterations: iteration,
      totalTime,
      tokenUsage: tokenCounter.getUsage(),
      tokensPerSecond: tokenCounter.getTokensPerSecond(totalTime)
    };
  }

  /**
   * Call the LLM with the current prompt.
   * @param prompt - The prompt to send to the LLM
   * @param useTools - Whether to bind tools (default: true). When false, returns string directly.
   */
  private async callModel(prompt: string, useTools: boolean = true): Promise<{ response: AIMessage | string; usage?: TokenUsage }> {
    const result = await callLlm(prompt, {
      model: this.model,
      systemPrompt: this.systemPrompt,
      tools: useTools ? this.tools : undefined,
      signal: this.signal,
    });
    return { response: result.response, usage: result.usage };
  }

  /**
   * Execute all tool calls from an LLM response and add results to scratchpad.
   * Deduplicates skill calls - each skill can only be executed once per query.
   * Includes graceful exit mechanism - checks tool limits before executing.
   */
  private async *executeToolCalls(
    response: AIMessage,
    query: string,
    scratchpad: Scratchpad
  ): AsyncGenerator<ToolStartEvent | ToolProgressEvent | ToolEndEvent | ToolErrorEvent | ToolLimitEvent, void> {
    for (const toolCall of response.tool_calls!) {
      const toolName = toolCall.name;
      const toolArgs = toolCall.args as Record<string, unknown>;

      // Deduplicate skill calls - each skill can only run once per query
      if (toolName === 'skill') {
        const skillName = toolArgs.skill as string;
        if (scratchpad.hasExecutedSkill(skillName)) continue;
      }

      const generator = this.executeToolCall(toolName, toolArgs, query, scratchpad);
      let result = await generator.next();

      while (!result.done) {
        yield result.value;
        result = await generator.next();
      }
    }
  }

  /**
   * Execute a single tool call and add result to scratchpad.
   * Yields start/end/error events for UI updates.
   * Includes soft limit warnings to guide the LLM.
   */
  private async *executeToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
    query: string,
    scratchpad: Scratchpad
  ): AsyncGenerator<ToolStartEvent | ToolProgressEvent | ToolEndEvent | ToolErrorEvent | ToolLimitEvent, void> {
    // Extract query string from tool args for similarity detection
    const toolQuery = this.extractQueryFromArgs(toolArgs);

    // Check tool limits - yields warning if approaching/over limits
    const limitCheck = scratchpad.canCallTool(toolName, toolQuery);
    
    if (limitCheck.warning) {
      yield { 
        type: 'tool_limit', 
        tool: toolName, 
        warning: limitCheck.warning, 
        blocked: false 
      };
    }

    yield { type: 'tool_start', tool: toolName, args: toolArgs };

    const toolStartTime = Date.now();

    try {
      const tool = this.toolMap.get(toolName);
      if (!tool) {
        throw new Error(`Tool '${toolName}' not found`);
      }

      // Create a progress channel so subagent tools can stream status updates
      const channel = createProgressChannel();
      const config = {
        metadata: { onProgress: channel.emit },
        ...(this.signal ? { signal: this.signal } : {}),
      };

      // Launch tool invocation -- closes the channel when it settles
      const toolPromise = tool.invoke(toolArgs, config).then(
        (raw) => { channel.close(); return raw; },
        (err) => { channel.close(); throw err; },
      );

      // Drain progress events in real-time as the tool executes
      for await (const message of channel) {
        yield { type: 'tool_progress', tool: toolName, message } as ToolProgressEvent;
      }

      // Tool has finished -- collect the result
      const rawResult = await toolPromise;
      const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
      const duration = Date.now() - toolStartTime;

      yield { type: 'tool_end', tool: toolName, args: toolArgs, result, duration };

      // Record the tool call for limit tracking
      scratchpad.recordToolCall(toolName, toolQuery);

      // Add full tool result to scratchpad (Anthropic-style: no inline summarization)
      scratchpad.addToolResult(toolName, toolArgs, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yield { type: 'tool_error', tool: toolName, error: errorMessage };

      // Still record the call even on error (counts toward limit)
      scratchpad.recordToolCall(toolName, toolQuery);

      // Add error to scratchpad
      scratchpad.addToolResult(toolName, toolArgs, `Error: ${errorMessage}`);
    }
  }

  /**
   * Extract query string from tool arguments for similarity detection.
   * Looks for common query-like argument names.
   */
  private extractQueryFromArgs(args: Record<string, unknown>): string | undefined {
    const queryKeys = ['query', 'search', 'question', 'q', 'text', 'input'];
    
    for (const key of queryKeys) {
      if (typeof args[key] === 'string') {
        return args[key] as string;
      }
    }
    
    return undefined;
  }

  /**
   * Build initial prompt with conversation history context if available
   */
  private buildInitialPrompt(
    query: string,
    inMemoryChatHistory?: InMemoryChatHistory
  ): string {
    if (!inMemoryChatHistory?.hasMessages()) {
      return query;
    }

    const userMessages = inMemoryChatHistory.getUserMessages();
    if (userMessages.length === 0) {
      return query;
    }

    const historyContext = userMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n');
    return `Current query to answer: ${query}\n\nPrevious user queries for context:\n${historyContext}`;
  }

  /**
   * Build full context data for final answer generation from scratchpad.
   * Anthropic-style: uses all full tool results (cleared entries were already
   * handled during iteration, final answer gets comprehensive context).
   */
  private buildFullContextForAnswer(_query: string, scratchpad: Scratchpad): string {
    const contexts = scratchpad.getFullContexts();

    if (contexts.length === 0) {
      return 'No data was gathered.';
    }

    // Filter out error results
    const validContexts = contexts.filter(ctx => !ctx.result.startsWith('Error:'));

    if (validContexts.length === 0) {
      return 'No data was successfully gathered.';
    }

    // Format all contexts with full data
    return validContexts.map(ctx => this.formatToolContext(ctx)).join('\n\n');
  }

  /**
   * Format a single tool context entry for the final answer.
   */
  private formatToolContext(ctx: ToolContext): string {
    const description = getToolDescription(ctx.toolName, ctx.args);
    try {
      return `### ${description}\n\`\`\`json\n${JSON.stringify(JSON.parse(ctx.result), null, 2)}\n\`\`\``;
    } catch {
      // If result is not valid JSON, return as-is
      return `### ${description}\n${ctx.result}`;
    }
  }
}
