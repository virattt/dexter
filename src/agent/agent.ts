import { AIMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { callLlm, getFastModel } from '../model/llm.js';
import { Scratchpad } from './scratchpad.js';
import { getTools } from '../tools/registry.js';
import { buildSystemPrompt, buildIterationPrompt, buildFinalAnswerPrompt, buildToolSummaryPrompt } from '../agent/prompts.js';
import { extractTextContent, hasToolCalls } from '../utils/ai-message.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { getToolDescription } from '../utils/tool-description.js';
import type { AgentConfig, AgentEvent, ToolStartEvent, ToolEndEvent, ToolErrorEvent } from '../agent/types.js';


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
   * Uses context compaction: summaries during loop, full data for final answer.
   */
  async *run(query: string, inMemoryHistory?: InMemoryChatHistory): AsyncGenerator<AgentEvent> {
    if (this.tools.length === 0) {
      yield { type: 'done', answer: 'No tools available. Please check your API key configuration.', toolCalls: [], iterations: 0 };
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

      const response = await this.callModel(currentPrompt) as AIMessage;
      const responseText = extractTextContent(response);

      // Emit thinking if there are also tool calls
      if (responseText && hasToolCalls(response)) {
        scratchpad.addThinking(responseText);
        yield { type: 'thinking', message: responseText };
      }

      // No tool calls = ready to generate final answer
      if (!hasToolCalls(response)) {
        // If no tools were called at all, just use the direct response
        // This handles greetings, clarifying questions, etc.
        if (!scratchpad.hasToolResults() && responseText) {
          yield { type: 'answer_start' };
          yield { type: 'done', answer: responseText, toolCalls: [], iterations: iteration };
          return;
        }

        // Generate final answer with full context from scratchpad
        const fullContext = this.buildFullContextForAnswer(scratchpad);
        const finalPrompt = buildFinalAnswerPrompt(query, fullContext);
        
        yield { type: 'answer_start' };
        const finalResponse = await this.callModel(finalPrompt, false);
        const answer = typeof finalResponse === 'string' 
          ? finalResponse 
          : extractTextContent(finalResponse);

        yield { type: 'done', answer, toolCalls: scratchpad.getToolCallRecords(), iterations: iteration };
        return;
      }

      // Execute tools and add results to scratchpad
      const generator = this.executeToolCalls(response, query, scratchpad);
      let result = await generator.next();

      // Yield tool events
      while (!result.done) {
        yield result.value;
        result = await generator.next();
      }
      
      // Build iteration prompt from scratchpad (always has full accumulated history)
      currentPrompt = buildIterationPrompt(query, scratchpad.getToolSummaries());
    }

    // Max iterations reached - still generate proper final answer
    const fullContext = this.buildFullContextForAnswer(scratchpad);
    const finalPrompt = buildFinalAnswerPrompt(query, fullContext);
    
    yield { type: 'answer_start' };
    const finalResponse = await this.callModel(finalPrompt, false);
    const answer = typeof finalResponse === 'string' 
      ? finalResponse 
      : extractTextContent(finalResponse);

    yield {
      type: 'done',
      answer: answer || `Reached maximum iterations (${this.maxIterations}).`,
      toolCalls: scratchpad.getToolCallRecords(),
      iterations: iteration
    };
  }

  /**
   * Call the LLM with the current prompt.
   * @param prompt - The prompt to send to the LLM
   * @param useTools - Whether to bind tools (default: true). When false, returns string directly.
   */
  private async callModel(prompt: string, useTools: boolean = true): Promise<AIMessage | string> {
    return await callLlm(prompt, {
      model: this.model,
      systemPrompt: this.systemPrompt,
      tools: useTools ? this.tools : undefined,
      signal: this.signal,
    }) as AIMessage | string;
  }

  /**
   * Generate an LLM summary of a tool result for context compaction.
   * The LLM summarizes what it learned, making the summary meaningful for subsequent iterations.
   * Uses a fast model variant for the current provider to improve speed.
   */
  private async summarizeToolResult(
    query: string,
    toolName: string,
    toolArgs: Record<string, unknown>,
    result: string
  ): Promise<string> {
    // If toolName is empty, return an empty string
    const prompt = buildToolSummaryPrompt(query, toolName, toolArgs, result);
    const summary = await callLlm(prompt, {
      model: getFastModel(this.modelProvider, this.model),
      systemPrompt: 'You are a concise data summarizer.',
      signal: this.signal,
    });
    return String(summary);
  }

  /**
   * Execute all tool calls from an LLM response and add results to scratchpad.
   * Deduplicates skill calls - each skill can only be executed once per query.
   */
  private async *executeToolCalls(
    response: AIMessage,
    query: string,
    scratchpad: Scratchpad
  ): AsyncGenerator<ToolStartEvent | ToolEndEvent | ToolErrorEvent, void> {
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
   */
  private async *executeToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
    query: string,
    scratchpad: Scratchpad
  ): AsyncGenerator<ToolStartEvent | ToolEndEvent | ToolErrorEvent, void> {
    yield { type: 'tool_start', tool: toolName, args: toolArgs };

    const startTime = Date.now();

    try {
      // Invoke tool directly from toolMap
      const tool = this.toolMap.get(toolName);
      if (!tool) {
        throw new Error(`Tool '${toolName}' not found`);
      }
      const rawResult = await tool.invoke(toolArgs, this.signal ? { signal: this.signal } : undefined);
      const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
      const duration = Date.now() - startTime;

      yield { type: 'tool_end', tool: toolName, args: toolArgs, result, duration };

      // Generate LLM summary for context compaction
      const llmSummary = await this.summarizeToolResult(query, toolName, toolArgs, result);

      // Add complete tool result to scratchpad (single source of truth)
      scratchpad.addToolResult(toolName, toolArgs, result, llmSummary);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yield { type: 'tool_error', tool: toolName, error: errorMessage };

      // Add error to scratchpad
      const toolDescription = getToolDescription(toolName, toolArgs);
      const errorSummary = `- ${toolDescription} [FAILED]: ${errorMessage}`;
      scratchpad.addToolResult(toolName, toolArgs, `Error: ${errorMessage}`, errorSummary);
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

  /**
   * Build full context data for final answer generation from scratchpad.
   */
  private buildFullContextForAnswer(scratchpad: Scratchpad): string {
    const contexts = scratchpad.getFullContexts();

    if (contexts.length === 0) {
      return 'No data was gathered.';
    }

    // Filter out error results and format contexts for the prompt
    const validContexts = contexts.filter(ctx => !ctx.result.startsWith('Error:'));

    if (validContexts.length === 0) {
      return 'No data was successfully gathered.';
    }

    return validContexts.map(ctx => {
      const description = getToolDescription(ctx.toolName, ctx.args);
      try {
        return `### ${description}\n\`\`\`json\n${JSON.stringify(JSON.parse(ctx.result), null, 2)}\n\`\`\``;
      } catch {
        // If result is not valid JSON, return as-is
        return `### ${description}\n${ctx.result}`;
      }
    }).join('\n\n');
  }
}
