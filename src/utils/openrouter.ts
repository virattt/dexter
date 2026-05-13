import type { Model } from './model.js';

interface OpenRouterPricing {
  prompt: number;
  completion: number;
  image: number;
  request: number;
}

interface OpenRouterModelData {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  pricing: OpenRouterPricing;
}

interface OpenRouterModelsResponse {
  data: OpenRouterModelData[];
}

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const MAX_LISTED_MODELS = 30;

const CUSTOM_MODEL_OPTION: Model = {
  id: '__custom__',
  displayName: 'Specify custom model...',
};

export function isCustomModelOption(modelId: string): boolean {
  return modelId === '__custom__';
}

export async function getOpenRouterModels(): Promise<Model[]> {
  try {
    const response = await fetch(
      `${OPENROUTER_API_BASE}/models?supported_parameters=tools`,
    );
    if (!response.ok) return [CUSTOM_MODEL_OPTION];
    const { data } = (await response.json()) as OpenRouterModelsResponse;

    const sorted = data
      .map((m) => ({ m, isFree: m.pricing.prompt === 0 && m.pricing.completion === 0 }))
      .sort((a, b) => b.m.created - a.m.created);

    const free: Model[] = [];
    const paid: Model[] = [];

    for (const { m, isFree } of sorted) {
      const priceLabel = isFree ? 'Free' : `$${m.pricing.prompt}/1K tokens`;
      const ctxLabel =
        m.context_length > 0
          ? `${(m.context_length / 1000).toFixed(0)}K ctx`
          : '';
      const entry: Model = {
        id: `openrouter:${m.id}`,
        displayName: [m.name, priceLabel, ctxLabel]
          .filter(Boolean)
          .join(' \u2022 '),
      };
      (isFree ? free : paid).push(entry);
    }

    const budget = MAX_LISTED_MODELS - free.length;
    const selectedPaid = budget > 0 ? paid.slice(0, budget) : [];

    return [...free, ...selectedPaid, CUSTOM_MODEL_OPTION];
  } catch {
    return [CUSTOM_MODEL_OPTION];
  }
}
