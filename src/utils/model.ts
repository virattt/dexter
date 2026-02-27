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
    { id: 'gpt-4o', displayName: 'GPT-4o' },
    { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini' },
    { id: 'o1-preview', displayName: 'O1 Preview' },
    { id: 'o1-mini', displayName: 'O1 Mini' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-latest', displayName: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-latest', displayName: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-latest', displayName: 'Claude 3 Opus' },
  ],
  google: [
    { id: 'gemini-1.5-pro-latest', displayName: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash-latest', displayName: 'Gemini 1.5 Flash' },
    { id: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash (Exp)' },
  ],
  xai: [
    { id: 'grok-beta', displayName: 'Grok Beta' },
    { id: 'grok-vision-beta', displayName: 'Grok Vision Beta' },
  ],
  moonshot: [{ id: 'moonshot-v1-8k', displayName: 'Moonshot V1 8K' }],
  deepseek: [
    { id: 'deepseek-chat', displayName: 'DeepSeek V3' },
    { id: 'deepseek-reasoner', displayName: 'DeepSeek R1' },
  ],
};

export const PROVIDERS: Provider[] = PROVIDER_DEFS.map((provider) => ({
  displayName: provider.displayName,
  providerId: provider.id,
  models: PROVIDER_MODELS[provider.id] ?? [],
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
  const normalizedId = modelId.replace(/^(ollama|openrouter):/, '');

  for (const provider of PROVIDERS) {
    const model = provider.models.find((entry) => entry.id === normalizedId || entry.id === modelId);
    if (model) {
      return model.displayName;
    }
  }

  return normalizedId;
}
