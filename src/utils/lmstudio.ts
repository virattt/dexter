/**
 * LM Studio API utilities
 * LM Studio provides an OpenAI-compatible API on localhost:1234
 */

interface LMStudioModel {
  id: string;
  object: string;
  owned_by: string;
}

interface LMStudioModelsResponse {
  data: LMStudioModel[];
  object: string;
}

/**
 * Fetches locally loaded models from the LM Studio API
 */
export async function getLMStudioModels(): Promise<string[]> {
  // Strip /v1 suffix if present since we add it ourselves
  const rawBaseUrl = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234';
  const baseUrl = rawBaseUrl.replace(/\/v1\/?$/, '');
  
  try {
    const response = await fetch(`${baseUrl}/v1/models`);
    
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

/**
 * Check if LM Studio server is running
 */
export async function isLMStudioRunning(): Promise<boolean> {
  const models = await getLMStudioModels();
  return models.length > 0;
}
