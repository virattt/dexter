/**
 * Ollama API utilities
 */

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

/**
 * Fetches locally downloaded models from the Ollama API
 */
export async function getOllamaModels(): Promise<string[]> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  
  try {
    const response = await fetch(`${baseUrl}/api/tags`);

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return (data?.models ?? [])
      .map((m) => m?.name)
      .filter((n): n is string => typeof n === 'string');
  } catch {
    // Ollama not running or unreachable
    return [];
  }
}

