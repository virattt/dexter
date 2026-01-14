import { AIMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { callLlm, getFastModel } from '../model/llm.js';
import { ContextManager } from './context.js';
import { Scratchpad } from './scratchpad.js';
import { loadSkills, getToolsFromSkills, buildSkillsPromptSection, executeTool } from './skill-loader.js';
import { buildSystemPrompt, buildIterationPrompt, getFinalAnswerSystemPrompt, buildFinalAnswerPrompt, buildToolSummaryPrompt } from './prompts.js';
import { extractTextContent, hasToolCalls } from './utils/ai-message.js';
import { streamLlmResponse } from './utils/llm.js';
import { MessageHistory } from '../utils/message-history.js';
import type { AgentConfig, AgentEvent, ToolStartEvent, ToolEndEvent, ToolErrorEvent, ToolSummary, AnswerStartEvent, AnswerChunkEvent } from './types.js';
import { logger } from '../utils/logger.js';


const DEFAULT_MAX_ITERATIONS = 10;

interface ToolCallRecord {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

interface ToolExecutionResult {
  record: ToolCallRecord;
  summary: ToolSummary;
  promptEntry: string;
}

interface ToolCallsExecutionResult {
  records: ToolCallRecord[];
  summaries: ToolSummary[];
  promptEntries: string[];
}

/**
 * Agent - A simple ReAct-style agent that uses skills/tools to answer queries.
 *
 * Architecture:
 * 1. Load skills and build system prompt (via factory method)
 * 2. Agent loop: Call LLM -> Execute tools -> Repeat until done
 * 3. Yield events for real-time UI updates
 *
 * Usage:
 *   const agent = await Agent.create({ model: 'gpt-5.2' });
 *   for await (const event of agent.run(query)) { ... }
 */
export class Agent {
  private readonly model: string;
  private readonly modelProvider: string;
  private readonly maxIterations: number;
  private readonly contextManager: ContextManager;
  private readonly tools: StructuredToolInterface[];
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
    this.contextManager = new ContextManager();
    this.tools = tools;
    this.systemPrompt = systemPrompt;
    this.signal = config.signal;
  }

  /**
   * Create a new Agent instance with loaded skills and tools.
   */
  static async create(config: AgentConfig = {}): Promise<Agent> {
    const skills = await loadSkills();
    const tools = getToolsFromSkills(skills);
    const skillsSection = buildSkillsPromptSection(skills);
    const systemPrompt = buildSystemPrompt(skillsSection);
    return new Agent(config, tools, systemPrompt);
  }

  /**
   * Run the agent and yield events for real-time UI updates.
   * Uses context compaction: summaries during loop, full data for final answer.
   */
  async *run(query: string, messageHistory?: MessageHistory): AsyncGenerator<AgentEvent> {
    if (this.tools.length === 0) {
      yield { type: 'done', answer: 'No tools available. Please check your skills configuration.', toolCalls: [], iterations: 0 };
      return;
    }

    const allToolCalls: ToolCallRecord[] = [];
    const allSummaries: ToolSummary[] = [];
    
    // Create scratchpad for this query (append-only log of work done)
    const scratchpad = new Scratchpad(query);
    
    // Build initial prompt with conversation history context
    let currentPrompt = this.buildInitialPrompt(query, messageHistory);
    
    let iteration = 0;

    // Main agent loop
    while (iteration < this.maxIterations) {
      iteration++;

      const response = await this.callModel(currentPrompt);
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
        if (allSummaries.length === 0 && responseText) {
          yield { type: 'answer_start' };
          yield { type: 'answer_chunk', text: responseText };
          yield { type: 'done', answer: responseText, toolCalls: [], iterations: iteration };
          return;
        }

        // Stream final answer with full context
        const answerGenerator = this.generateFinalAnswer(query, allSummaries);
        let fullAnswer = '';
        
        for await (const event of answerGenerator) {
          yield event;
          if (event.type === 'answer_chunk') {
            fullAnswer += event.text;
          }
        }
        
        yield { type: 'done', answer: fullAnswer, toolCalls: allToolCalls, iterations: iteration };
        return;
      }

      // Execute tools and collect results
      const generator = this.executeToolCalls(response, query);
      let result = await generator.next();

      // Execute tool calls and yield events
      while (!result.done) {
        yield result.value;
        result = await generator.next();
      }

      // Add tool entries to scratchpad and collect summaries
      for (const entry of result.value.promptEntries) {
        scratchpad.addToolEntry(entry);
      }
      allToolCalls.push(...result.value.records);
      allSummaries.push(...result.value.summaries);
      
      // Build iteration prompt from scratchpad (always has full accumulated history)
      currentPrompt = buildIterationPrompt(query, scratchpad.getToolSummaries());
    }

    // Max iterations reached - still generate proper final answer
    const answerGenerator = this.generateFinalAnswer(query, allSummaries);
    let fullAnswer = '';
    
    for await (const event of answerGenerator) {
      yield event;
      if (event.type === 'answer_chunk') {
        fullAnswer += event.text;
      }
    }
    
    yield {
      type: 'done',
      answer: fullAnswer || `Reached maximum iterations (${this.maxIterations}). ${this.contextManager.getSummary()}`,
      toolCalls: allToolCalls,
      iterations: iteration
    };
  }

  /**
   * Call the LLM with the current prompt
   */
  private async callModel(prompt: string): Promise<AIMessage> {
    return await callLlm(prompt, {
      model: this.model,
      systemPrompt: this.systemPrompt,
      tools: this.tools,
      signal: this.signal,
    }) as AIMessage;
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
   * Execute all tool calls from an LLM response
   */
  private async *executeToolCalls(
    response: AIMessage,
    query: string
  ): AsyncGenerator<ToolStartEvent | ToolEndEvent | ToolErrorEvent, ToolCallsExecutionResult> {
    const records: ToolCallRecord[] = [];
    const summaries: ToolSummary[] = [];
    const promptEntries: string[] = [];

    for (const toolCall of response.tool_calls!) {
      const toolName = toolCall.name;
      const toolArgs = toolCall.args as Record<string, unknown>;

      const generator = this.executeToolCall(toolName, toolArgs, query);
      let result = await generator.next();

      while (!result.done) {
        yield result.value;
        result = await generator.next();
      }

      records.push(result.value.record);
      summaries.push(result.value.summary);
      promptEntries.push(result.value.promptEntry);
    }

    return { records, summaries, promptEntries };
  }

  /**
   * Execute a single tool call and yield start/end/error events.
   * Returns an LLM-generated summary for context compaction.
   */
  private async *executeToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
    query: string
  ): AsyncGenerator<ToolStartEvent | ToolEndEvent | ToolErrorEvent, ToolExecutionResult> {
    yield { type: 'tool_start', tool: toolName, args: toolArgs };

    const startTime = Date.now();

    try {
      const result = await executeTool(toolName, toolArgs, this.signal);
      const duration = Date.now() - startTime;

      // Save full result to disk and get lightweight summary
      const summary = this.contextManager.saveAndGetSummary(toolName, toolArgs, result);

      yield { type: 'tool_end', tool: toolName, args: toolArgs, result, duration };

      // Generate LLM summary for context compaction
      const llmSummary = await this.summarizeToolResult(query, toolName, toolArgs, result);

      return {
        record: { tool: toolName, args: toolArgs, result },
        summary,
        // Use LLM-generated summary for better context understanding
        promptEntry: llmSummary,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yield { type: 'tool_error', tool: toolName, error: errorMessage };

      // Create error summary
      const errorSummary: ToolSummary = {
        id: '',
        toolName,
        args: toolArgs,
        summary: `${this.contextManager.getToolDescription(toolName, toolArgs)} [FAILED]`,
      };

      return {
        record: { tool: toolName, args: toolArgs, result: `Error: ${errorMessage}` },
        summary: errorSummary,
        promptEntry: `- ${errorSummary.summary}: ${errorMessage}`,
      };
    }
  }

  /**
   * Build initial prompt with conversation history context if available
   */
  private buildInitialPrompt(
    query: string,
    messageHistory?: MessageHistory
  ): string {
    if (!messageHistory?.hasMessages()) {
      return query;
    }

    const userMessages = messageHistory.getUserMessages();
    if (userMessages.length === 0) {
      return query;
    }

    const historyContext = userMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n');
    return `Current query to answer: ${query}\n\nPrevious user queries for context:\n${historyContext}`;
  }

  /**
   * Generate the final answer by loading full context data and streaming the response.
   * This is the final step after context compaction - we load all data from disk.
   */
  private async *generateFinalAnswer(
    query: string,
    summaries: ToolSummary[]
  ): AsyncGenerator<AnswerStartEvent | AnswerChunkEvent> {
    yield { type: 'answer_start' };

    // Load full context data from disk
    const fullContext = this.buildFullContextForAnswer(summaries);

    // Build the final answer prompt
    const prompt = buildFinalAnswerPrompt(query, fullContext);
    const systemPrompt = getFinalAnswerSystemPrompt();

    // Stream the final answer using V2's provider-agnostic streaming
    const stream = streamLlmResponse(prompt, {
      model: this.model,
      systemPrompt,
    });

    for await (const chunk of stream) {
      yield { type: 'answer_chunk', text: chunk };
    }
  }

  /**
   * Build full context data for final answer generation.
   * Loads full tool results from disk using the summaries' file pointers.
   */
  private buildFullContextForAnswer(summaries: ToolSummary[]): string {
    if (summaries.length === 0) {
      return 'No data was gathered.';
    }

    // Get filepaths from summaries (filter out error summaries with empty ids)
    const filepaths = summaries
      .map(s => s.id)
      .filter(id => id.length > 0);

    if (filepaths.length === 0) {
      return 'No data was successfully gathered.';
    }

    // Load full contexts from disk
    const contexts = this.contextManager.loadFullContexts(filepaths);

    if (contexts.length === 0) {
      return 'Failed to load context data.';
    }

    // Format contexts for the prompt
    return contexts.map(ctx => {
      const description = this.contextManager.getToolDescription(ctx.toolName, ctx.args);
      return `### ${description}\n\`\`\`json\n${JSON.stringify(JSON.parse(ctx.result), null, 2)}\n\`\`\``;
    }).join('\n\n');
  }
}
