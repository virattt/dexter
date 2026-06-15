import type { Model } from './model.js';
import { getModelsForProvider } from './model.js';

// ---------------------------------------------------------------------------
// Dynamic model fetchers per provider.
// Each fetcher tries the provider's models API. Returns null to fall back to
// the hardcoded static list (e.g. when no API key is configured or the call fails).
// ---------------------------------------------------------------------------

interface OpenAICompatibleModel {
  id: string;
}

async function fetchFromOpenAICompatible(
  baseURL: string,
  apiKey: string,
): Promise<Model[] | null> {
  try {
    const response = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return null;
    const { data } = (await response.json()) as { data: OpenAICompatibleModel[] };

    return data
      .filter((m) => !m.id.startsWith('ft:'))
      .map((m) => ({ id: m.id, displayName: m.id }))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return null;
  }
}

async function fetchOpenAIModels(): Promise<Model[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return fetchFromOpenAICompatible('https://api.openai.com/v1', key);
}

async function fetchAnthropicModels(): Promise<Model[] | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!response.ok) return null;
    const { data } = (await response.json()) as {
      data: Array<{ id: string; name?: string; display_name?: string }>;
    };
    return data
      .map((m) => ({ id: m.id, displayName: m.display_name ?? m.name ?? m.id }))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return null;
  }
}

async function fetchGoogleModels(): Promise<Model[] | null> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${key}`,
    );
    if (!response.ok) return null;
    const { models } = (await response.json()) as {
      models: Array<{ name: string; displayName: string }>;
    };
    return models
      .map((m) => ({
        id: m.name.replace(/^models\//, ''),
        displayName: m.displayName,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return null;
  }
}

async function fetchXAIModels(): Promise<Model[] | null> {
  const key = process.env.XAI_API_KEY;
  if (!key) return null;
  return fetchFromOpenAICompatible('https://api.x.ai/v1', key);
}

async function fetchDeepSeekModels(): Promise<Model[] | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  return fetchFromOpenAICompatible('https://api.deepseek.com', key);
}

async function fetchMoonshotModels(): Promise<Model[] | null> {
  const key = process.env.MOONSHOT_API_KEY;
  if (!key) return null;
  return fetchFromOpenAICompatible('https://api.moonshot.cn/v1', key);
}

// ---------------------------------------------------------------------------
// Registry: provider id → fetcher
// ---------------------------------------------------------------------------

type ModelFetcher = () => Promise<Model[] | null>;

const DYNAMIC_FETCHERS: Record<string, ModelFetcher> = {
  openai: fetchOpenAIModels,
  anthropic: fetchAnthropicModels,
  google: fetchGoogleModels,
  xai: fetchXAIModels,
  deepseek: fetchDeepSeekModels,
  moonshot: fetchMoonshotModels,
};

// ---------------------------------------------------------------------------
// Unified entry point
// ---------------------------------------------------------------------------

/**
 * Fetch models for a provider, trying the dynamic API first and falling back
 * to the hardcoded static list when unavailable or on error.
 */
export async function fetchProviderModels(providerId: string): Promise<Model[]> {
  const fetcher = DYNAMIC_FETCHERS[providerId];

  if (fetcher) {
    const dynamic = await fetcher();
    if (dynamic && dynamic.length > 0) {
      return dynamic;
    }
  }

  return getModelsForProvider(providerId);
}
