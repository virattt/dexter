/**
 * LM Studio API utilities
 */

interface LMStudioModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface LMStudioModelsResponse {
  data: LMStudioModel[];
  object: string;
}

/**
 * Fetches locally loaded models from the LM Studio API.
 * LM Studio uses the OpenAI-compatible /v1/models endpoint.
 */
export async function getLMStudioModels(): Promise<string[]> {
  const baseUrl = process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1';

  try {
    const response = await fetch(`${baseUrl}/models`);

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as LMStudioModelsResponse;
    return data.data.map((m) => m.id);
  } catch {
    // LM Studio not running or unreachable
    return [];
  }
}
