import { existsSync, readFileSync, writeFileSync } from 'fs';
import { config } from 'dotenv';

// Load .env on module import
config({ quiet: true });

// Map model IDs to their required API key environment variable names
const MODEL_API_KEY_MAP: Record<string, string> = {
  'gpt-5.2': 'OPENAI_API_KEY',
  'claude-sonnet-4-5': 'ANTHROPIC_API_KEY',
  'gemini-3': 'GOOGLE_API_KEY',
};

// Map API key names to user-friendly provider names
const API_KEY_PROVIDER_NAMES: Record<string, string> = {
  OPENAI_API_KEY: 'OpenAI',
  ANTHROPIC_API_KEY: 'Anthropic',
  GOOGLE_API_KEY: 'Google',
};

export function getApiKeyName(modelId: string): string | undefined {
  return MODEL_API_KEY_MAP[modelId];
}

export function checkApiKeyExists(apiKeyName: string): boolean {
  const value = process.env[apiKeyName];
  if (value && value.trim() && !value.trim().startsWith('your-')) {
    return true;
  }

  // Also check .env file directly
  if (existsSync('.env')) {
    const envContent = readFileSync('.env', 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key.trim() === apiKeyName) {
          const val = valueParts.join('=').trim();
          if (val && !val.startsWith('your-')) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export function saveApiKeyToEnv(apiKeyName: string, apiKeyValue: string): boolean {
  try {
    let lines: string[] = [];
    let keyUpdated = false;

    if (existsSync('.env')) {
      const existingContent = readFileSync('.env', 'utf-8');
      const existingLines = existingContent.split('\n');

      for (const line of existingLines) {
        const stripped = line.trim();
        if (!stripped || stripped.startsWith('#')) {
          lines.push(line);
        } else if (stripped.includes('=')) {
          const key = stripped.split('=')[0].trim();
          if (key === apiKeyName) {
            lines.push(`${apiKeyName}=${apiKeyValue}`);
            keyUpdated = true;
          } else {
            lines.push(line);
          }
        } else {
          lines.push(line);
        }
      }

      if (!keyUpdated) {
        if (lines.length > 0 && !lines[lines.length - 1].endsWith('\n')) {
          lines.push('');
        }
        lines.push(`${apiKeyName}=${apiKeyValue}`);
      }
    } else {
      lines.push('# LLM API Keys');
      lines.push(`${apiKeyName}=${apiKeyValue}`);
    }

    writeFileSync('.env', lines.join('\n'));

    // Reload environment variables
    config({ override: true, quiet: true });

    return true;
  } catch (e) {
    console.error(`Error saving API key to .env file: ${e}`);
    return false;
  }
}

export async function promptForApiKey(apiKeyName: string): Promise<string | null> {
  const providerName = API_KEY_PROVIDER_NAMES[apiKeyName] || apiKeyName;

  console.log(`\n${providerName} API key is required to continue.`);
  console.log(`Please enter your ${apiKeyName}:`);

  // Use readline for input
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('> ', (answer) => {
      rl.close();
      const apiKey = answer.trim();
      if (!apiKey) {
        console.log('No API key entered. Cancelled.');
        resolve(null);
      } else {
        resolve(apiKey);
      }
    });
  });
}

export async function ensureApiKeyForModel(modelId: string): Promise<boolean> {
  const apiKeyName = getApiKeyName(modelId);
  if (!apiKeyName) {
    console.log(`Warning: Unknown model '${modelId}', cannot verify API key.`);
    return false;
  }

  // Check if API key already exists
  if (checkApiKeyExists(apiKeyName)) {
    return true;
  }

  // Prompt user for API key
  const providerName = API_KEY_PROVIDER_NAMES[apiKeyName] || apiKeyName;
  const apiKey = await promptForApiKey(apiKeyName);

  if (!apiKey) {
    return false;
  }

  // Save to .env file
  if (saveApiKeyToEnv(apiKeyName, apiKey)) {
    console.log(`\n✓ ${providerName} API key saved to .env file`);
    return true;
  } else {
    console.log(`\n✗ Failed to save ${providerName} API key`);
    return false;
  }
}

