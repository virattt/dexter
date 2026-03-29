import { AIMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StructuredToolInterface } from '@langchain/core/tools';
import { Runnable } from '@langchain/core/runnables';
import { z } from 'zod';
import { getDefaultSystemPrompt } from '@/agent/prompts';
import type { TokenUsage } from '@/agent/types';
import { logger } from '@/utils';
import { classifyError, isNonRetryableError } from '@/utils/errors';
import { resolveProvider, getProviderById } from '@/providers';

export const DEFAULT_PROVIDER = 'openai';
export const DEFAULT_MODEL = 'gpt-5.4';

/** Ollama model name patterns that support extended thinking via `think: true`. */
const THINKING_MODEL_PATTERNS = [/qwen3/, /deepseek-r1/, /qwq/, /nemotron/];

/**
 * Returns true when the given model name is an Ollama thinking-capable model
 * (e.g. qwen3, deepseek-r1, qwq, nemotron). Case-insensitive; strips `ollama:` prefix.
 */
export function isThinkingModel(name: string): boolean {
  const bare = name.replace(/^ollama:/i, '').toLowerCase();
  return THINKING_MODEL_PATTERNS.some((p) => p.test(bare));
}

/**
 * Gets the fast model variant for the given provider.
 * Falls back to the provided model if no fast variant is configured (e.g., Ollama).
 */
export function getFastModel(modelProvider: string, fallbackModel: string): string {
  return getProviderById(modelProvider)?.fastModel ?? fallbackModel;
}

// Generic retry helper with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, provider: string, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const errorType = classifyError(message);
      logger.error(`[${provider} API] ${errorType} error (attempt ${attempt + 1}/${maxAttempts}): ${message}`);

      if (isNonRetryableError(message)) {
        throw new Error(`[${provider} API] ${message}`);
      }

      if (attempt === maxAttempts - 1) {
        throw new Error(`[${provider} API] ${message}`);
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}

/**
 * Race an LLM call against a hard wall-clock timeout.
 * Default: 120 s (configurable via LLM_CALL_TIMEOUT_MS env var).
 * When the timeout fires the AbortController is signalled so the
 * underlying HTTP connection is also torn down.
 */
