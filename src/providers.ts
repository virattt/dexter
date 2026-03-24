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
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    displayName: 'OpenAI',
    modelPrefix: '',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    fastModel: 'gpt-4.1',
  },
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    modelPrefix: 'claude-',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    fastModel: 'claude-haiku-4-5',
  },
  {
    id: 'google',
    displayName: 'Google',
    modelPrefix: 'gemini-',
    apiKeyEnvVar: 'GOOGLE_API_KEY',
    fastModel: 'gemini-3-flash-preview',
  },
  {
    id: 'xai',
    displayName: 'xAI',
    modelPrefix: 'grok-',
    apiKeyEnvVar: 'XAI_API_KEY',
    fastModel: 'grok-4-1-fast-reasoning',
  },
  {
    id: 'moonshot',
    displayName: 'Moonshot',
    modelPrefix: 'kimi-',
    apiKeyEnvVar: 'MOONSHOT_API_KEY',
    fastModel: 'kimi-k2-5',
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    modelPrefix: 'deepseek-',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    fastModel: 'deepseek-chat',
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    modelPrefix: 'openrouter:',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    fastModel: 'openrouter:openai/gpt-4o-mini',
  },
  {
    id: 'ollama',
    displayName: 'Ollama',
    modelPrefix: 'ollama:',
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
