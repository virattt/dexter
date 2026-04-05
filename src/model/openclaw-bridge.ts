import { AIMessage, AIMessageChunk, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const OPENCLAW_PROVIDER_ID = 'openai-codex';
const OPENCLAW_MODEL_PREFIX = 'openai-codex:';
const OPENCLAW_ROOT_CANDIDATES = [
  process.env.OPENCLAW_ROOT,
  path.join(homedir(), '.npm-global/lib/node_modules/openclaw'),
  '/usr/lib/node_modules/openclaw',
].filter((value): value is string => !!value);
const AUTH_STORE_PATH = path.join(homedir(), '.openclaw/agents/main/agent/auth-profiles.json');

type OAuthProfile = {
  type: 'oauth';
  provider: string;
  access: string;
  refresh: string;
  expires: number;
  [key: string]: unknown;
};

type OAuthStore = {
  profiles?: Record<string, OAuthProfile>;
};

type PiTextContent = {
  type: 'text';
  text: string;
};

type PiToolCall = {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

type PiUserMessage = {
  role: 'user';
  content: string | PiTextContent[];
  timestamp: number;
};

type PiAssistantMessage = {
  role: 'assistant';
  content: Array<PiTextContent | PiToolCall | Record<string, unknown>>;
  provider: string;
  model: string;
  api: string;
  stopReason: 'stop' | 'length' | 'toolUse' | 'error' | 'aborted';
  errorMessage?: string;
  usage: {
    input: number;
    output: number;
    totalTokens: number;
  };
  timestamp: number;
};

type PiToolResultMessage = {
  role: 'toolResult';
  toolCallId: string;
  toolName: string;
  content: PiTextContent[];
  isError: boolean;
  timestamp: number;
};

type PiContext = {
  systemPrompt?: string;
  messages: Array<PiUserMessage | PiAssistantMessage | PiToolResultMessage>;
  tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
};

type PiModel = unknown;

type PiAiModule = {
  complete: (model: PiModel, context: PiContext, options?: PiCompleteOptions) => Promise<PiAssistantMessage>;
  getModel: (provider: string, model: string) => PiModel;
};

type OAuthModule = {
  getOAuthApiKey: (
    provider: string,
    profiles: Record<string, OAuthProfile>,
  ) => Promise<{ apiKey: string; newCredentials?: Partial<OAuthProfile> } | null>;
};

type PiCompleteOptions = {
  apiKey?: string;
  maxTokens?: number;
  signal?: AbortSignal;
  transport?: 'sse' | 'fetch';
  sessionId?: string;
  reasoning?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
};

export type OpenClawCallOptions = {
  model: string;
  signal?: AbortSignal;
  tools?: StructuredToolInterface[];
  systemPrompt?: string;
  prompt?: string;
  outputSchema?: z.ZodType<unknown>;
};

export function isOpenClawModel(modelName: string): boolean {
  return modelName.startsWith(OPENCLAW_MODEL_PREFIX);
}

export function normalizeOpenClawModel(modelName: string): string {
  return modelName.replace(/^openai-codex:/, '');
}

function resolvePiAiModulePath(relativePath: string): string {
  for (const root of OPENCLAW_ROOT_CANDIDATES) {
    const candidate = path.join(root, relativePath);
    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  throw new Error('OpenClaw の pi-ai モジュールが見つかりません。');
}

async function loadPiAiModule(): Promise<PiAiModule> {
  return import(resolvePiAiModulePath('node_modules/@mariozechner/pi-ai/dist/index.js')) as Promise<PiAiModule>;
}

async function loadOAuthModule(): Promise<OAuthModule> {
  return import(resolvePiAiModulePath('node_modules/@mariozechner/pi-ai/dist/oauth.js')) as Promise<OAuthModule>;
}

async function loadOAuthStore(): Promise<OAuthStore> {
  const raw = await readFile(AUTH_STORE_PATH, 'utf8');
  return JSON.parse(raw) as OAuthStore;
}

async function saveOAuthStore(store: OAuthStore): Promise<void> {
  await writeFile(AUTH_STORE_PATH, JSON.stringify(store, null, 2) + '\n', 'utf8');
}

function pickCodexProfiles(store: OAuthStore): Array<[string, OAuthProfile]> {
  return Object.entries(store.profiles ?? {})
    .filter(([, profile]) => profile?.provider === OPENCLAW_PROVIDER_ID && profile?.type === 'oauth')
    .sort((a, b) => {
      const aExpired = (a[1].expires ?? 0) <= Date.now();
      const bExpired = (b[1].expires ?? 0) <= Date.now();
      if (aExpired !== bExpired) {
        return aExpired ? 1 : -1;
      }
      return (b[1].expires ?? 0) - (a[1].expires ?? 0);
    });
}

async function getOpenClawCodexApiKey(): Promise<string> {
  const store = await loadOAuthStore();
  const candidates = pickCodexProfiles(store);

  if (candidates.length === 0) {
    throw new Error('OpenClaw の openai-codex OAuth プロファイルが見つかりません。');
  }

  const { getOAuthApiKey } = await loadOAuthModule();
  let lastError: unknown = null;

  for (const [profileId, profile] of candidates) {
    try {
      if ((profile.expires ?? 0) > Date.now() + 30_000 && profile.access) {
        return profile.access;
      }

      const auth = await getOAuthApiKey(OPENCLAW_PROVIDER_ID, { [OPENCLAW_PROVIDER_ID]: profile });
      if (!auth) continue;

      const refreshed: OAuthProfile = {
        ...profile,
        ...auth.newCredentials,
        provider: OPENCLAW_PROVIDER_ID,
        type: 'oauth',
      };

      store.profiles ??= {};
      store.profiles[profileId] = refreshed;
      await saveOAuthStore(store);
      return auth.apiKey;
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error');
  throw new Error(`OpenClaw OAuth の利用に失敗しました: ${message}`);
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        const block = item as { type?: string; text?: string };
        return block.type === 'text' && typeof block.text === 'string' ? block.text : '';
      })
      .join('');
  }
  return String(content ?? '');
}

function buildPiTools(tools?: StructuredToolInterface[]): PiContext['tools'] {
  if (!tools?.length) return undefined;
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: (z as unknown as { toJSONSchema: (schema: unknown) => Record<string, unknown> })
      .toJSONSchema(tool.schema as unknown),
  }));
}