const LLM_CALL_TIMEOUT_MS = parseInt(process.env.LLM_CALL_TIMEOUT_MS ?? '120000', 10);

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fn(ac.signal);
  } catch (e) {
    if (ac.signal.aborted) {
      throw new Error(`LLM call timed out after ${timeoutMs / 1000}s. The model may be slow or unavailable.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Model provider configuration
interface ModelOpts {
  streaming: boolean;
}

type ModelFactory = (name: string, opts: ModelOpts, thinkOverride?: boolean) => BaseChatModel;

function getApiKey(envVar: string): string {
  const apiKey = process.env[envVar];
  if (!apiKey) {
    throw new Error(`[LLM] ${envVar} not found in environment variables`);
  }
  return apiKey;
}

// Factories keyed by provider id — prefix routing is handled by resolveProvider()
const MODEL_FACTORIES: Record<string, ModelFactory> = {
  anthropic: (name, opts) =>
    new ChatAnthropic({
      model: name,
      ...opts,
      apiKey: getApiKey('ANTHROPIC_API_KEY'),
    }),
  google: (name, opts) =>
    new ChatGoogleGenerativeAI({
      model: name,
      ...opts,
      apiKey: getApiKey('GOOGLE_API_KEY'),
    }),
  xai: (name, opts) =>
    new ChatOpenAI({
      model: name,
      ...opts,
      apiKey: getApiKey('XAI_API_KEY'),
      configuration: {
        baseURL: 'https://api.x.ai/v1',
      },
    }),
  openrouter: (name, opts) =>
    new ChatOpenAI({
      model: name.replace(/^openrouter:/, ''),
      ...opts,
      apiKey: getApiKey('OPENROUTER_API_KEY'),
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
    }),
  moonshot: (name, opts) =>
    new ChatOpenAI({
      model: name,
      ...opts,
      apiKey: getApiKey('MOONSHOT_API_KEY'),
      configuration: {
        baseURL: 'https://api.moonshot.cn/v1',
      },
    }),
  deepseek: (name, opts) =>
    new ChatOpenAI({
      model: name,
      ...opts,
      apiKey: getApiKey('DEEPSEEK_API_KEY'),
      configuration: {
        baseURL: 'https://api.deepseek.com',
      },
    }),
  ollama: (name, opts, thinkOverride) => {
    // Use explicit override when provided; fall back to model-name auto-detect.
    const useThink = thinkOverride !== undefined ? thinkOverride : isThinkingModel(name);
    return new ChatOllama({
      model: name.replace(/^ollama:/i, ''),
      ...opts,
      ...(useThink ? { think: true } : {}),
      ...(process.env.OLLAMA_BASE_URL ? { baseUrl: process.env.OLLAMA_BASE_URL } : {}),
    });
  },
};

const DEFAULT_FACTORY: ModelFactory = (name, opts) =>
  new ChatOpenAI({
    model: name,
    ...opts,
    apiKey: getApiKey('OPENAI_API_KEY'),
  });

let _overrideFactory: ModelFactory | null = null;

/** For tests only — inject a custom model factory to intercept LLM calls. */
export function _setModelFactory(factory: ModelFactory | null): void {
  _overrideFactory = factory;
}

export function getChatModel(
  modelName: string = DEFAULT_MODEL,
  streaming: boolean = false,
  thinkOverride?: boolean,
): BaseChatModel {
  const opts: ModelOpts = { streaming };
  if (_overrideFactory) return _overrideFactory(modelName, opts, thinkOverride);
  const provider = resolveProvider(modelName);
  const factory = MODEL_FACTORIES[provider.id] ?? DEFAULT_FACTORY;
  return factory(modelName, opts, thinkOverride);
}

interface CallLlmOptions {
  model?: string;
  systemPrompt?: string;
  outputSchema?: z.ZodType<unknown>;
  tools?: StructuredToolInterface[];
  signal?: AbortSignal;
  /** Override Ollama think flag. Passed directly to getChatModel(). */
  thinkOverride?: boolean;
  /** Override the default LLM_CALL_TIMEOUT_MS for this call (milliseconds). */
  timeoutMs?: number;
}

export interface LlmResult {
  response: AIMessage | string;
  usage?: TokenUsage;
}

function extractUsage(result: unknown): TokenUsage | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const msg = result as Record<string, unknown>;

  const usageMetadata = msg.usage_metadata;
  if (usageMetadata && typeof usageMetadata === 'object') {
    const u = usageMetadata as Record<string, unknown>;
    const input = typeof u.input_tokens === 'number' ? u.input_tokens : 0;
    const output = typeof u.output_tokens === 'number' ? u.output_tokens : 0;
    const total = typeof u.total_tokens === 'number' ? u.total_tokens : input + output;
    return { inputTokens: input, outputTokens: output, totalTokens: total };
  }

  const responseMetadata = msg.response_metadata;
  if (responseMetadata && typeof responseMetadata === 'object') {
    const rm = responseMetadata as Record<string, unknown>;
    if (rm.usage && typeof rm.usage === 'object') {
      const u = rm.usage as Record<string, unknown>;
      const input = typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0;
      const output = typeof u.completion_tokens === 'number' ? u.completion_tokens : 0;
      const total = typeof u.total_tokens === 'number' ? u.total_tokens : input + output;
      return { inputTokens: input, outputTokens: output, totalTokens: total };
    }
  }

  return undefined;
}

/**
 * Build messages with Anthropic cache_control on the system prompt.
 * Marks the system prompt as ephemeral so Anthropic caches the prefix,
 * reducing input token costs by ~90% on subsequent calls.
 */
function buildAnthropicMessages(systemPrompt: string, userPrompt: string) {
  return [
    new SystemMessage({
      content: [
        {
          type: 'text' as const,
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
    }),
    new HumanMessage(userPrompt),
  ];
}

export async function callLlm(prompt: string, options: CallLlmOptions = {}): Promise<LlmResult> {
  const { model = DEFAULT_MODEL, systemPrompt, outputSchema, tools, signal, thinkOverride, timeoutMs } = options;
  const finalSystemPrompt = systemPrompt || getDefaultSystemPrompt();

  const llm = getChatModel(model, false, thinkOverride);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runnable: Runnable<any, any> = llm;

  if (outputSchema) {
    runnable = llm.withStructuredOutput(outputSchema, { strict: false });
  } else if (tools && tools.length > 0 && llm.bindTools) {
    runnable = llm.bindTools(tools);
  }

  const provider = resolveProvider(model);
  let result;

  result = await withTimeout(async (timeoutSignal) => {
    // Combine the caller's abort signal with our hard timeout signal so either
    // source can cancel the underlying HTTP request.
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;
    const invokeOpts = { signal: combinedSignal };

    if (provider.id === 'anthropic') {
      const messages = buildAnthropicMessages(finalSystemPrompt, prompt);
      return withRetry(() => runnable.invoke(messages, invokeOpts), provider.displayName);
    } else {
      // Build messages directly (same pattern as streamCallLlm) to avoid
      // ChatPromptTemplate parsing `{...}` in system prompt or user content
      // as input variables (e.g. JSON in skill tool results).
      const messages = [new SystemMessage(finalSystemPrompt), new HumanMessage(prompt)];
      return withRetry(() => runnable.invoke(messages, invokeOpts), provider.displayName);
    }
  }, timeoutMs ?? LLM_CALL_TIMEOUT_MS);
  const usage = extractUsage(result);

  // If no outputSchema and no tools, extract content from AIMessage
  // When tools are provided, return the full AIMessage to preserve tool_calls
  if (!outputSchema && !tools && result && typeof result === 'object' && 'content' in result) {
    const rawContent = (result as { content: unknown }).content;
    if (typeof rawContent === 'string') {
      return { response: rawContent, usage };
    }
    // Thinking models (qwen3, deepseek-r1) return an array of content blocks:
    // [{type:'thinking', thinking:'...'}, {type:'text', text:'...'}]
    // Extract only the text blocks and join them.
    if (Array.isArray(rawContent)) {
      const text = rawContent
        .filter(
          (b): b is { type: string; text: string } =>
            typeof b === 'object' &&
            b !== null &&
            (b as { type?: unknown }).type === 'text' &&
            typeof (b as { text?: unknown }).text === 'string',
        )
        .map((b) => b.text)
        .join('');
      return { response: text, usage };
    }
  }
  return { response: result as AIMessage, usage };
}

/**
 * Stateful filter that strips <think>…</think> blocks from a character stream.
 * Yields only the non-thinking content as chunks arrive.
 */
class StreamingThinkFilter {
  private buf = '';
  private thinking = false;
  private readonly OPEN = '<think>';
  private readonly CLOSE = '</think>';

  process(text: string): string {
    let out = '';
    this.buf += text;
    while (this.buf.length > 0) {
      if (this.thinking) {
        const closeAt = this.buf.indexOf(this.CLOSE);
        if (closeAt === -1) {
          // Still inside thinking block — keep only what can't be a partial close tag
          const safe = this.buf.length - this.CLOSE.length;
          if (safe > 0) this.buf = this.buf.slice(safe);
          break;
        }
        this.buf = this.buf.slice(closeAt + this.CLOSE.length);
        this.thinking = false;
      } else {
        const openAt = this.buf.indexOf(this.OPEN);
        if (openAt === -1) {
          // Check if the tail could be a partial <think> tag
          let partialLen = 0;
          for (let i = 1; i < this.OPEN.length; i++) {
            if (this.buf.endsWith(this.OPEN.slice(0, i))) {
              partialLen = i;
            }
          }
          out += this.buf.slice(0, this.buf.length - partialLen);
          this.buf = this.buf.slice(this.buf.length - partialLen);
          break;
        }
        out += this.buf.slice(0, openAt);
        this.buf = this.buf.slice(openAt + this.OPEN.length);
        this.thinking = true;
      }
    }
    return out;
  }

  flush(): string {
    if (this.thinking) { this.buf = ''; return ''; }
    const remaining = this.buf;
    this.buf = '';
    return remaining;
  }
}

/**
 * Stream the LLM response token by token, yielding non-empty text chunks.
 * Strips <think>…</think> blocks from thinking models (qwen3, deepseek-r1).
 * Does NOT support tool-call binding — for final answer generation only.
 */
export async function* streamCallLlm(
  prompt: string,
  options: Omit<CallLlmOptions, 'tools' | 'outputSchema'> = {},
): AsyncGenerator<string> {
  const { model = DEFAULT_MODEL, systemPrompt, signal, thinkOverride } = options;
  const finalSystemPrompt = systemPrompt ?? getDefaultSystemPrompt();
  const llm = getChatModel(model, false, thinkOverride);
  const provider = resolveProvider(model);

  const messages =
    provider.id === 'anthropic'
      ? buildAnthropicMessages(finalSystemPrompt, prompt)
      : [new SystemMessage(finalSystemPrompt), new HumanMessage(prompt)];

  const filter = new StreamingThinkFilter();
  const stream = await llm.stream(messages, signal ? { signal } : {});

  // Buffer tokens until we reach a word boundary so the TUI receives
  // meaningful chunks rather than single characters or random 6-byte slices.
  // This makes streaming feel 3-4× more responsive on fast models.
  let wordBuffer = '';

  for await (const chunk of stream) {
    const content = chunk.content;
    let text = '';
    if (typeof content === 'string') {
      text = content;
    } else if (Array.isArray(content)) {
      text = content
        .filter(
          (b): b is { type: string; text: string } =>
            typeof b === 'object' && b !== null && b.type === 'text' && typeof b.text === 'string',
        )
        .map((b) => b.text)
        .join('');
    }
    if (!text) continue;
    const filtered = filter.process(text);
    if (!filtered) continue;

    wordBuffer += filtered;

    // Yield at the last whitespace boundary so we always emit complete words.
    // Using the last boundary (not first) keeps chunks reasonably large.
    const lastBoundary = Math.max(
      wordBuffer.lastIndexOf(' '),
      wordBuffer.lastIndexOf('\n'),
      wordBuffer.lastIndexOf('\t'),
    );
    if (lastBoundary >= 0) {
      yield wordBuffer.slice(0, lastBoundary + 1);
      wordBuffer = wordBuffer.slice(lastBoundary + 1);
    }
  }

  // Flush any remaining text (last word/sentence may not end with whitespace)
  const remaining = filter.flush();
  const finalBuffer = wordBuffer + (remaining ?? '');
  if (finalBuffer) yield finalBuffer;
}
