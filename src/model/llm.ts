import { AIMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StructuredToolInterface } from '@langchain/core/tools';
import { Runnable } from '@langchain/core/runnables';
import { z } from 'zod';
import { DEFAULT_SYSTEM_PROMPT } from '@/agent/prompts';
import type { TokenUsage } from '@/agent/types';
import { logger } from '@/utils';
import { resolveProvider, getProviderById } from '@/providers';
import {
  getOpenAIAuthMode,
  getValidOpenAIOAuthCredentials,
  hasOpenAIOAuthCredentials,
  isOpenAIOAuthModelRequired,
  isOpenAIOAuthModelSupported,
} from '@/utils/openai-oauth';

export const DEFAULT_PROVIDER = 'openai';
export const DEFAULT_MODEL = 'gpt-5.2';

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
      logger.error(`[${provider} API] error (attempt ${attempt + 1}/${maxAttempts}): ${message}`);

      if (attempt === maxAttempts - 1) {
        throw new Error(`[${provider} API] ${message}`);
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}

// Model provider configuration
interface ModelOpts {
  streaming: boolean;
}

type ModelFactory = (name: string, opts: ModelOpts) => BaseChatModel;

const OPENAI_CODEX_RESPONSES_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses';
const OPENAI_OAUTH_DUMMY_KEY = 'oauth-placeholder';

function getApiKey(envVar: string): string {
  const apiKey = process.env[envVar];
  if (!apiKey) {
    throw new Error(`${envVar} not found in environment variables`);
  }
  return apiKey;
}

function hasOpenAIApiKeyConfigured(): boolean {
  const value = process.env.OPENAI_API_KEY;
  return Boolean(value && value.trim() && !value.trim().startsWith('your-'));
}

function parseRequestUrl(requestInput: RequestInfo | URL): URL {
  if (requestInput instanceof URL) {
    return new URL(requestInput.toString());
  }
  if (requestInput instanceof Request) {
    return new URL(requestInput.url);
  }
  return new URL(requestInput);
}

function shouldRewriteOpenAIUrl(url: URL): boolean {
  return url.pathname.includes('/v1/responses') || url.pathname.includes('/chat/completions');
}

