import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { z } from 'zod';
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

export const ConfigSchema = z.object({
  provider: z.string().optional(),
  modelId: z.string().optional(),
  model: z.string().optional(), // legacy
  memory: z.object({
    enabled: z.boolean().optional(),
    embeddingProvider: z.enum(['openai', 'gemini', 'ollama', 'auto']).optional(),
    embeddingModel: z.string().optional(),
    maxSessionContextTokens: z.number().optional(),
  }).optional(),
  maxIterations: z.number().min(5).max(100).optional(),
  contextThreshold: z.number().min(10000).max(500000).optional(),
  keepToolUses: z.number().min(2).max(20).optional(),
  cacheTtlMs: z.number().min(60000).max(86400000).optional(),
  parallelToolLimit: z.number().min(0).max(10).optional(),
}).passthrough(); // allow unknown keys without throwing

export type Config = z.infer<typeof ConfigSchema> & Record<string, unknown>;

/**
 * Validates raw config against the schema.
 * On failure: logs a warning, strips invalid fields, returns the rest.
 * Never throws — always returns a usable Config.
 */
export function validateAndSanitizeConfig(raw: unknown): Config {
  const result = ConfigSchema.safeParse(raw);
  if (result.success) {
    return result.data as Config;
  }

  console.warn('[dexter] config validation warning:', result.error.flatten().fieldErrors);

  // Start from a shallow copy of the raw object (or empty if not an object)
  const stripped: Record<string, unknown> =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};

  // Remove each field (or nested field) that failed validation
  for (const issue of result.error.issues) {
    const [topKey] = issue.path;
    if (typeof topKey !== 'string') continue;

    if (issue.path.length === 1) {
      delete stripped[topKey];
    } else if (issue.path.length >= 2 && typeof issue.path[1] === 'string') {
      const nested = stripped[topKey];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const nestedCopy = { ...(nested as Record<string, unknown>) };
        delete nestedCopy[issue.path[1] as string];
        stripped[topKey] = nestedCopy;
      }
    }
  }

  return stripped as Config;
}


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
    let config = validateAndSanitizeConfig(JSON.parse(content));

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