function buildPiContext(messages: BaseMessage[], tools?: StructuredToolInterface[]): PiContext {
  const copied = [...messages];
  let systemPrompt: string | undefined;

  if (copied[0] instanceof SystemMessage) {
    systemPrompt = contentToText(copied.shift()?.content).trim();
  }

  const converted: Array<PiUserMessage | PiAssistantMessage | PiToolResultMessage> = [];

  for (const message of copied) {
    if (message instanceof HumanMessage) {
      converted.push({
        role: 'user',
        content: contentToText(message.content),
        timestamp: Date.now(),
      });
      continue;
    }

    if (message instanceof ToolMessage) {
      const toolCallId = (message as ToolMessage & { tool_call_id?: string }).tool_call_id;
      const toolName = ((message as ToolMessage & { name?: string }).name) ?? 'tool';
      const text = contentToText(message.content);
      converted.push({
        role: 'toolResult',
        toolCallId: toolCallId ?? toolName,
        toolName,
        content: [{ type: 'text', text }],
        isError: text.startsWith('Error:'),
        timestamp: Date.now(),
      });
      continue;
    }

    const aiMessage = message as AIMessage;
    const text = contentToText(aiMessage.content);
    const content: PiAssistantMessage['content'] = [];
    if (text) {
      content.push({ type: 'text', text });
    }
    for (const toolCall of aiMessage.tool_calls ?? []) {
      content.push({
        type: 'toolCall',
        id: toolCall.id ?? `${toolCall.name}-${content.length}`,
        name: toolCall.name,
        arguments: toolCall.args,
      });
    }
    converted.push({
      role: 'assistant',
      content,
      provider: OPENCLAW_PROVIDER_ID,
      model: 'gpt-5.4',
      api: 'openai-codex-responses',
      usage: { input: 0, output: 0, totalTokens: 0 },
      stopReason: content.some((item) => (item as { type?: string }).type === 'toolCall') ? 'toolUse' : 'stop',
      timestamp: Date.now(),
    });
  }

  return {
    systemPrompt,
    messages: converted,
    tools: buildPiTools(tools),
  };
}

function usageMetadataFromPi(usage?: PiAssistantMessage['usage']) {
  if (!usage) return undefined;
  return {
    input_tokens: usage.input ?? 0,
    output_tokens: usage.output ?? 0,
    total_tokens: usage.totalTokens ?? (usage.input ?? 0) + (usage.output ?? 0),
  };
}

function aiMessageFromPi(response: PiAssistantMessage): AIMessage {
  const text = response.content
    .filter((block): block is PiTextContent => !!block && typeof block === 'object' && block.type === 'text')
    .map((block) => block.text)
    .join('');

  const toolCalls = response.content
    .filter((block): block is PiToolCall => !!block && typeof block === 'object' && block.type === 'toolCall')
    .map((block) => ({
      id: block.id,
      name: block.name,
      args: block.arguments,
      type: 'tool_call' as const,
    }));

  return new AIMessage({
    content: text,
    tool_calls: toolCalls,
    invalid_tool_calls: [],
    usage_metadata: usageMetadataFromPi(response.usage),
    response_metadata: {
      api: response.api,
      provider: response.provider,
      model: response.model,
      stopReason: response.stopReason,
    },
  });
}