function mergeHeaders(requestInput: RequestInfo | URL, init?: RequestInit): Headers {
  const headers = new Headers();

  if (requestInput instanceof Request) {
    requestInput.headers.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  if (init?.headers) {
    const incoming = new Headers(init.headers);
    incoming.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function extractTextFromMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  const parts: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const record = item as Record<string, unknown>;
    const text = record.text;
    if (typeof text === 'string' && text.trim()) {
      parts.push(text.trim());
    }
  }

  return parts.join('\n');
}

async function normalizeCodexRequestBody(
  requestInput: RequestInfo | URL,
  init?: RequestInit,
): Promise<BodyInit | null | undefined> {
  const rawBody = (() => {
    if (typeof init?.body === 'string') {
      return init.body;
    }
    if (requestInput instanceof Request) {
      return null;
    }
    return null;
  })();

  const bodyText = rawBody ?? (requestInput instanceof Request ? await requestInput.clone().text() : '');
  if (!bodyText) {
    return init?.body;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return init?.body;
  }

  if (!parsed || typeof parsed !== 'object') {
    return init?.body;
  }

  const body = parsed as Record<string, unknown>;
  const input = Array.isArray(body.input) ? body.input : null;

  if (!body.instructions && input) {
    const instructionParts: string[] = [];
    const filteredInput: unknown[] = [];

    for (const item of input) {
      if (!item || typeof item !== 'object') {
        filteredInput.push(item);
        continue;
      }

      const record = item as Record<string, unknown>;
      const role = record.role;

      if (role === 'system' || role === 'developer') {
        const text = extractTextFromMessageContent(record.content);
        if (text) {
          instructionParts.push(text);
        }
        continue;
      }

      filteredInput.push(item);
    }

    if (instructionParts.length > 0) {
      body.instructions = instructionParts.join('\n\n');
      body.input = filteredInput;
    }
  }

  if (body.store !== false) {
    body.store = false;
  }

  if (body.stream !== true) {
    body.stream = true;
  }

  return JSON.stringify(body);
}

function createOpenAIOAuthFetch(): typeof fetch {
  const oauthFetch = (async (requestInput: RequestInfo | URL, init?: RequestInit) => {
    const credentials = await getValidOpenAIOAuthCredentials();
    if (!credentials) {
      throw new Error('OpenAI OAuth credentials are missing. Run /model and login again.');
    }

    const headers = mergeHeaders(requestInput, init);
    headers.set('authorization', `Bearer ${credentials.accessToken}`);
    headers.delete('x-api-key');
    if (credentials.accountId) {
      headers.set('ChatGPT-Account-Id', credentials.accountId);
    }
    headers.set('originator', 'dexter');

    const originalUrl = parseRequestUrl(requestInput);
    const finalUrl = shouldRewriteOpenAIUrl(originalUrl)
      ? new URL(OPENAI_CODEX_RESPONSES_ENDPOINT)
      : originalUrl;

    const isCodexRequest = finalUrl.toString() === OPENAI_CODEX_RESPONSES_ENDPOINT;
    const normalizedBody = isCodexRequest
      ? await normalizeCodexRequestBody(requestInput, init)
      : init?.body;
    if (isCodexRequest && normalizedBody !== undefined) {
      headers.delete('content-length');
    }

    const finalInput =
      requestInput instanceof Request
        ? new Request(finalUrl.toString(), requestInput)
        : finalUrl;

    return fetch(finalInput, {
      ...init,
      headers,
      ...(normalizedBody !== undefined ? { body: normalizedBody } : {}),
    });
  }) as typeof fetch;

  return oauthFetch;
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
  ollama: (name, opts) =>
    new ChatOllama({
      model: name.replace(/^ollama:/, ''),
      ...opts,
      ...(process.env.OLLAMA_BASE_URL ? { baseUrl: process.env.OLLAMA_BASE_URL } : {}),
    }),
};

const DEFAULT_FACTORY: ModelFactory = (name, opts) => {
  const hasApiKey = hasOpenAIApiKeyConfigured();
  const hasOauth = hasOpenAIOAuthCredentials();
  const preferredMode = getOpenAIAuthMode();
  const shouldUseOauth = hasOauth && (preferredMode === 'oauth' || !hasApiKey);
  const oauthRequired = isOpenAIOAuthModelRequired(name);

  if (oauthRequired && !shouldUseOauth) {
    throw new Error(`${name} requires OpenAI OAuth. Run /model and sign in with OpenAI OAuth.`);
  }

  if (shouldUseOauth) {
    if (isOpenAIOAuthModelSupported(name)) {
      return new ChatOpenAI({
        model: name,
        ...opts,
        streaming: true,
        useResponsesApi: true,
        zdrEnabled: true,
        apiKey: OPENAI_OAUTH_DUMMY_KEY,
        configuration: {
          fetch: createOpenAIOAuthFetch(),
        },
      });
    }

    if (!hasApiKey) {
      throw new Error(`OpenAI OAuth supports Codex models only (for example: gpt-5.3-codex). Selected model: ${name}`);
    }
  }

  return new ChatOpenAI({
    model: name,
    ...opts,
    apiKey: getApiKey('OPENAI_API_KEY'),
  });
};

export function getChatModel(
  modelName: string = DEFAULT_MODEL,
  streaming: boolean = false
): BaseChatModel {
  const opts: ModelOpts = { streaming };
  const provider = resolveProvider(modelName);
  const factory = MODEL_FACTORIES[provider.id] ?? DEFAULT_FACTORY;
  return factory(modelName, opts);
}

interface CallLlmOptions {
  model?: string;
  systemPrompt?: string;
  outputSchema?: z.ZodType<unknown>;
  tools?: StructuredToolInterface[];
  signal?: AbortSignal;
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

function extractTextFromLlmContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object') {
          const text = (item as Record<string, unknown>).text;
          if (typeof text === 'string') {
            return text;
          }
        }
        return '';
      })
      .join('');
  }

  return '';
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
  const { model = DEFAULT_MODEL, systemPrompt, outputSchema, tools, signal } = options;
  const finalSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const llm = getChatModel(model, false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runnable: Runnable<any, any> = llm;

  if (outputSchema) {
    runnable = llm.withStructuredOutput(outputSchema, { strict: false });
  } else if (tools && tools.length > 0 && llm.bindTools) {
    runnable = llm.bindTools(tools);
  }

  const invokeOpts = signal ? { signal } : undefined;
  const provider = resolveProvider(model);
  let result;

  if (provider.id === 'anthropic') {
    // Anthropic: use explicit messages with cache_control for prompt caching (~90% savings)
    const messages = buildAnthropicMessages(finalSystemPrompt, prompt);
    result = await withRetry(() => runnable.invoke(messages, invokeOpts), provider.displayName);
  } else {
    // Other providers: use ChatPromptTemplate (OpenAI/Gemini have automatic caching)
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ['system', finalSystemPrompt],
      ['user', '{prompt}'],
    ]);
    const chain = promptTemplate.pipe(runnable);
    result = await withRetry(() => chain.invoke({ prompt }, invokeOpts), provider.displayName);
  }
  const usage = extractUsage(result);

  // If no outputSchema and no tools, extract content from AIMessage
  // When tools are provided, return the full AIMessage to preserve tool_calls
  if (!outputSchema && !tools && result && typeof result === 'object' && 'content' in result) {
    const content = extractTextFromLlmContent((result as { content: unknown }).content);
    return { response: content, usage };
  }
  return { response: result as AIMessage, usage };
}
