import { AIMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { callLlm, streamCallLlm } from '../model/llm.js';
import { getSetting } from '../utils/config.js';
import { getTools } from '../tools/registry.js';
import { buildSystemPrompt, buildIterationPrompt, loadSoulDocument } from './prompts.js';
import { extractTextContent, hasToolCalls, extractReasoningContent } from '../utils/ai-message.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import { buildHistoryContext } from '../utils/history-context.js';
import { estimateTokens, CONTEXT_THRESHOLD, KEEP_TOOL_USES, getContextThreshold, getKeepToolUses } from '../utils/tokens.js';
import { formatUserFacingError, isContextOverflowError } from '../utils/errors.js';
import type { AgentConfig, AgentEvent, AnswerStartEvent, AnswerChunkEvent, ContextClearedEvent, ProgressEvent, TokenUsage } from '../agent/types.js';
import { createRunContext, type RunContext } from './run-context.js';
import { AgentToolExecutor } from './tool-executor.js';
import { MemoryManager } from '../memory/index.js';
import { runMemoryFlush, shouldRunMemoryFlush } from '../memory/flush.js';
import { injectMemoryContext } from './memory-injection.js';
import { extractTickers as extractTickersFn } from '../memory/ticker-extractor.js';
import { injectPolymarketContext } from '../tools/finance/polymarket-injector.js';
import { extractSignals as extractSignalsFn } from '../tools/finance/signal-extractor.js';
import { fetchPolymarketMarkets } from '../tools/finance/polymarket.js';
import { resolveProvider } from '../providers.js';

/** Matches the timeout used in llm.ts — configurable via the same env var. */
const LLM_CALL_TIMEOUT_MS = parseInt(process.env.LLM_CALL_TIMEOUT_MS ?? '120000', 10);


const DEFAULT_MODEL = 'gpt-5.4';
export const DEFAULT_MAX_ITERATIONS = 25;

/**
 * Remove <think>...</think> blocks that Ollama thinking models sometimes embed
 * directly in response text rather than separating into reasoning_content.
 * Also handles orphan </think> tags (e.g. the model output was: <think>…</think>\nAnswer).
 */
export function stripThinkingTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // full <think>…</think> blocks
    .replace(/^[\s\S]*?<\/think>\s*/i, '')      // orphan </think>: strip everything up to and including it
    .trim();
}
const MAX_OVERFLOW_RETRIES = 2;
/** Flush memory to disk every N iterations regardless of context size. */
const PERIODIC_FLUSH_INTERVAL = 5;

/**
 * Build a compact Sources footer from a deduplicated list of URLs.
 * Only appended to answers when the model hasn't already cited inline links.
 * Limits to 10 URLs to keep the footer scannable.
 *
 * Social media post URLs (Reddit, X/Twitter, etc.) are excluded — these are
 * inputs to sentiment analysis, not authoritative research citations.
 */

/** Domains excluded from the Sources footer (social media / UGC). */
const EXCLUDED_SOURCE_DOMAINS = [
  'reddit.com',
  'x.com',
  'twitter.com',
  'threads.net',
  'bsky.app',
  'bluesky.app',
];

export function buildSourcesFooter(urls: string[]): string {
  const filtered = urls.filter(u => {
    try {
      const host = new URL(u).hostname.replace(/^www\./, '');
      return !EXCLUDED_SOURCE_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
    } catch {
      return false;
    }
  });
  const unique = [...new Set(filtered)].slice(0, 10);
  if (unique.length === 0) return '';
  const lines = unique.map((u, i) => `${i + 1}. ${u}`).join('\n');
  return `\n\n---\n**Sources**\n${lines}`;
}

// ============================================================================
// Context summary helpers (exported for unit tests)
// ============================================================================

/**
 * Numeric fact patterns extracted from tool results before they are cleared
 * from context. Each pattern captures a distinct type of financial data.
 */
