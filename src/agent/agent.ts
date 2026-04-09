import { AIMessage, AIMessageChunk, SystemMessage, HumanMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { callLlmWithMessages, streamLlmWithMessages } from '../model/llm.js';
import { getTools, getToolConcurrencyMap } from '../tools/registry.js';
import { buildSystemPrompt, loadSoulDocument, loadRulesDocument } from './prompts.js';
import { extractTextContent, hasToolCalls } from '../utils/ai-message.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { estimateTokens, getAutoCompactThreshold, KEEP_TOOL_USES } from '../utils/tokens.js';
import { exceedsSizeCap, persistLargeResult, buildPersistedContent } from '../utils/tool-result-storage.js';
import { enforceResultBudget } from '../utils/tool-result-budget.js';
import { formatUserFacingError, isContextOverflowError } from '../utils/errors.js';
import type { AgentConfig, AgentEvent, CompactionEvent, ContextClearedEvent, MicrocompactEvent, QueueDrainEvent, TokenUsage } from '../agent/types.js';
import type { MessageQueue } from '../utils/message-queue.js';
import { compactContext, MAX_CONSECUTIVE_COMPACTION_FAILURES, MIN_TOOL_RESULTS_FOR_COMPACTION } from './compact.js';
import { microcompactMessages } from './microcompact.js';
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
 * Architecture:
 * - Growing message array with full reasoning continuity
 * - Concurrent execution for read-only tools
 * - Streaming LLM responses with fallback to blocking
 * - Per-turn microcompact + threshold-based full compaction
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
  private readonly messageQueue?: MessageQueue;
  private compactionFailures: number = 0;

  private constructor(
    config: AgentConfig,
    tools: StructuredToolInterface[],
    systemPrompt: string,
    concurrencyMap: Map<string, boolean>,
  ) {
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.tools = tools;
    this.toolMap = new Map(tools.map(t => [t.name, t]));
    this.toolExecutor = new AgentToolExecutor(
      this.toolMap,
      concurrencyMap,
      config.signal,
      config.requestToolApproval,
      config.sessionApprovedTools,
    );
    this.systemPrompt = systemPrompt;
    this.signal = config.signal;
    this.memoryEnabled = config.memoryEnabled ?? true;
    this.messageQueue = config.messageQueue;
  }

  static async create(config: AgentConfig = {}): Promise<Agent> {
    const model = config.model ?? DEFAULT_MODEL;
    const tools = getTools(model);
    const concurrencyMap = getToolConcurrencyMap(model);
    const soulContent = await loadSoulDocument();
    const rulesContent = await loadRulesDocument();
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
      rulesContent,
    );
    return new Agent(config, tools, systemPrompt, concurrencyMap);
  }

  /**
   * Run the agent with streaming, concurrent tools, and microcompact.
   */
  async *run(query: string, inMemoryHistory?: InMemoryChatHistory): AsyncGenerator<AgentEvent> {
    const startTime = Date.now();

    if (this.tools.length === 0) {
      yield { type: 'done', answer: 'No tools available. Please check your API key configuration.', toolCalls: [], iterations: 0, totalTime: Date.now() - startTime };
      return;
    }

    const ctx = createRunContext(query);
    const memoryFlushState = { alreadyFlushed: false };

    // Build initial message array
    const historyMessages = inMemoryHistory?.getRecentTurnsAsMessages() ?? [];
    let messages: BaseMessage[] = [
      new SystemMessage(this.systemPrompt),
      ...historyMessages,
      new HumanMessage(query),
    ];

    // Main agent loop
    let overflowRetries = 0;
    while (ctx.iteration < this.maxIterations) {
      ctx.iteration++;

      // Microcompact: per-turn lightweight trimming before LLM call
      const mcResult = microcompactMessages(messages);
      if (mcResult.trigger) {
        messages = mcResult.messages;
        yield { type: 'microcompact', cleared: mcResult.cleared, tokensSaved: mcResult.estimatedTokensSaved } as MicrocompactEvent;
      }

      // Strip old reasoning from AIMessages (keep last 2 for continuity)
      this.stripOldThinking(messages, 2);

      let response: AIMessage;
      let usage: TokenUsage | undefined;

      // Call LLM with streaming (falls back to blocking on error)
      while (true) {
        try {
          const result = await this.callModelWithStreaming(messages);
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

      // Execute tools concurrently where safe, collect ToolMessages by ID
      let { toolMessages, denied } = yield* this.executeToolsAndCollectMessages(response, ctx);

      // Cap large results (persist to disk, inject preview)
      toolMessages = toolMessages.map(tm => {
        const content = typeof tm.content === 'string' ? tm.content : JSON.stringify(tm.content);
        if (exceedsSizeCap(content)) {
          const { preview, filePath } = persistLargeResult(tm.name ?? 'unknown', tm.tool_call_id, content);
          return new ToolMessage({
            content: buildPersistedContent(filePath, preview, content.length),
            tool_call_id: tm.tool_call_id,
            name: tm.name,
          });
        }
        return tm;
      });

      // Enforce per-turn total budget
      toolMessages = enforceResultBudget(toolMessages);

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
      const messageState = { messages };
      yield* this.manageContextThreshold(ctx, query, memoryFlushState, messageState);
      messages = messageState.messages;

      // Inject tool usage warning if approaching limits
      const toolUsageWarning = ctx.scratchpad.formatToolUsageForPrompt();
      if (toolUsageWarning) {
        messages.push(new HumanMessage(toolUsageWarning));
      }

      // Drain queued messages: user may have sent follow-ups while agent was working
      const drainResult = this.drainQueue();
      if (drainResult) {
        messages.push(new HumanMessage(drainResult.text));
        yield { type: 'queue_drain', messageCount: drainResult.count, mergedText: drainResult.text } as QueueDrainEvent;
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

  // ---------------------------------------------------------------------------
  // LLM call methods
  // ---------------------------------------------------------------------------

  /**
   * Call LLM with streaming, falling back to blocking invoke on error.
   */
  private async callModelWithStreaming(
    messages: BaseMessage[],
  ): Promise<{ response: AIMessage; usage?: TokenUsage }> {
    try {
      return await this.streamAndAccumulate(messages);
    } catch {
      // Fallback to blocking invoke (handles providers without streaming support)
      return await this.callModelWithMessages(messages);
    }
  }

  /**
   * Stream the LLM response, accumulating chunks into a final AIMessage.
   */
  private async streamAndAccumulate(
    messages: BaseMessage[],
  ): Promise<{ response: AIMessage; usage?: TokenUsage }> {
    let accumulated: AIMessageChunk | null = null;

    for await (const chunk of streamLlmWithMessages(messages, {
      model: this.model,
      tools: this.tools,
      signal: this.signal,
    })) {
      accumulated = accumulated ? accumulated.concat(chunk) : chunk;
    }

    if (!accumulated) {
      throw new Error('Stream produced no chunks');
    }

    const response = new AIMessage({
      content: accumulated.content,
      tool_calls: accumulated.tool_calls,
      invalid_tool_calls: accumulated.invalid_tool_calls,
      usage_metadata: accumulated.usage_metadata,
      response_metadata: accumulated.response_metadata,
    });

    const usage = accumulated.usage_metadata
      ? {
          inputTokens: accumulated.usage_metadata.input_tokens ?? 0,
          outputTokens: accumulated.usage_metadata.output_tokens ?? 0,
          totalTokens: accumulated.usage_metadata.total_tokens ?? 0,
        }
      : undefined;

    return { response, usage };
  }

  /**
   * Blocking LLM call (fallback when streaming fails).
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

  // ---------------------------------------------------------------------------
  // Tool execution
  // ---------------------------------------------------------------------------

  /**
   * Execute tools and collect ToolMessages mapped by tool_call_id.
   * Supports concurrent execution — events may arrive out of order.
   */
  private async *executeToolsAndCollectMessages(
    response: AIMessage,
    ctx: RunContext,
  ): AsyncGenerator<AgentEvent, { toolMessages: ToolMessage[]; denied: boolean }> {
    const toolMessageMap = new Map<string, ToolMessage>();
    let denied = false;
    const toolCalls = response.tool_calls!;

    for await (const event of this.toolExecutor.executeAll(response, ctx)) {
      yield event;

      if (event.type === 'tool_end' && event.toolCallId) {
        toolMessageMap.set(event.toolCallId, new ToolMessage({
          content: event.result,
          tool_call_id: event.toolCallId,
          name: event.tool,
        }));
      } else if (event.type === 'tool_error' && event.toolCallId) {
        toolMessageMap.set(event.toolCallId, new ToolMessage({
          content: `Error: ${event.error}`,
          tool_call_id: event.toolCallId,
          name: event.tool,
        }));
      } else if (event.type === 'tool_denied' && event.toolCallId) {
        toolMessageMap.set(event.toolCallId, new ToolMessage({
          content: 'Tool execution denied by user.',
          tool_call_id: event.toolCallId,
          name: event.tool,
        }));
        denied = true;
      }
    }

    // Produce ToolMessages in ORIGINAL tool_calls order
    const toolMessages: ToolMessage[] = toolCalls.map(tc =>
      toolMessageMap.get(tc.id!) ?? new ToolMessage({
        content: 'Skipped (already executed).',
        tool_call_id: tc.id!,
        name: tc.name,
      }),
    );

    return { toolMessages, denied };
  }

  // ---------------------------------------------------------------------------
  // Message queue
  // ---------------------------------------------------------------------------

  /**
   * Drain all queued messages, merge into a single text block.
   * Returns null if the queue is empty or not configured.
   */
  private drainQueue(): { text: string; count: number } | null {
    if (!this.messageQueue || this.messageQueue.isEmpty()) {
      return null;
    }
    const messages = this.messageQueue.dequeueAll();
    if (messages.length === 0) return null;
    return {
      text: messages.map(m => m.text).join('\n\n'),
      count: messages.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Response handling
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Message array management
  // ---------------------------------------------------------------------------

  /**
   * Remove oldest AI+Tool message rounds, keeping SystemMessage, history,
   * HumanMessage, and the most recent N rounds.
   */
  /**
   * Strip text content from old AIMessages, keeping only the most recent N.
   * Preserves tool_calls structure (required for ToolMessage pairing).
   */
  private stripOldThinking(messages: BaseMessage[], keepLast: number): void {
    // Collect indices of AIMessages with text content
    const aiIndices: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i] instanceof AIMessage) {
        aiIndices.push(i);
      }
    }

    // Only strip if we have more than keepLast AIMessages
    const toStrip = aiIndices.slice(0, -keepLast);
    for (const idx of toStrip) {
      const msg = messages[idx] as AIMessage;
      // Only strip if it has tool_calls (reasoning before tools — safe to clear)
      if (msg.tool_calls && msg.tool_calls.length > 0 && msg.content) {
        messages[idx] = new AIMessage({
          content: '',
          tool_calls: msg.tool_calls,
          invalid_tool_calls: msg.invalid_tool_calls,
          usage_metadata: msg.usage_metadata,
          response_metadata: msg.response_metadata,
        });
      }
    }
  }

  private truncateMessages(messages: BaseMessage[], keepRounds: number): number {
    let roundStartIndex = 0;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i] instanceof AIMessage) {
        roundStartIndex = i;
        break;
      }
    }
    if (roundStartIndex === 0) return 0;

    const rounds: { start: number; end: number }[] = [];
    let i = roundStartIndex;
    while (i < messages.length) {
      if (messages[i] instanceof AIMessage) {
        const start = i;
        i++;
        while (i < messages.length && (messages[i] instanceof ToolMessage || messages[i] instanceof HumanMessage)) {
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
   * Replace message array with compacted version after LLM summarization.
   */
  private compactMessages(messages: BaseMessage[], summary: string, query: string): BaseMessage[] {
    return [
      messages[0], // SystemMessage
      new HumanMessage(`${query}\n\n${summary}`),
    ];
  }

  // ---------------------------------------------------------------------------
  // Context threshold management
  // ---------------------------------------------------------------------------

  private async *manageContextThreshold(
    ctx: RunContext,
    query: string,
    memoryFlushState: { alreadyFlushed: boolean },
    messageState: { messages: BaseMessage[] },
  ): AsyncGenerator<ContextClearedEvent | CompactionEvent | AgentEvent, void> {
    const estimatedContextTokens = ctx.lastApiInputTokens > 0
      ? ctx.lastApiInputTokens
      : estimateTokens(messageState.messages.map(m =>
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        ).join('\n'));
    const threshold = getAutoCompactThreshold(this.model);

    if (estimatedContextTokens <= threshold) {
      return;
    }

    // Step 1: Memory flush
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

    // Step 2: Compaction
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

    // Step 3: Fallback — truncate oldest rounds
    const removed = this.truncateMessages(messageState.messages, KEEP_TOOL_USES);
    if (removed > 0) {
      memoryFlushState.alreadyFlushed = false;
      yield { type: 'context_cleared', clearedCount: removed, keptCount: KEEP_TOOL_USES };
    }
  }
}