function aiChunkFromPi(response: PiAssistantMessage): AIMessageChunk {
  const message = aiMessageFromPi(response);
  return new AIMessageChunk({
    content: message.content,
    tool_calls: message.tool_calls,
    invalid_tool_calls: message.invalid_tool_calls,
    usage_metadata: message.usage_metadata,
    response_metadata: message.response_metadata,
  });
}

function extractJsonCandidate(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Structured output returned empty response');
  }

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // keep going
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  throw new Error('Could not find JSON in structured output response');
}

async function completeWithContext(context: PiContext, options: OpenClawCallOptions): Promise<PiAssistantMessage> {
  const apiKey = await getOpenClawCodexApiKey();
  const { complete, getModel } = await loadPiAiModule();
  const model = getModel(OPENCLAW_PROVIDER_ID, normalizeOpenClawModel(options.model));

  const response = await complete(model, context, {
    apiKey,
    maxTokens: 4_000,
    signal: options.signal,
    transport: 'sse',
    reasoning: 'high',
    sessionId: `dexter:${normalizeOpenClawModel(options.model)}`,
  });

  if (response.stopReason === 'error' || response.stopReason === 'aborted') {
    throw new Error(response.errorMessage || 'OpenClaw Codex request failed');
  }

  return response;
}

export async function callOpenClawPrompt(options: OpenClawCallOptions): Promise<{ response: unknown; usage?: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
  const { prompt, systemPrompt, outputSchema, tools } = options;
  const messages: BaseMessage[] = [];

  if (systemPrompt) {
    messages.push(new SystemMessage(systemPrompt));
  }
  messages.push(new HumanMessage(prompt ?? ''));

  if (outputSchema) {
    const schemaJson = JSON.stringify(z.toJSONSchema(outputSchema), null, 2);
    const structuredSystemPrompt = [
      systemPrompt ?? '',
      'Return ONLY valid JSON matching this schema.',
      'Do not include markdown fences or explanation.',
      schemaJson,
    ].filter(Boolean).join('\n\n');
    const structuredResponse = await completeWithContext(buildPiContext([
      new SystemMessage(structuredSystemPrompt),
      new HumanMessage(prompt ?? ''),
    ]), options);
    const text = structuredResponse.content
      .filter((block): block is PiTextContent => !!block && typeof block === 'object' && block.type === 'text')
      .map((block) => block.text)
      .join('');
    const parsed = JSON.parse(extractJsonCandidate(text));
    return {
      response: outputSchema.parse(parsed),
      usage: usageMetadataFromPi(structuredResponse.usage)
        ? {
            inputTokens: usageMetadataFromPi(structuredResponse.usage)!.input_tokens,
            outputTokens: usageMetadataFromPi(structuredResponse.usage)!.output_tokens,
            totalTokens: usageMetadataFromPi(structuredResponse.usage)!.total_tokens,
          }
        : undefined,
    };
  }

  if (tools?.length) {
    const response = await callOpenClawWithMessages(messages, options);
    return response;
  }

  const response = await completeWithContext(buildPiContext(messages), options);
  const text = response.content
    .filter((block): block is PiTextContent => !!block && typeof block === 'object' && block.type === 'text')
    .map((block) => block.text)
    .join('');

  return {
    response: text,
    usage: usageMetadataFromPi(response.usage)
      ? {
          inputTokens: usageMetadataFromPi(response.usage)!.input_tokens,
          outputTokens: usageMetadataFromPi(response.usage)!.output_tokens,
          totalTokens: usageMetadataFromPi(response.usage)!.total_tokens,
        }
      : undefined,
  };
}

export async function callOpenClawWithMessages(
  messages: BaseMessage[],
  options: OpenClawCallOptions,
): Promise<{ response: AIMessage; usage?: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
  const response = await completeWithContext(buildPiContext(messages, options.tools), options);
  const aiMessage = aiMessageFromPi(response);
  const usage = usageMetadataFromPi(response.usage);
  return {
    response: aiMessage,
    usage: usage
      ? {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          totalTokens: usage.total_tokens,
        }
      : undefined,
  };
}

export async function* streamOpenClawWithMessages(
  messages: BaseMessage[],
  options: OpenClawCallOptions,
): AsyncGenerator<AIMessageChunk, void> {
  const response = await completeWithContext(buildPiContext(messages, options.tools), options);
  yield aiChunkFromPi(response);
}
