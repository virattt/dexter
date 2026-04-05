#!/usr/bin/env node
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { buildSystemPrompt, loadRulesDocument, loadSoulDocument } from '../src/agent/prompts.js';
import { getToolRegistry } from '../src/tools/registry.js';

config({ quiet: true });

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

type Args = {
  sessionKey: string;
  model: string;
  query: string;
};

type ToolCallBlock = {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

type TextBlock = {
  type: 'text';
  text: string;
};

type AssistantMessage = {
  role: 'assistant';
  content: Array<TextBlock | ToolCallBlock | Record<string, unknown>>;
  stopReason?: string;
  errorMessage?: string;
  timestamp?: number;
};

type ToolResultMessage = {
  role: 'toolResult';
  toolCallId: string;
  toolName: string;
  content: TextBlock[];
  isError: boolean;
  timestamp: number;
};

type ContextMessage =
  | {
      role: 'user';
      content: string;
      timestamp: number;
    }
  | AssistantMessage
  | ToolResultMessage;

type PiTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type PiContext = {
  systemPrompt: string;
  messages: ContextMessage[];
  tools: PiTool[];
};

type CompleteOptions = {
  apiKey: string;
  maxTokens?: number;
  sessionId?: string;
  transport?: 'sse' | 'fetch';
  reasoning?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
};

type PiAiModule = {
  complete: (model: unknown, context: PiContext, options: CompleteOptions) => Promise<AssistantMessage>;
  getModel: (provider: string, model: string) => unknown;
};

type OAuthModule = {
  getOAuthApiKey: (
    provider: string,
    profiles: Record<string, OAuthProfile>,
  ) => Promise<{ apiKey: string; newCredentials?: Partial<OAuthProfile> } | null>;
};

const OPENCLAW_ROOT_CANDIDATES = [
  path.join(homedir(), '.npm-global/lib/node_modules/openclaw'),
  '/usr/lib/node_modules/openclaw',
];
const AUTH_STORE_PATH = path.join(homedir(), '.openclaw/agents/main/agent/auth-profiles.json');
const DEFAULT_SESSION = 'dexter:openclaw';
const DEFAULT_MODEL = process.env.DEXTER_OPENCLAW_MODEL || 'gpt-5.4';
const MAX_ITERATIONS = 10;
const MUTATING_TOOLS = new Set(['write_file', 'edit_file', 'heartbeat', 'cron', 'memory_update', 'skill']);

function parseArgs(argv: string[]): Args {
  let sessionKey = DEFAULT_SESSION;
  let model = DEFAULT_MODEL;
  const queryParts: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--session' && next) {
      sessionKey = next;
      i += 1;
      continue;
    }
    if (arg === '--model' && next) {
      model = next;
      i += 1;
      continue;
    }

    queryParts.push(arg);
  }

  return {
    sessionKey,
    model,
    query: queryParts.join(' ').trim(),
  };
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

