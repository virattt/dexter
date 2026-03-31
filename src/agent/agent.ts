import { AIMessage, SystemMessage, HumanMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { callLlmWithMessages } from '../model/llm.js';
import { getTools } from '../tools/registry.js';
import { buildSystemPrompt, loadSoulDocument } from './prompts.js';
import { extractTextContent, hasToolCalls } from '../utils/ai-message.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { estimateTokens, estimateContextTokens, getAutoCompactThreshold, KEEP_TOOL_USES } from '../utils/tokens.js';
import { formatUserFacingError, isContextOverflowError } from '../utils/errors.js';
import type { AgentConfig, AgentEvent, CompactionEvent, ContextClearedEvent, TokenUsage } from '../agent/types.js';
import { compactContext, MAX_CONSECUTIVE_COMPACTION_FAILURES, MIN_TOOL_RESULTS_FOR_COMPACTION } from './compact.js';
import { createRunContext, type RunContext } from './run-context.js';
import { AgentToolExecutor } from './tool-executor.js';
import { MemoryManager } from '../memory/index.js';
import { runMemoryFlush, shouldRunMemoryFlush } from '../memory/flush.js';
import { resolveProvider } from '../providers.js';


const DEFAULT_MODEL = 'gpt-5.4';
const DEFAULT_MAX_ITERATIONS = 10;
const MAX_OVERFLOW_RETRIES = 2;
const OVERFLOW_KEEP_ROUNDS = 3;

/**
 * The core agent class that handles the agent loop and tool execution.
 *
 * Uses a Claudia-style growing message array: each iteration appends the
 * model's AIMessage and corresponding ToolMessages, giving the LLM full
 * continuity of reasoning across tool-calling iterations.
 */
export class Agent {
  private readonly model: string;
  private readonly maxIterations: number;
  private readonly tools: StructuredToolInterface[];
  private readonly toolMap: Map<string, StructuredToolInterface>;
  private readonly toolExecutor: AgentToolExecutor;
  private readonly systemPrompt: string;
  private readonly signal?: AbortSignal;
  private readonly memoryEnabled: boolean;
  private compactionFailures: number = 0;

  private constructor(
    config: AgentConfig,
    tools: StructuredToolInterface[],
    systemPrompt: string,
  ) {
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.tools = tools;
    this.toolMap = new Map(tools.map(t => [t.name, t]));
    this.toolExecutor = new AgentToolExecutor(this.toolMap, config.signal, config.requestToolApproval, config.sessionApprovedTools);
    this.systemPrompt = systemPrompt;
    this.signal = config.signal;
    this.memoryEnabled = config.memoryEnabled ?? true;
  }

  /**
   * Create a new Agent instance with tools.
   */
  static async create(config: AgentConfig = {}): Promise<Agent> {
    const model = config.model ?? DEFAULT_MODEL;
    const tools = getTools(model);
    const soulContent = await loadSoulDocument();
    let memoryFiles: string[] = [];
    let memoryContext: string | null = null;

    if (config.memoryEnabled !== false) {
      const memoryManager = await MemoryManager.get();
      memoryFiles = await memoryManager.listFiles();
      const session = await memoryManager.loadSessionContext();
      if (session.text.trim()) {
        memoryContext = session.text;
      }
    }

    const systemPrompt = buildSystemPrompt(
      model,
      soulContent,
      config.channel,
      config.groupContext,
      memoryFiles,
      memoryContext,
    );
    return new Agent(config, tools, systemPrompt);
  }

  /**
   * Run the agent and yield events for real-time UI updates.
   *
   * Claudia-style message array: conversation history (including model reasoning
   * and tool results) persists as structured messages across iterations, giving
   * the LLM full continuity of thought.
   */
  async *run(query: string, inMemoryHistory?: InMemoryChatHistory): AsyncGenerator<AgentEvent> {
    const startTime = Date.now();

    if (this.tools.length === 0) {
      yield { type: 'done', answer: 'No tools available. Please check your API key configuration.', toolCalls: [], iterations: 0, totalTime: Date.now() - startTime };
      return;
    }

    const ctx = createRunContext(query);
    const memoryFlushState = { alreadyFlushed: false };

    // Build initial message array: System + optional history + user query
    const historyMessages = inMemoryHistory?.getRecentTurnsAsMessages() ?? [];
    const messages: BaseMessage[] = [
      new SystemMessage(this.systemPrompt),
      ...historyMessages,
      new HumanMessage(query),
    ];

    // Main agent loop
    let overflowRetries = 0;
    while (ctx.iteration < this.maxIterations) {
      ctx.iteration++;

      let response: AIMessage;
      let usage: TokenUsage | undefined;

      // Call LLM with retry on context overflow
      while (true) {
        try {
          const result = await this.callModelWithMessages(messages);
          response = result.response;
          usage = result.usage;
          overflowRetries = 0;
          break;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          if (isContextOverflowError(errorMessage) && overflowRetries < MAX_OVERFLOW_RETRIES) {
            overflowRetries++;
            const removed = this.truncateMessages(messages, OVERFLOW_KEEP_ROUNDS);
            if (removed > 0) {
              yield { type: 'context_cleared', clearedCount: removed, keptCount: OVERFLOW_KEEP_ROUNDS };
              continue;
            }
          }

          const totalTime = Date.now() - ctx.startTime;
          const provider = resolveProvider(this.model).displayName;
          yield {
            type: 'done',
            answer: `Error: ${formatUserFacingError(errorMessage, provider)}`,
            toolCalls: ctx.scratchpad.getToolCallRecords(),
            iterations: ctx.iteration,
            totalTime,
            tokenUsage: ctx.tokenCounter.getUsage(),
            tokensPerSecond: ctx.tokenCounter.getTokensPerSecond(totalTime),
          };
          return;
        }
      }

      ctx.tokenCounter.add(usage);
      if (usage?.inputTokens) {
        ctx.lastApiInputTokens = usage.inputTokens;
      }

      const responseText = extractTextContent(response);

      // Emit thinking if there are also tool calls
      if (responseText?.trim() && hasToolCalls(response)) {
        const trimmedText = responseText.trim();
        ctx.scratchpad.addThinking(trimmedText);
        yield { type: 'thinking', message: trimmedText };
      }

      // No tool calls = final answer
      if (!hasToolCalls(response)) {
        yield* this.handleDirectResponse(responseText ?? '', ctx);
        return;
      }

      // Push AIMessage to conversation history
      messages.push(response);

      // Execute tools and collect ToolMessages
      const { toolMessages, denied } = yield* this.executeToolsAndCollectMessages(response, ctx);
      messages.push(...toolMessages);

      if (denied) {
        const totalTime = Date.now() - ctx.startTime;
        yield {
          type: 'done',
          answer: '',
          toolCalls: ctx.scratchpad.getToolCallRecords(),
          iterations: ctx.iteration,
          totalTime,
          tokenUsage: ctx.tokenCounter.getUsage(),
          tokensPerSecond: ctx.tokenCounter.getTokensPerSecond(totalTime),
        };
        return;
      }

      // Context threshold management (may compact the message array)
      const messageState = { messages: messages.slice() };
      yield* this.manageContextThreshold(ctx, query, memoryFlushState, messageState);
      // Replace messages if compaction occurred
      if (messageState.messages !== messages) {
        messages.length = 0;
        messages.push(...messageState.messages);
      }

      // Inject tool usage warning if approaching limits
      const toolUsageWarning = ctx.scratchpad.formatToolUsageForPrompt();
      if (toolUsageWarning) {
        messages.push(new HumanMessage(toolUsageWarning));
      }
    }

    // Max iterations reached
    const totalTime = Date.now() - ctx.startTime;
    yield {
      type: 'done',
      answer: `Reached maximum iterations (${this.maxIterations}). I was unable to complete the research in the allotted steps.`,
      toolCalls: ctx.scratchpad.getToolCallRecords(),
      iterations: ctx.iteration,
      totalTime,
      tokenUsage: ctx.tokenCounter.getUsage(),
      tokensPerSecond: ctx.tokenCounter.getTokensPerSecond(totalTime),
    };
  }

  /**
   * Call the LLM with the full message array.
   */
  private async callModelWithMessages(
    messages: BaseMessage[],
  ): Promise<{ response: AIMessage; usage?: TokenUsage }> {
    const result = await callLlmWithMessages(messages, {
      model: this.model,
      tools: this.tools,
      signal: this.signal,
    });
    return { response: result.response as AIMessage, usage: result.usage };
  }

  /**
   * Execute all tool calls and produce ToolMessage objects for the message array.
   *
   * Critical: every tool_call in the AIMessage MUST have a corresponding
   * ToolMessage with a matching tool_call_id. LangChain/providers reject
   * message arrays where this invariant is broken.
   */
  private async *executeToolsAndCollectMessages(
    response: AIMessage,
    ctx: RunContext,
  ): AsyncGenerator<AgentEvent, { toolMessages: ToolMessage[]; denied: boolean }> {
    const toolMessages: ToolMessage[] = [];
    let denied = false;
    const toolCalls = response.tool_calls!;
    let toolCallIndex = 0;

    for await (const event of this.toolExecutor.executeAll(response, ctx)) {
      yield event;

      if (event.type === 'tool_end') {
        const toolCall = toolCalls[toolCallIndex];
        if (toolCall) {
          toolMessages.push(new ToolMessage({
            content: event.result,
            tool_call_id: toolCall.id!,
            name: event.tool,
          }));
        }
        toolCallIndex++;
      } else if (event.type === 'tool_error') {
        const toolCall = toolCalls[toolCallIndex];
        if (toolCall) {
          toolMessages.push(new ToolMessage({
            content: `Error: ${event.error}`,
            tool_call_id: toolCall.id!,
            name: event.tool,
          }));
        }
        toolCallIndex++;
      } else if (event.type === 'tool_denied') {
        const toolCall = toolCalls[toolCallIndex];
        if (toolCall) {
          toolMessages.push(new ToolMessage({
            content: 'Tool execution denied by user.',
            tool_call_id: toolCall.id!,
            name: event.tool,
          }));
        }
        denied = true;
        toolCallIndex++;
      }
    }

    // Handle any tool_calls that were skipped (e.g., skill dedup)
    // by producing placeholder ToolMessages
    while (toolCallIndex < toolCalls.length) {
      const toolCall = toolCalls[toolCallIndex];
      toolMessages.push(new ToolMessage({
        content: 'Skipped (already executed).',
        tool_call_id: toolCall.id!,
        name: toolCall.name,
      }));
      toolCallIndex++;
    }

    return { toolMessages, denied };
  }

  /**
   * Emit the response text as the final answer.
   */
  private async *handleDirectResponse(
    responseText: string,
    ctx: RunContext,
  ): AsyncGenerator<AgentEvent, void> {
    const totalTime = Date.now() - ctx.startTime;
    yield {
      type: 'done',
      answer: responseText,
      toolCalls: ctx.scratchpad.getToolCallRecords(),
      iterations: ctx.iteration,
      totalTime,
      tokenUsage: ctx.tokenCounter.getUsage(),
      tokensPerSecond: ctx.tokenCounter.getTokensPerSecond(totalTime),
    };
  }

  /**
   * Remove oldest AI+Tool message rounds from the array, keeping the
   * SystemMessage, initial HumanMessage, and most recent N rounds.
   * Returns the number of messages removed.
   */
  private truncateMessages(messages: BaseMessage[], keepRounds: number): number {
    // Find the boundary: SystemMessage + history + initial HumanMessage
    // Everything after is AI+Tool rounds from the current query
    let roundStartIndex = 0;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i] instanceof AIMessage) {
        roundStartIndex = i;
        break;
      }
    }

    if (roundStartIndex === 0) return 0;

    // Count AI+Tool rounds from the end
    const rounds: { start: number; end: number }[] = [];
    let i = roundStartIndex;
    while (i < messages.length) {
      if (messages[i] instanceof AIMessage) {
        const start = i;
        i++;
        while (i < messages.length && messages[i] instanceof ToolMessage) {
          i++;
        }
        // Skip any HumanMessage nudges (tool usage warnings)
        while (i < messages.length && messages[i] instanceof HumanMessage) {
          i++;
        }
        rounds.push({ start, end: i });
      } else {
        i++;
      }
    }

    const roundsToRemove = Math.max(0, rounds.length - keepRounds);
    if (roundsToRemove === 0) return 0;

    const removeEnd = rounds[roundsToRemove - 1].end;
    const removed = removeEnd - roundStartIndex;
    messages.splice(roundStartIndex, removed);
    return removed;
  }

  /**
   * Replace the message array with a compacted version:
   * [SystemMessage, HumanMessage(query + summary)]
   */
  private compactMessages(messages: BaseMessage[], summary: string, query: string): BaseMessage[] {
    const systemMessage = messages[0]; // Always the SystemMessage
    return [
      systemMessage,
      new HumanMessage(`${query}\n\n${summary}`),
    ];
  }

  /**
   * Manage context size when it exceeds the threshold.
   * Strategy: memory flush → compaction (LLM summary) → fallback to clearing.
   */
  private async *manageContextThreshold(
    ctx: RunContext,
    query: string,
    memoryFlushState: { alreadyFlushed: boolean },
    messageState: { messages: BaseMessage[] },
  ): AsyncGenerator<ContextClearedEvent | CompactionEvent | AgentEvent, void> {
    // Estimate context tokens using actual API data when available
    const estimatedContextTokens = ctx.lastApiInputTokens > 0
      ? ctx.lastApiInputTokens
      : estimateTokens(messageState.messages.map(m =>
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        ).join('\n'));
    const threshold = getAutoCompactThreshold(this.model);

    if (estimatedContextTokens <= threshold) {
      return;
    }

    // Step 1: Memory flush (extract durable facts before compaction)
    const fullToolResults = ctx.scratchpad.getToolResults();
    if (
      this.memoryEnabled &&
      shouldRunMemoryFlush({
        estimatedContextTokens,
        threshold,
        alreadyFlushed: memoryFlushState.alreadyFlushed,
      })
    ) {
      yield { type: 'memory_flush', phase: 'start' };
      const flushResult = await runMemoryFlush({
        model: this.model,
        systemPrompt: this.systemPrompt,
        query,
        toolResults: fullToolResults,
        signal: this.signal,
      }).catch(() => ({ flushed: false, written: false as const }));
      memoryFlushState.alreadyFlushed = flushResult.flushed;
      yield {
        type: 'memory_flush',
        phase: 'end',
        filesWritten: flushResult.written ? [`${new Date().toISOString().slice(0, 10)}.md`] : [],
      };
    }

    // Step 2: Attempt compaction (Claudia-style LLM summarization)
    if (
      this.compactionFailures < MAX_CONSECUTIVE_COMPACTION_FAILURES &&
      ctx.scratchpad.getActiveToolResultCount() >= MIN_TOOL_RESULTS_FOR_COMPACTION
    ) {
      yield { type: 'compaction', phase: 'start', preCompactTokens: estimatedContextTokens };

      try {
        const result = await compactContext({
          model: this.model,
          systemPrompt: this.systemPrompt,
          query,
          toolResults: fullToolResults,
          signal: this.signal,
        });

        // Replace the message array with compacted version
        messageState.messages = this.compactMessages(messageState.messages, result.summary, query);
        ctx.scratchpad.setCompactionSummary(result.summary);

        if (result.usage) {
          ctx.tokenCounter.add(result.usage);
        }

        this.compactionFailures = 0;
        memoryFlushState.alreadyFlushed = false;

        const postCompactTokens = estimateTokens(
          messageState.messages.map(m =>
            typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          ).join('\n'),
        );

        yield {
          type: 'compaction',
          phase: 'end',
          success: true,
          preCompactTokens: estimatedContextTokens,
          postCompactTokens,
          compactionModel: resolveProvider(this.model).fastModel ?? this.model,
        };

        return;
      } catch {
        this.compactionFailures++;
        yield {
          type: 'compaction',
          phase: 'end',
          success: false,
          preCompactTokens: estimatedContextTokens,
        };
      }
    }

    // Step 3: Fallback — truncate oldest rounds from message array
    const removed = this.truncateMessages(messageState.messages, KEEP_TOOL_USES);
    if (removed > 0) {
      memoryFlushState.alreadyFlushed = false;
      yield { type: 'context_cleared', clearedCount: removed, keptCount: KEEP_TOOL_USES };
    }
  }
}
