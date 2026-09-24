import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { dexterPath } from './paths.js';
import type { SearchProviderId } from './env.js';

const SETTINGS_FILE = dexterPath('settings.json');

// Map legacy model IDs to provider IDs for migration
const MODEL_TO_PROVIDER_MAP: Record<string, string> = {
  'gpt-5.6-sol': 'openai',
  'gpt-5.6-terra': 'openai',
  'gpt-5.6-luna': 'openai',
  'gpt-5.5': 'openai',
  'gpt-5.4': 'openai',
  'gpt-5.2': 'openai',
  'claude-sonnet-4-5': 'anthropic',
  'gemini-3': 'google',
};

// Deprecated model IDs to upgrade on load
const DEPRECATED_MODEL_UPGRADES: Record<string, string> = {
  'gpt-5.6-sol': 'gpt-6-sol',
  'gpt-5.6-terra': 'gpt-6-sol',
  'gpt-5.6-luna': 'gpt-6-luna',
  'gpt-5.5': 'gpt-6-astra',
  'gpt-5.4': 'gpt-6-astra',
  'gpt-5.2': 'gpt-6-astra',
  'claude-sonnet-4-6': 'claude-sonnet-5',
  'claude-opus-4-8': 'claude-opus-5-5',
  'claude-fable-5': 'claude-fable-5-1',
  'gemini-3-flash-preview': 'gemini-3.8-flash',
  'grok-4-0709': 'grok-4.7',
  'grok-4-1-fast-reasoning': 'grok-4.7',
  'kimi-k2-5': 'kimi-k3',
  'deepseek-v4-flash': 'deepseek-flash',
};

interface Config {
  provider?: string;
  modelId?: string;  // Selected model ID (e.g., "gpt-6-astra", "ollama:llama3.1")
  model?: string;    // Legacy key, kept for migration
  webSearchPreferredProvider?: SearchProviderId;
  memory?: {
    enabled?: boolean;
    embeddingProvider?: 'openai' | 'gemini' | 'ollama' | 'auto';
    embeddingModel?: string;
    maxSessionContextTokens?: number;
  };
  /** Bash permission rules (allow/ask/deny), persisted from the approval prompt. */
  permissions?: {
    allow?: string[];
    ask?: string[];
    deny?: string[];
    defaultBashDecision?: 'allow' | 'ask' | 'deny';
  };
  [key: string]: unknown;
}

export function loadConfig(): Config {
  if (!existsSync(SETTINGS_FILE)) {
    return {};
  }

  try {
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    let config = JSON.parse(content) as Config;

    // Upgrade deprecated model IDs (e.g. gpt-5.5 -> gpt-6-astra)
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

export function setSetting(key: string, value: unknown): boolean {
  const config = loadConfig();
  config[key] = value;
  
  // If setting provider, remove legacy model key
  if (key === 'provider' && config.model) {
    delete config.model;
  }
  
  return saveConfig(config);
}