function resolvePiAiModulePath(relativePath: string): string {
  for (const root of OPENCLAW_ROOT_CANDIDATES) {
    const candidate = path.join(root, relativePath);
    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  throw new Error(
    'OpenClaw の pi-ai モジュールが見つかりません。openclaw のインストール場所を確認してください。',
  );
}

async function loadPiAiModule(): Promise<PiAiModule> {
  const href = resolvePiAiModulePath('node_modules/@mariozechner/pi-ai/dist/index.js');
  return import(href) as Promise<PiAiModule>;
}

async function loadOAuthModule(): Promise<OAuthModule> {
  const href = resolvePiAiModulePath('node_modules/@mariozechner/pi-ai/dist/oauth.js');
  return import(href) as Promise<OAuthModule>;
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
    .filter(([, profile]) => profile?.provider === 'openai-codex' && profile?.type === 'oauth')
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

      const auth = await getOAuthApiKey('openai-codex', { 'openai-codex': profile });
      if (!auth) continue;

      const refreshed: OAuthProfile = {
        ...profile,
        ...auth.newCredentials,
        provider: 'openai-codex',
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

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(
      value,
      (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner),
      2,
    );
  } catch {
    return String(value);
  }
}

function isToolCallBlock(block: unknown): block is ToolCallBlock {
  return !!block && typeof block === 'object' && (block as { type?: unknown }).type === 'toolCall';
}

function isTextBlock(block: unknown): block is TextBlock {
  return !!block && typeof block === 'object' && (block as { type?: unknown }).type === 'text';
}

function toolNamesSummary(toolNames: string[]): string {
  if (toolNames.length === 0) return 'No tools.';
  return `Available tools: ${toolNames.join(', ')}`;
}

function buildToolList(model: string): { toolMap: Map<string, { invoke: (args: Record<string, unknown>) => Promise<unknown> }>; tools: PiTool[] } {
  const allowMutations = process.env.DEXTER_OPENCLAW_ENABLE_MUTATIONS === '1';
  const registered = getToolRegistry(model).filter((entry) => allowMutations || !MUTATING_TOOLS.has(entry.name));

  const toolMap = new Map(
    registered.map((entry) => [entry.name, { invoke: (args: Record<string, unknown>) => entry.tool.invoke(args) }]),
  );

  const tools = registered.map((entry) => ({
    name: entry.name,
    description: entry.tool.description,
    parameters: z.toJSONSchema(entry.tool.schema) as Record<string, unknown>,
  }));

  return { toolMap, tools };
}

function appendBridgeInstructions(systemPrompt: string, toolNames: string[]): string {
  const mutationMode = process.env.DEXTER_OPENCLAW_ENABLE_MUTATIONS === '1'
    ? 'Mutation-capable tools are enabled for this run.'
    : 'This OpenClaw bridge is read-only by default; write/edit/cron/memory mutation tools are disabled unless DEXTER_OPENCLAW_ENABLE_MUTATIONS=1.';

  return [
    systemPrompt,
    '',
    '## OpenClaw bridge notes',
    `- ${mutationMode}`,
    '- Use the provided tools when data is needed; do not claim to have used a tool unless you actually called it.',
    '- If a required external API key is missing, explain the blocker plainly.',
    `- ${toolNamesSummary(toolNames)}`,
  ].join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const stdinQuery = await readStdin();
  const query = args.query || stdinQuery;

  if (!query) {
    console.error('Usage: bun run ask:openclaw -- [--session key] [--model gpt-5.4] "your question"');
    process.exitCode = 1;
    return;
  }

  const apiKey = await getOpenClawCodexApiKey();
  const { complete, getModel } = await loadPiAiModule();
  const soul = await loadSoulDocument();
  const rules = await loadRulesDocument();
  const { toolMap, tools } = buildToolList(args.model);
  const systemPrompt = appendBridgeInstructions(
    buildSystemPrompt(args.model, soul, 'cli', undefined, [], null, rules),
    tools.map((tool) => tool.name),
  );

  const model = getModel('openai-codex', args.model);
  const context: PiContext = {
    systemPrompt,
    messages: [
      {
        role: 'user',
        content: query,
        timestamp: Date.now(),
      },
    ],
    tools,
  };

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const response = await complete(model, context, {
      apiKey,
      maxTokens: 4_000,
      sessionId: args.sessionKey,
      transport: 'sse',
      reasoning: 'high',
    });

    context.messages.push(response);

    if (response.stopReason === 'error' || response.stopReason === 'aborted') {
      throw new Error(response.errorMessage || 'OpenClaw Codex request failed');
    }

    const toolCalls = response.content.filter(isToolCallBlock);
    if (toolCalls.length === 0) {
      const text = response.content
        .filter(isTextBlock)
        .map((block) => block.text || '')
        .join('')
        .trim();

      if (text) {
        process.stdout.write(`${text}\n`);
        return;
      }

      process.stdout.write(`${safeStringify(response.content)}\n`);
      return;
    }

    for (const toolCall of toolCalls) {
      const tool = toolMap.get(toolCall.name);
      if (!tool) {
        context.messages.push({
          role: 'toolResult',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: [{ type: 'text', text: safeStringify({ error: `Unknown tool: ${toolCall.name}` }) }],
          isError: true,
          timestamp: Date.now(),
        });
        continue;
      }

      try {
        const result = await tool.invoke(toolCall.arguments);
        context.messages.push({
          role: 'toolResult',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: [{ type: 'text', text: safeStringify(result) }],
          isError: false,
          timestamp: Date.now(),
        });
      } catch (error) {
        context.messages.push({
          role: 'toolResult',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: [
            {
              type: 'text',
              text: safeStringify({ error: error instanceof Error ? error.message : String(error) }),
            },
          ],
          isError: true,
          timestamp: Date.now(),
        });
      }
    }
  }

  throw new Error(`Reached maximum iterations (${MAX_ITERATIONS}) without a final answer.`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
