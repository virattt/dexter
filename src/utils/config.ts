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
  maxIterations?: number;      // default 25, range 5-100
  contextThreshold?: number;   // default 100000, range 10000-500000
  keepToolUses?: number;       // default 5, range 2-20
  cacheTtlMs?: number;         // default 900000 (15min), range 60000-86400000
  parallelToolLimit?: number;  // default 0 (unlimited), range 0-10
  [key: string]: unknown;
}

// Validation rules for each configurable key.
const CONFIG_VALIDATION_RULES: Record<string, { min: number; max: number }> = {
  maxIterations:    { min: 5,     max: 100       },
  contextThreshold: { min: 10000, max: 500000    },
  keepToolUses:     { min: 2,     max: 20        },
  cacheTtlMs:       { min: 60000, max: 86400000  },
  parallelToolLimit:{ min: 0,     max: 10        },
};

/**
 * Validates a config value for a known key.
 * Unknown keys pass through without validation (returns valid: true).
 */
export function validateConfigValue(key: string, value: unknown): { valid: boolean; error?: string } {
  const rule = CONFIG_VALIDATION_RULES[key];
  if (!rule) {
    return { valid: true };
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { valid: false, error: `${key} must be a number` };
  }

  if (value < rule.min || value > rule.max) {
    return { valid: false, error: `${key} must be between ${rule.min} and ${rule.max}` };
  }

  return { valid: true };
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

export function setSetting(key: string, value: unknown): boolean {
  const config = loadConfig();
  config[key] = value;
  
  // If setting provider, remove legacy model key
  if (key === 'provider' && config.model) {
    delete config.model;
  }
  
  return saveConfig(config);
}
