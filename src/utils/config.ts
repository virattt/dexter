import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { dexterPath } from './paths.js';

const SETTINGS_FILE = dexterPath('settings.json');

// Map legacy model IDs to provider IDs for migration
const MODEL_TO_PROVIDER_MAP: Record<string, string> = {
  'gpt-5.4': 'openai',
  'gpt-5.2': 'openai',
  'claude-sonnet-4-5': 'anthropic',
  'gemini-3': 'google',
};

// Deprecated model IDs to upgrade on load
const DEPRECATED_MODEL_UPGRADES: Record<string, string> = {
  'gpt-5.2': 'gpt-5.4',
};

export interface SearchConfig {
  /** Preferred search provider. "auto" uses first available key (exa → perplexity → tavily). */
  provider?: 'exa' | 'perplexity' | 'tavily' | 'auto';
  /** Number of results to return (default: 5) */
  numResults?: number;
  /** Include content highlights in results (default: true) */
  highlights?: boolean;
}

export interface EvalConfig {
  /** Model used for the target agent in evals (default: uses settings.modelId) */
  model?: string;
  /** Model used for the LLM-as-judge evaluator */
  evaluatorModel?: string;
  /** Provider for the evaluator LLM (default: uses settings.provider) */
  evaluatorProvider?: 'openai' | 'anthropic' | 'google';
}

interface Config {
  provider?: string;
  modelId?: string;  // Selected model ID (e.g., "gpt-5.4", "ollama:llama3.1")
  model?: string;    // Legacy key, kept for migration
  memory?: {
    enabled?: boolean;
    embeddingProvider?: 'openai' | 'gemini' | 'ollama' | 'auto';
    embeddingModel?: string;
    maxSessionContextTokens?: number;
  };
  search?: SearchConfig;
  eval?: EvalConfig;
  [key: string]: unknown;
}

export function loadConfig(): Config {
  if (!existsSync(SETTINGS_FILE)) {
    return {};
  }

  try {
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    let config = JSON.parse(content) as Config;

    // Upgrade deprecated model IDs (e.g. gpt-5.2 -> gpt-5.4)
    if (config.modelId && DEPRECATED_MODEL_UPGRADES[config.modelId]) {
      config.modelId = DEPRECATED_MODEL_UPGRADES[config.modelId];
      saveConfig(config);
    }

    return config;
  } catch {
    return {};
  }
}

export function saveConfig(config: Config): boolean {
  try {
    const dir = dirname(SETTINGS_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(SETTINGS_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Migrates legacy `model` setting to `provider` setting.
 * Called once on config load to ensure backwards compatibility.
 */
function migrateModelToProvider(config: Config): Config {
  // If already has provider, no migration needed
  if (config.provider) {
    return config;
  }

  // If has legacy model setting, convert to provider
  if (config.model) {
    const providerId = MODEL_TO_PROVIDER_MAP[config.model];
    if (providerId) {
      config.provider = providerId;
      delete config.model;
      // Save the migrated config
      saveConfig(config);
    }
  }

  return config;
}

export function getSetting<T>(key: string, defaultValue: T): T {
  let config = loadConfig();
  
  // Run migration if accessing provider setting
  if (key === 'provider') {
    config = migrateModelToProvider(config);
  }
  
  return (config[key] as T) ?? defaultValue;
}

/**
 * Get search configuration with defaults.
 */
export function getSearchConfig(): Required<SearchConfig> {
  const config = loadConfig();
  const search = config.search ?? {};
  return {
    provider: search.provider ?? 'auto',
    numResults: search.numResults ?? 5,
    highlights: search.highlights ?? true,
  };
}

/**
 * Get eval configuration with defaults.
 */
export function getEvalConfig(): EvalConfig {
  const config = loadConfig();
  return config.eval ?? {};
}

export function setSetting(key: string, value: unknown): boolean {
  const config = loadConfig();
  config[key] = value;
  
  // If setting provider, remove legacy model key
  if (key === 'provider' && config.model) {
    delete config.model;
  }
  
  return saveConfig(config);
}
