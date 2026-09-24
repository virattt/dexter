/**
 * Canonical provider registry — single source of truth for all provider metadata.
 * When adding a new provider, add a single entry here; all other modules derive from this.
 */

export interface ProviderDef {
  /** Slug used in config/settings (e.g., 'anthropic') */
  id: string;
  /** Human-readable name (e.g., 'Anthropic') */
  displayName: string;
  /** Model name prefix used for routing (e.g., 'claude-'). Empty string for default (OpenAI). */
  modelPrefix: string;
  /** Environment variable name for API key. Omit for local providers (e.g., Ollama). */
  apiKeyEnvVar?: string;
  /** Fast model variant for lightweight tasks like summarization. */
  fastModel?: string;
  /** Default context window size in tokens. Used for model-aware compaction thresholds. */
  contextWindow?: number;
  /** Default OpenAI-compatible base URL for hosted providers. */
  openAIBaseUrl?: string;
  /** Default Anthropic-compatible base URL for hosted providers. */
  anthropicBaseUrl?: string;
  /** Region-specific hosted API endpoints. */
  regionalEndpoints?: ProviderRegionalEndpoint[];
  /** Provider-owned model metadata used by the model selector. */
  models?: ProviderModelDef[];
}

export interface ProviderRegionalEndpoint {
  region: 'global_en' | 'cn_zh';
  openAIBaseUrl: string;
  anthropicBaseUrl?: string;
  docsRoot: string;
}

export interface ProviderModelDef {
  id: string;
  displayName: string;
  contextWindow: number;
  pricingUsdPerMillionTokens?: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number | null;
  };
  inputModalities?: string[];
  thinking?: string[];
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    displayName: 'OpenAI',
    modelPrefix: '',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    fastModel: 'gpt-6-luna',
    contextWindow: 1_047_576,
  },
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    modelPrefix: 'claude-',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    fastModel: 'claude-haiku-4-5',
    contextWindow: 1_000_000,
  },
  {
    id: 'google',
    displayName: 'Google',
    modelPrefix: 'gemini-',
    apiKeyEnvVar: 'GOOGLE_API_KEY',
    fastModel: 'gemini-3.8-flash',
    contextWindow: 1_000_000,
  },
  {
    id: 'xai',
    displayName: 'xAI',
    modelPrefix: 'grok-',
    apiKeyEnvVar: 'XAI_API_KEY',
    fastModel: 'grok-4.7',
    contextWindow: 500_000,
  },
  {
    id: 'moonshot',
    displayName: 'Moonshot',
    modelPrefix: 'kimi-',
    apiKeyEnvVar: 'MOONSHOT_API_KEY',
    fastModel: 'kimi-k3',
    contextWindow: 1_000_000,
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    modelPrefix: 'deepseek-',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    fastModel: 'deepseek-flash',
    contextWindow: 1_000_000,
  },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    modelPrefix: 'minimax:',
    apiKeyEnvVar: 'MINIMAX_API_KEY',
    fastModel: 'minimax:MiniMax-M2.7',
    contextWindow: 1_000_000,
    openAIBaseUrl: 'https://api.minimax.io/v1',
    anthropicBaseUrl: 'https://api.minimax.io/anthropic',
    regionalEndpoints: [
      {
        region: 'global_en',
        openAIBaseUrl: 'https://api.minimax.io/v1',
        anthropicBaseUrl: 'https://api.minimax.io/anthropic',
        docsRoot: 'https://platform.minimax.io/docs',
      },
      {
        region: 'cn_zh',
        openAIBaseUrl: 'https://api.minimaxi.com/v1',
        anthropicBaseUrl: 'https://api.minimaxi.com/anthropic',
        docsRoot: 'https://platform.minimaxi.com/docs',
      },
    ],
    models: [
      {
        id: 'minimax:MiniMax-M3',
        displayName: 'MiniMax M3',
        contextWindow: 1_000_000,
        pricingUsdPerMillionTokens: {
          input: 0.6,
          output: 2.4,
          cacheRead: 0.12,
          cacheWrite: null,
        },
        inputModalities: ['text', 'image', 'video'],
        thinking: ['adaptive', 'disabled'],
      },
      {
        id: 'minimax:MiniMax-M2.7',
        displayName: 'MiniMax M2.7',
        contextWindow: 204_800,
        pricingUsdPerMillionTokens: {
          input: 0.3,
          output: 1.2,
          cacheRead: 0.06,
          cacheWrite: 0.375,
        },
        inputModalities: ['text'],
        thinking: ['always_on'],
      },
    ],
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    modelPrefix: 'openrouter:',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    fastModel: 'openrouter:openai/gpt-4o-mini',
    contextWindow: 128_000,
  },
  {
    id: 'ollama',
    displayName: 'Ollama',
    modelPrefix: 'ollama:',
    contextWindow: 128_000,
  },
  {
    id: 'ollama-cloud',
    displayName: 'Ollama Cloud',
    modelPrefix: 'ollama-cloud:',
    apiKeyEnvVar: 'OLLAMA_CLOUD_API_KEY',
    contextWindow: 128_000,
  },
];

const defaultProvider = PROVIDERS.find((p) => p.id === 'openai')!;

/**
 * Resolve the provider for a given model name based on its prefix.
 * Falls back to OpenAI when no prefix matches.
 */
export function resolveProvider(modelName: string): ProviderDef {
  return (
    PROVIDERS.find((p) => p.modelPrefix && modelName.startsWith(p.modelPrefix)) ??
    defaultProvider
  );
}

/**
 * Look up a provider by its slug (e.g., 'anthropic', 'google').
 */
export function getProviderById(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
