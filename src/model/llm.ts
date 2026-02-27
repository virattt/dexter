import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredToolInterface } from '@langchain/core/tools';
import { Runnable } from '@langchain/core/runnables';
import { z } from 'zod';
import { resolveProvider } from '../providers.js';
import { DEFAULT_SYSTEM_PROMPT } from '../agent/prompts.js';
import type { TokenUsage } from '../agent/types.js';

export const DEFAULT_PROVIDER = 'openai';
export const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Generic retry helper with exponential backoff
 */
async function withRetry<T>(fn: () => Promise<T>, provider: string, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[${provider} API] error (attempt ${attempt + 1}/${maxAttempts}): ${message}`);

      if (attempt === maxAttempts - 1) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}

/**
 * Get API key from overrides or environment variables.
 */
function getApiKey(envVar: string, overrides?: Record<string, string>): string {
  const apiKey = overrides?.[envVar] || process.env[envVar];
  if (!apiKey) {
    throw new Error(`[LLM] ${envVar} not found in environment variables or client overrides`);
  }
  return apiKey;
}

/**
 * Interface for model options
 */
interface ModelOpts {
  streaming: boolean;
  apiKeys?: Record<string, string>;
}

/**
 * Factory functions for and routing to LLM providers
 */
const MODEL_FACTORIES: Record<string, (name: string, opts: ModelOpts) => BaseChatModel> = {
  openai: (name, opts) =>
    new ChatOpenAI({
      model: name,
      ...opts,
      apiKey: getApiKey('OPENAI_API_KEY', opts.apiKeys),
    }),
  anthropic: (name, opts) =>
    new ChatAnthropic({
      model: name,
      ...opts,
      apiKey: getApiKey('ANTHROPIC_API_KEY', opts.apiKeys),
    }),
  google: (name, opts) =>
    new ChatGoogleGenerativeAI({
      model: name,
      ...opts,
      apiKey: getApiKey('GOOGLE_API_KEY', opts.apiKeys),
    }),
  openrouter: (name, opts) => {
    // OpenRouter IDs can look like 'openrouter:openai/gpt-4o' or just 'openai/gpt-4o'
    const modelId = name.replace(/^(openrouter:|openrouter\/)/, '');
    return new ChatOpenAI({
      model: modelId,
      ...opts,
      apiKey: getApiKey('OPENROUTER_API_KEY', opts.apiKeys),
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/virattt/dexter',
          'X-Title': 'Dexter',
        },
      },
    });
  },
  ollama: (name, opts) =>
    new ChatOllama({
      model: name.replace(/^ollama:/, ''),
      ...opts,
      ...(process.env.OLLAMA_BASE_URL ? { baseUrl: process.env.OLLAMA_BASE_URL } : {}),
    }),
};

/**
 * Creates a LangChain chat model based on the provider and model name.
 */
export function createLLM(config: {
  model?: string;
  provider?: string;
  streaming?: boolean;
  apiKeys?: Record<string, string>;
}): BaseChatModel {
  const model = config.model || DEFAULT_MODEL;

  // Use provided provider, otherwise resolve from model name
  let providerId = config.provider;
  if (!providerId) {
    const providerDef = resolveProvider(model);
    providerId = providerDef.id;
  }

  const factory = MODEL_FACTORIES[providerId] || MODEL_FACTORIES.openai;

  return factory(model, {
    streaming: config.streaming || false,
    apiKeys: config.apiKeys,
  });
}

/**
 * Backward compatibility aliases
 */
export const getChatModel = (modelName?: string, streaming?: boolean, apiKeys?: Record<string, string>) =>
  createLLM({ model: modelName, streaming, apiKeys });

interface CallLlmOptions {
  model?: string;
  systemPrompt?: string;
  outputSchema?: z.ZodType<unknown>;
  tools?: StructuredToolInterface[];
  signal?: AbortSignal;
  apiKeys?: Record<string, string>;
}

export interface LlmResult {
  response: AIMessage | string;
  usage?: TokenUsage;
}

/**
 * Helper to extract token usage from various provider response formats.
 */
function extractUsage(result: any): TokenUsage | undefined {
  if (!result || typeof result !== 'object') return undefined;

  const usageMetadata = result.usage_metadata;
  if (usageMetadata) {
    return {
      inputTokens: usageMetadata.input_tokens || 0,
      outputTokens: usageMetadata.output_tokens || 0,
      totalTokens: usageMetadata.total_tokens || (usageMetadata.input_tokens + usageMetadata.output_tokens) || 0,
    };
  }

  const responseMetadata = result.response_metadata;
  if (responseMetadata?.usage) {
    const u = responseMetadata.usage;
    return {
      inputTokens: u.prompt_tokens || 0,
      outputTokens: u.completion_tokens || 0,
      totalTokens: u.total_tokens || (u.prompt_tokens + u.completion_tokens) || 0,
    };
  }

  return undefined;
}

/**
 * High-level helper to call an LLM with optional schema or tools.
 */
export async function callLlm(prompt: string, options: CallLlmOptions = {}): Promise<LlmResult> {
  const { model = DEFAULT_MODEL, systemPrompt = DEFAULT_SYSTEM_PROMPT, outputSchema, tools, signal, apiKeys } = options;

  const llm = createLLM({ model, apiKeys });

  let runnable: Runnable<any, any> = llm;
  if (outputSchema) {
    runnable = llm.withStructuredOutput(outputSchema);
  } else if (tools && tools.length > 0 && llm.bindTools) {
    runnable = llm.bindTools(tools);
  }

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['user', '{prompt}'],
  ]);

  const chain = promptTemplate.pipe(runnable);
  const provider = resolveProvider(model);

  const result = await withRetry(
    () => chain.invoke({ prompt }, { signal }),
    provider.displayName
  );

  const usage = extractUsage(result);

  if (!outputSchema && !tools && result && typeof result === 'object' && 'content' in result) {
    return { response: result.content as string, usage };
  }

  return { response: result as AIMessage, usage };
}
