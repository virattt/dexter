/**
 * OpenRouter API utilities
 */

interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description?: string;
  context_length?: number;
  pricing: {
    prompt: string;
    completion: string;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

/**
 * Fetches available models from the OpenRouter API
 */
export async function getOpenRouterModels(): Promise<string[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as OpenRouterModelsResponse;
    return data.data
      .map((m) => m.id)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    // API unreachable or error
    return [];
  }
}
