import { PROVIDERS as PROVIDER_DEFS } from '@/providers';

export interface Model {
  id: string;
  displayName: string;
}

interface Provider {
  displayName: string;
  providerId: string;
  models: Model[];
}

const PROVIDER_MODELS: Record<string, Model[]> = {
  openai: [
    { id: 'gpt-6-astra', displayName: 'GPT 6 Astra' },
    { id: 'gpt-6-sol', displayName: 'GPT 6 Sol' },
    { id: 'gpt-6-luna', displayName: 'GPT 6 Luna' },
  ],
  anthropic: [
    { id: 'claude-sonnet-5', displayName: 'Sonnet 5' },
    { id: 'claude-opus-5-5', displayName: 'Opus 5.5' },
    { id: 'claude-fable-5-1', displayName: 'Fable 5.1' },
  ],
  google: [
    { id: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash' },
    { id: 'gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro' },
  ],
  xai: [{ id: 'grok-4.7', displayName: 'Grok 4.7' }],
  moonshot: [{ id: 'kimi-k3', displayName: 'Kimi K3' }],
  deepseek: [
    { id: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro' },
    { id: 'deepseek-flash', displayName: 'DeepSeek V4.1 Flash' },
  ],
};

export const PROVIDERS: Provider[] = PROVIDER_DEFS.map((provider) => ({
  displayName: provider.displayName,
  providerId: provider.id,
  models:
    PROVIDER_MODELS[provider.id] ??
    provider.models?.map((model) => ({
      id: model.id,
      displayName: model.displayName,
    })) ??
    [],
}));

export function getModelsForProvider(providerId: string): Model[] {
  const provider = PROVIDERS.find((entry) => entry.providerId === providerId);
  return provider?.models ?? [];
}

export function getModelIdsForProvider(providerId: string): string[] {
  return getModelsForProvider(providerId).map((model) => model.id);
}

export function getDefaultModelForProvider(providerId: string): string | undefined {
  const models = getModelsForProvider(providerId);
  return models[0]?.id;
}

export function getModelDisplayName(modelId: string): string {
  const normalizedId = modelId.replace(/^(ollama|ollama-cloud|openrouter|minimax):/, '');

  for (const provider of PROVIDERS) {
    const model = provider.models.find((entry) => entry.id === normalizedId || entry.id === modelId);
    if (model) {
      return model.displayName;
    }
  }

  return normalizedId;
}