export const FACT_PATTERNS: ReadonlyArray<RegExp> = [
  /\$[\d,]+(?:\.\d{1,2})?(?:\s*[BMK](?:illion)?)?/gi,  // prices / market caps
  /[-+]?\d+(?:\.\d+)?%/g,                                // percentages
  /\b(?:IC|ICIR|RankIC)\s*[:=]\s*[-+]?\d+\.\d+/gi,     // factor IC values
  /\bP\/E\s*[:=]?\s*\d+(?:\.\d+)?x?/gi,                 // P/E ratios
  /\bEV\/EBITDA\s*[:=]?\s*\d+(?:\.\d+)?x?/gi,           // EV/EBITDA
  /\bP\/[SB]\s*[:=]?\s*\d+(?:\.\d+)?x?/gi,              // P/S, P/B
  /\b(?:probability|chance|likely)\s+[:=]?\s*\d+(?:\.\d+)?%/gi, // probabilities
  /\bWACC\s*[:=]\s*\d+(?:\.\d+)?%/gi,                   // WACC
  /\bROIC?\s*[:=]\s*\d+(?:\.\d+)?%/gi,                  // ROIC
];

/**
 * Extract up to `maxFacts` unique key numeric facts from a text snippet.
 * Returns them as a compact comma-separated string, or '' when none found.
 */
export function extractKeyFacts(text: string, maxFacts = 10): string {
  const seen = new Set<string>();
  const facts: string[] = [];
  for (const re of FACT_PATTERNS) {
    const pattern = new RegExp(re.source, re.flags);
    for (const m of text.matchAll(pattern)) {
      const key = m[0].toLowerCase().replace(/\s+/g, ' ').trim();
      if (!seen.has(key) && facts.length < maxFacts) {
        seen.add(key);
        facts.push(m[0].trim());
      }
    }
  }
  return facts.join(', ');
}

/** Maps raw JSON field names found in financial tool results to compact labels. */
const METRIC_KEY_MAP: Readonly<Record<string, string>> = {
  revenue: 'rev',
  total_revenue: 'rev',
  net_income: 'NI',
  earnings_per_share: 'EPS',
  eps: 'EPS',
  pe_ratio: 'PE',
  price_to_earnings_ratio: 'PE',
  ev_to_ebitda: 'EV/EBITDA',
  enterprise_value_over_ebitda: 'EV/EBITDA',
  market_cap: 'mktcap',
  market_capitalization: 'mktcap',
  gross_margin: 'GM%',
  operating_margin: 'OpM%',
  price_to_book: 'P/B',
  return_on_equity: 'ROE%',
  return_on_assets: 'ROA%',
  debt_to_equity: 'D/E',
};

/**
 * Parse key financial metrics from a JSON-like tool result snippet.
 * Returns compact `label=value` strings (up to 6) for ticker table rows.
 */
export function extractTickerMetrics(text: string): string[] {
  const metrics: string[] = [];
  const seen = new Set<string>();
  const kvPattern = /"([\w_]+)":\s*"?([^",\n\]}{]+)"?/g;
  for (const m of text.matchAll(kvPattern)) {
    const label = METRIC_KEY_MAP[m[1]!.toLowerCase()];
    if (label) {
      const val = m[2]!.trim().replace(/,$/, '');
      const entry = `${label}=${val}`;
      if (!seen.has(entry) && metrics.length < 6) {
        seen.add(entry);
        metrics.push(entry);
      }
    }
  }
  return metrics;
}

/**
 * Build a merged context summary string from tool results about to be cleared.
 *
 * - Prefixes each line with the tool's ticker/query arg when present so the
 *   LLM retains the ticker→value association (e.g. `get_financials(ticker=NVDA): …`).
 * - Appends a compact ticker→metric table when financial key/value pairs are found.
 * - Snippet length is 400 chars (up from the previous 200) for richer context.
 * - When `existingSummary` is provided the new facts are merged into it instead
 *   of appending a separate entry, preventing 3+ summary blocks stacking up.
 *
 * Returns null when there is nothing to summarise.
 */
