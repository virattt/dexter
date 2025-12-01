import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const SETTINGS_FILE = '.dexter/settings.json';

interface Config {
  model?: string;
  [key: string]: unknown;
}

export function loadConfig(): Config {
  if (!existsSync(SETTINGS_FILE)) {
    return {};
  }

  try {
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
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

export function getSetting<T>(key: string, defaultValue: T): T {
  const config = loadConfig();
  return (config[key] as T) ?? defaultValue;
}

export function setSetting(key: string, value: unknown): boolean {
  const config = loadConfig();
  config[key] = value;
  return saveConfig(config);
}

