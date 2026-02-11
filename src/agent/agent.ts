import { AIMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { callLlm } from '../model/llm.js';
import { Scratchpad, type ToolContext } from './scratchpad.js';
import { getTools } from '../tools/registry.js';
import { buildSystemPrompt, buildIterationPrompt, buildFinalAnswerPrompt } from '../agent/prompts.js';
import { extractTextContent, hasToolCalls } from '../utils/ai-message.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { estimateTokens, CONTEXT_THRESHOLD, KEEP_TOOL_USES } from '../utils/tokens.js';
import { createProgressChannel } from '../utils/progress-channel.js';
import type { AgentConfig, AgentEvent, ToolStartEvent, ToolProgressEvent, ToolEndEvent, ToolErrorEvent, ToolLimitEvent, ContextClearedEvent, PermissionRequestEvent, TokenUsage } from '../agent/types.js';
import { TokenCounter } from './token-counter.js';
import { createRunContext, type RunContext } from './run-context.js';
import { buildFinalAnswerContext } from './final-answer-context.js';
import { AgentToolExecutor } from './tool-executor.js';


const DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_MAX_ITERATIONS = 10;

/**
 * The core agent class that handles the agent loop and tool execution.
 */
export class Agent {
  private readonly model: string;
  private readonly maxIterations: number;
  private readonly tools: StructuredToolInterface[];
  private readonly toolMap: Map<string, StructuredToolInterface>;
  private readonly toolExecutor: AgentToolExecutor;
  private readonly systemPrompt: string;
  private readonly signal?: AbortSignal;
  private readonly onPermissionRequest?: (path: string, operation: 'read' | 'write') => Promise<boolean>;

  private constructor(
    config: AgentConfig,
    tools: StructuredToolInterface[],
    systemPrompt: string
  ) {
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.tools = tools;
    this.toolMap = new Map(tools.map(t => [t.name, t]));
    this.toolExecutor = new AgentToolExecutor(this.toolMap, config.signal, config.onPermissionRequest);
    this.systemPrompt = systemPrompt;
    this.signal = config.signal;
    this.onPermissionRequest = config.onPermissionRequest;
  }

  /**
   * Create a new Agent instance with tools.
   */
  static create(config: AgentConfig = {}): Agent {
    const model = config.model ?? DEFAULT_MODEL;
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

    if (this.tools.length === 0) {
      yield { type: 'done', answer: 'No tools available. Please check your API key configuration.', toolCalls: [], iterations: 0, totalTime: Date.now() - startTime };
      return;
    }

    // Create scratchpad for this query - single source of truth for all work done
    const scratchpad = new Scratchpad(query);

    const ctx = createRunContext(query);

    // Build initial prompt with conversation history context
    let currentPrompt = this.buildInitialPrompt(query, inMemoryHistory);

    // Main agent loop
    while (ctx.iteration < this.maxIterations) {
      ctx.iteration++;

      const { response, usage } = await this.callModel(currentPrompt);
      ctx.tokenCounter.add(usage);
      const responseText = typeof response === 'string' ? response : extractTextContent(response);

      // Emit thinking if there are also tool calls (skip whitespace-only responses)
      if (responseText?.trim() && typeof response !== 'string' && hasToolCalls(response)) {
        const trimmedText = responseText.trim();
        ctx.scratchpad.addThinking(trimmedText);
        yield { type: 'thinking', message: trimmedText };
      }

      // No tool calls = ready to generate final answer
      if (typeof response === 'string' || !hasToolCalls(response)) {
        // If no tools were called at all, just use the direct response
        // This handles greetings, clarifying questions, etc.
        if (!ctx.scratchpad.hasToolResults() && responseText) {
          yield* this.handleDirectResponse(responseText, ctx);
          return;
        }

        // Generate final answer with full context from scratchpad
        yield* this.generateFinalAnswer(ctx);
        return;
      }

      // Execute tools and add results to scratchpad (response is AIMessage here)
      yield* this.toolExecutor.executeAll(response, ctx);
      yield* this.manageContextThreshold(ctx);

      // Build iteration prompt with full tool results (Anthropic-style)
      currentPrompt = buildIterationPrompt(
        query, 
        ctx.scratchpad.getToolResults(),
        ctx.scratchpad.formatToolUsageForPrompt()
      );
    }

    // Max iterations reached - still generate proper final answer
    yield* this.generateFinalAnswer(ctx, {
      fallbackMessage: `Reached maximum iterations (${this.maxIterations}).`,
    });
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
  ): AsyncGenerator<ToolStartEvent | ToolProgressEvent | ToolEndEvent | ToolErrorEvent | ToolLimitEvent | PermissionRequestEvent, void> {
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
  ): AsyncGenerator<ToolStartEvent | ToolProgressEvent | ToolEndEvent | ToolErrorEvent | ToolLimitEvent | PermissionRequestEvent, void> {
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
        metadata: { 
          onProgress: channel.emit,
          onPermissionRequest: this.onPermissionRequest,
        },
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
   * Generate final answer with full scratchpad context.
   */

  private async *handleDirectResponse(
    responseText: string,
    ctx: RunContext
  ): AsyncGenerator<AgentEvent, void> {
    yield { type: 'answer_start' };
    const totalTime = Date.now() - ctx.startTime;
    yield {
      type: 'done',
      answer: responseText,
      toolCalls: [],
      iterations: ctx.iteration,
      totalTime,
      tokenUsage: ctx.tokenCounter.getUsage(),
      tokensPerSecond: ctx.tokenCounter.getTokensPerSecond(totalTime),
    };
  }

  /**
   * Generate final answer with full scratchpad context.
   */
  private async *generateFinalAnswer(
    ctx: RunContext,
    options?: { fallbackMessage?: string }
  ): AsyncGenerator<AgentEvent, void> {
    const fullContext = buildFinalAnswerContext(ctx.scratchpad);
    const finalPrompt = buildFinalAnswerPrompt(ctx.query, fullContext);

    yield { type: 'answer_start' };
    const { response, usage } = await this.callModel(finalPrompt, false);
    ctx.tokenCounter.add(usage);
    const answer = typeof response === 'string'
      ? response
      : extractTextContent(response);

    const totalTime = Date.now() - ctx.startTime;
    yield {
      type: 'done',
      answer: options?.fallbackMessage ? answer || options.fallbackMessage : answer,
      toolCalls: ctx.scratchpad.getToolCallRecords(),
      iterations: ctx.iteration,
      totalTime,
      tokenUsage: ctx.tokenCounter.getUsage(),
      tokensPerSecond: ctx.tokenCounter.getTokensPerSecond(totalTime),
    };
  }

  /**
   * Clear oldest tool results if context size exceeds threshold.
   */
  private *manageContextThreshold(ctx: RunContext): Generator<ContextClearedEvent, void> {
    const fullToolResults = ctx.scratchpad.getToolResults();
    const estimatedContextTokens = estimateTokens(this.systemPrompt + ctx.query + fullToolResults);

    if (estimatedContextTokens > CONTEXT_THRESHOLD) {
      const clearedCount = ctx.scratchpad.clearOldestToolResults(KEEP_TOOL_USES);
      if (clearedCount > 0) {
        yield { type: 'context_cleared', clearedCount, keptCount: KEEP_TOOL_USES };
      }
    }
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

}