export function buildContextSummaryText(
  toSummarise: Array<{ toolName: string; args: Record<string, unknown>; snippet: string }>,
  existingSummary: string | null,
): string | null {
  if (toSummarise.length === 0) return null;

  const lines: string[] = [];
  const tickerRows = new Map<string, string[]>();

  for (const { toolName, args, snippet } of toSummarise) {
    const ticker = typeof args['ticker'] === 'string' ? args['ticker'].toUpperCase() : null;
    const queryArg = typeof args['query'] === 'string' ? args['query'] : null;

    const argsStr = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(', ');
    const condensed = snippet.replace(/\s+/g, ' ').trim().slice(0, 400);
    const keyFacts = extractKeyFacts(snippet);
    const factsNote = keyFacts ? ` [KEY FACTS: ${keyFacts}]` : '';

    // Prefix with ticker/query so the LLM knows which asset the data belongs to.
    const callLabel = ticker
      ? `${toolName}(ticker=${ticker})`
      : queryArg
        ? `${toolName}(query=${queryArg})`
        : `${toolName}(${argsStr})`;
    lines.push(`- ${callLabel}: ${condensed}…${factsNote}`);

    if (ticker) {
      const metrics = extractTickerMetrics(snippet);
      if (metrics.length > 0 && !tickerRows.has(ticker)) {
        tickerRows.set(ticker, metrics);
      }
    }
  }

  let newSummary = `The following ${toSummarise.length} earlier tool result(s) were condensed to save context:\n${lines.join('\n')}`;

  if (tickerRows.size > 0) {
    const tableLines = [...tickerRows.entries()].map(([t, m]) => `${t}: ${m.join(', ')}`);
    newSummary += `\n\nKey metrics by ticker:\n${tableLines.join('\n')}`;
  }

  // Merge into the existing summary rather than appending a second block.
  if (existingSummary) {
    return `${existingSummary}\n\n---\n${newSummary}`;
  }
  return newSummary;
}

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
  private readonly memoryEnabled: boolean;
  private readonly thinkEnabled: boolean | undefined;

  private constructor(
    config: AgentConfig,
    tools: StructuredToolInterface[],
    systemPrompt: string,
  ) {
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxIterations = config.maxIterations ?? getSetting<number>('maxIterations', DEFAULT_MAX_ITERATIONS);
    this.tools = tools;
    this.toolMap = new Map(tools.map(t => [t.name, t]));
    this.toolExecutor = new AgentToolExecutor(this.toolMap, config.signal, config.requestToolApproval, config.sessionApprovedTools);
    this.systemPrompt = systemPrompt;
    this.signal = config.signal;
    this.memoryEnabled = config.memoryEnabled ?? true;
    this.thinkEnabled = config.thinkEnabled;
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
   * Anthropic-style context management: full tool results during iteration,
   * with threshold-based clearing of oldest results when context exceeds limit.
   */
  async *run(query: string, inMemoryHistory?: InMemoryChatHistory): AsyncGenerator<AgentEvent> {
    const startTime = Date.now();

    if (this.tools.length === 0) {
      yield { type: 'done', answer: 'No tools available. Please check your API key configuration.', toolCalls: [], iterations: 0, totalTime: Date.now() - startTime };
      return;
    }

    const ctx = createRunContext(query);
    const memoryFlushState = { alreadyFlushed: false };
    const periodicFlushState = { lastFlushedIteration: 0 };

    // Build initial prompt with conversation history context
    let currentPrompt = this.buildInitialPrompt(query, inMemoryHistory);

    // Auto-inject relevant prior research memories based on tickers mentioned
    currentPrompt = await injectMemoryContext(query, currentPrompt, {
      getMemoryManager: () => MemoryManager.get(),
      extractTickers: (text) => extractTickersFn(text),
    });

    // Auto-inject Polymarket prediction market context for detected asset signals
    currentPrompt = await injectPolymarketContext(query, currentPrompt, {
      extractSignals: (text) => extractSignalsFn(text),
      fetchMarkets: (q, limit) => fetchPolymarketMarkets(q, limit),
    });

    // Track whether sequential_thinking has been used at least once this session
    let sequentialThinkingUsed = false;
    // Cap retries for the sequential_thinking compliance reminder to avoid
    // an infinite loop when a model persistently ignores the instruction.
    let sequentialThinkingRetries = 0;
    const MAX_ST_RETRIES = 3;
    // Hard cap on total sequential_thinking calls so planning never burns all
    // iterations before any research tool runs. Models sometimes loop through
    // 10-15 thoughts on complex queries, leaving no budget for actual research.
    let sequentialThinkingCallCount = 0;
    const MAX_SEQUENTIAL_THOUGHTS = 6;

    // Main agent loop
    let overflowRetries = 0;
    while (ctx.iteration < this.maxIterations) {
      ctx.iteration++;
      yield { type: 'progress', iteration: ctx.iteration, maxIterations: this.maxIterations } as ProgressEvent;

      let response: AIMessage | string;
      let usage: TokenUsage | undefined;

      while (true) {
        try {
          const result = await this.callModel(currentPrompt);
          response = result.response;
          usage = result.usage;
          overflowRetries = 0;
          break;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          if (isContextOverflowError(errorMessage) && overflowRetries < MAX_OVERFLOW_RETRIES) {
            overflowRetries++;
            const overflowKeep = Math.max(2, getKeepToolUses() - 2);
            this.injectContextSummaryBeforeClearing(ctx, overflowKeep);
            const clearedCount = ctx.scratchpad.clearOldestToolResults(overflowKeep);

            if (clearedCount > 0) {
              yield { type: 'context_cleared', clearedCount, keptCount: overflowKeep };
              currentPrompt = buildIterationPrompt(
                query,
                ctx.scratchpad.getToolResults(),
                ctx.scratchpad.formatToolUsageForPrompt()
              );
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

      // Emit reasoning block from Ollama thinking models (qwen3, deepseek-r1, qwq)
      if (typeof response !== 'string') {
        const reasoning = extractReasoningContent(response as AIMessage);
        if (reasoning) {
          yield { type: 'reasoning', content: reasoning };
        }
      }

      const responseText = typeof response === 'string' ? response : extractTextContent(response);

      // Emit thinking if there are also tool calls (skip whitespace-only responses).
      // Truncate to 500 chars to prevent large JSON blobs from flooding the terminal —
      // some models (e.g. Qwen) embed raw tool-call syntax in their text content.
      if (responseText?.trim() && typeof response !== 'string' && hasToolCalls(response)) {
        const trimmedText = responseText.trim();
        ctx.scratchpad.addThinking(trimmedText);
        const displayText = trimmedText.length > 500 ? trimmedText.slice(0, 500) + '…' : trimmedText;
        yield { type: 'thinking', message: displayText };
      }

      // No tool calls = final answer is in this response
      if (typeof response === 'string' || !hasToolCalls(response)) {
        yield* this.handleDirectResponse(responseText ?? '', ctx, currentPrompt);
        return;
      }

      // Enforce sequential_thinking as the mandatory first tool call.
      // If the model's first tool call this session is not sequential_thinking,
      // inject a reminder and retry — but only up to MAX_ST_RETRIES times to
      // prevent an infinite loop when a model persistently ignores the reminder.
      if (!sequentialThinkingUsed) {
        const firstTool = (response as AIMessage).tool_calls?.[0]?.name;
        if (firstTool && firstTool !== 'sequential_thinking') {
          if (sequentialThinkingRetries < MAX_ST_RETRIES) {
            sequentialThinkingRetries++;
            ctx.iteration--; // don't charge this iteration
            currentPrompt = `${currentPrompt}\n\nIMPORTANT REMINDER: You MUST call sequential_thinking FIRST before calling any other tool. Start with sequential_thinking to plan your approach, then proceed.`;
            continue;
          }
          // Retries exhausted — proceed without sequential_thinking rather than
          // looping forever. Mark as satisfied so we stop checking.
          sequentialThinkingUsed = true;
        }
      }

      // Mark sequential_thinking as satisfied once it appears in any tool call
      if (!sequentialThinkingUsed) {
        const stToolCalls = (response as AIMessage).tool_calls ?? [];
        if (stToolCalls.some((tc) => tc.name === 'sequential_thinking')) {
          sequentialThinkingUsed = true;
        }
      }

      // Count sequential_thinking calls before executing tools (needed for nudge below).
      const toolCalls = (response as AIMessage).tool_calls ?? [];
      const stCallsThisIteration = toolCalls.filter((tc) => tc.name === 'sequential_thinking').length;
      sequentialThinkingCallCount += stCallsThisIteration;

      // Execute tools and add results to scratchpad (response is AIMessage here)
      for await (const event of this.toolExecutor.executeAll(response, ctx)) {
        yield event;
        if (event.type === 'tool_denied') {
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
      }
      yield* this.manageContextThreshold(ctx, query, memoryFlushState);

      // Periodic auto-save: flush findings to long-term memory every N iterations
      // so a crash doesn't lose all research done so far.
      if (
        this.memoryEnabled &&
        ctx.iteration - periodicFlushState.lastFlushedIteration >= PERIODIC_FLUSH_INTERVAL
      ) {
        yield* this.runPeriodicMemoryFlush(ctx, query, periodicFlushState);
      }

      // Build iteration prompt with full tool results (Anthropic-style)
      currentPrompt = buildIterationPrompt(
        query,
        ctx.scratchpad.getToolResults(),
        ctx.scratchpad.formatToolUsageForPrompt()
      );

      // After the cap is hit, redirect the model to stop planning and start
      // using research tools. Only inject the nudge once (at the boundary).
      if (stCallsThisIteration > 0 && sequentialThinkingCallCount >= MAX_SEQUENTIAL_THOUGHTS) {
        currentPrompt += '\n\n[SYSTEM NOTE: Planning phase complete. You have used the maximum number of sequential_thinking steps allowed. You MUST now proceed directly to research tools (financial_search, web_search, read_filings, etc.) to gather data and answer the question. Do not call sequential_thinking again.]';
      }
    }

    // Max iterations reached — synthesize a best-effort answer from gathered research
    // rather than yielding a bare failure message. Any data collected is still useful.
    const toolResults = ctx.scratchpad.getToolResults().trim();
    const hasMeaningfulResearch = toolResults.length > 50;

    const synthesisPrompt = hasMeaningfulResearch
      ? buildIterationPrompt(
          query,
          toolResults,
          ctx.scratchpad.formatToolUsageForPrompt(),
        ) +
          `\n\n[SYSTEM NOTE: You have reached the maximum number of research steps (${this.maxIterations}). ` +
          `You MUST now write your best-effort final answer using ONLY the data gathered above. ` +
          `Start your response with "**[Best-effort summary — research may be incomplete]**\\n\\n" ` +
          `then provide the most useful analysis you can from the available data. Do NOT call any more tools.]`
      : query;

    yield* this.handleDirectResponse('', ctx, synthesisPrompt);
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
      thinkOverride: this.thinkEnabled,
    });
    return { response: result.response, usage: result.usage };
  }

  /**
   * Emit the response text as the final answer.
   *
   * When the model has already returned a text answer (non-empty fallbackText),
   * we emit it directly — no second LLM call is needed. Making an extra
   * streamCallLlm round-trip with a large prompt can hang for minutes on
   * heavy models and provides no benefit over the text we already have.
   *
   * The only case where we call streamCallLlm is max-iterations synthesis,
   * where fallbackText is empty and we need the LLM to write a fresh summary.
   * That call is guarded by a hard timeout so it cannot block indefinitely.
   */
  private async *handleDirectResponse(
    fallbackText: string,
    ctx: RunContext,
    currentPrompt?: string,
  ): AsyncGenerator<AgentEvent, void> {
    // Emit answer_start so the TUI can switch to streaming display mode
    yield { type: 'answer_start' } as AnswerStartEvent;

    let streamedAnswer = '';

    const text = stripThinkingTags(fallbackText);

    if (text) {
      // We already have the answer from the non-streaming callLlm response.
      // Fake-stream it so the TUI shows the text appearing progressively.
      const CHUNK_SIZE = 6;
      for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        const chunk = text.slice(i, i + CHUNK_SIZE);
        streamedAnswer += chunk;
        yield { type: 'answer_chunk', chunk } as AnswerChunkEvent;
      }
    } else if (currentPrompt) {
      // No pre-existing answer (e.g. max-iterations synthesis) — request a
      // fresh streaming response. Apply a hard timeout so we never hang.
      const timeoutSignal = AbortSignal.timeout(LLM_CALL_TIMEOUT_MS);
      const combinedSignal = this.signal
        ? AbortSignal.any([this.signal, timeoutSignal])
        : timeoutSignal;
      try {
        for await (const chunk of streamCallLlm(currentPrompt, {
          model: this.model,
          systemPrompt: this.systemPrompt,
          signal: combinedSignal,
        })) {
          streamedAnswer += chunk;
          yield { type: 'answer_chunk', chunk } as AnswerChunkEvent;
        }
      } catch {
        // Synthesis timed out or failed — surface the raw tool results so the
        // user has something to work with rather than seeing a blank answer.
        const toolSummary = ctx.scratchpad.getToolResults().trim();
        if (toolSummary) {
          const fallback =
            '**[Research interrupted — synthesis timed out]**\n\n' +
            'The model did not complete in time. Raw research data gathered:\n\n' +
            toolSummary.slice(0, 3000);
          yield { type: 'answer_chunk', chunk: fallback } as AnswerChunkEvent;
          streamedAnswer = fallback;
        }
      }
    }

    // Append a Sources footer when the answer used web searches or structured
    // financial tools that returned source URLs. Skipped for empty answers and
    // when the answer already contains a markdown link (model cited inline).
    const sourceUrls = ctx.scratchpad.collectSourceUrls();
    if (streamedAnswer && sourceUrls.length > 0 && !streamedAnswer.includes('](http')) {
      const footer = buildSourcesFooter(sourceUrls);
      streamedAnswer += footer;
      yield { type: 'answer_chunk', chunk: footer } as AnswerChunkEvent;
    }

    const totalTime = Date.now() - ctx.startTime;
    yield {
      type: 'done',
      answer: streamedAnswer,
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
  private async *manageContextThreshold(
    ctx: RunContext,
    query: string,
    memoryFlushState: { alreadyFlushed: boolean },
  ): AsyncGenerator<ContextClearedEvent | AgentEvent, void> {
    const fullToolResults = ctx.scratchpad.getToolResults();
    const estimatedContextTokens = estimateTokens(this.systemPrompt + ctx.query + fullToolResults);

    if (estimatedContextTokens > getContextThreshold()) {
      if (
        this.memoryEnabled &&
        shouldRunMemoryFlush({
          estimatedContextTokens,
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

      this.injectContextSummaryBeforeClearing(ctx, getKeepToolUses());
      const clearedCount = ctx.scratchpad.clearOldestToolResults(getKeepToolUses());
      if (clearedCount > 0) {
        memoryFlushState.alreadyFlushed = false;
        yield { type: 'context_cleared', clearedCount, keptCount: getKeepToolUses() };
      }
    }
  }

  /**
   * Builds a compact rule-based summary of tool results that are about to be
   * dropped from context and injects it as a context_summary entry so the LLM
   * doesn't lose analysis continuity without incurring an extra LLM call.
   *
   * If a context_summary already exists it merges the new facts into it
   * (via buildContextSummaryText) to prevent multiple summaries stacking up.
   */
  private injectContextSummaryBeforeClearing(ctx: RunContext, keepCount: number): void {
    const toSummarise = ctx.scratchpad.getContentToBeCleared(keepCount);
    if (toSummarise.length === 0) return;

    const existingSummary = ctx.scratchpad.getLatestContextSummary();
    const summary = buildContextSummaryText(toSummarise, existingSummary);
    if (summary) ctx.scratchpad.addContextSummary(summary);
  }
  /**
   * Periodic auto-save: flush research findings to long-term memory every
   * PERIODIC_FLUSH_INTERVAL iterations, independent of context size.
   * This prevents total data loss if the session crashes mid-research.
   */
  private async *runPeriodicMemoryFlush(
    ctx: RunContext,
    query: string,
    state: { lastFlushedIteration: number },
  ): AsyncGenerator<AgentEvent, void> {
    state.lastFlushedIteration = ctx.iteration;
    yield { type: 'memory_flush', phase: 'start' };
    const flushResult = await runMemoryFlush({
      model: this.model,
      systemPrompt: this.systemPrompt,
      query,
      toolResults: ctx.scratchpad.getToolResults(),
      signal: this.signal,
    }).catch(() => ({ flushed: false, written: false as const }));
    yield {
      type: 'memory_flush',
      phase: 'end',
      filesWritten: flushResult.written ? [`${new Date().toISOString().slice(0, 10)}.md`] : [],
    };
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

    const recentTurns = inMemoryChatHistory.getRecentTurns();
    if (recentTurns.length === 0) {
      return query;
    }

    return buildHistoryContext({
      entries: recentTurns,
      currentMessage: query,
    });
  }
}
