/**
 * LM Studio API utilities
 * API Documentation: https://lmstudio.ai/docs/api/openai-api
 */

/**
 * Model object returned by LM Studio's /v1/models endpoint.
 * Follows OpenAI API specification.
 */
interface LMStudioModel {
  id: string;           // Model identifier (e.g., "deepseek-r1-distill-qwen-32b")
  object: string;       // Always "model" for LM Studio
  created: number;      // Unix timestamp of when model was added
  owned_by: string;     // Model owner/organization (e.g., "lmstudio")
}

/**
 * Response structure from LM Studio's /v1/models endpoint.
 * Matches OpenAI's model list response format exactly.
 */
interface LMStudioModelsResponse {
  object: string;                // Always "list"
  data: LMStudioModel[];         // Array of available models
}

/**
 * Fetches loaded models from the LM Studio API.
 *
 * LM Studio uses OpenAI-compatible endpoint: GET /v1/models
 * This differs from Ollama which uses a custom API: GET /api/tags
 *
 * The function will return an empty array in the following cases:
 * - LM Studio is not running (connection refused)
 * - LM Studio returns a non-200 status code
 * - Network timeout or other fetch errors
 * - Invalid JSON response from server
 *
 * @returns Array of model IDs currently loaded in LM Studio
 *          Empty array if LM Studio is not running or unreachable
 *
 */
export async function getLMStudioModels(): Promise<string[]> {
  // Read base URL from environment variable with sensible default
  const baseUrl = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';

  try {
    const response = await fetch(`${baseUrl}/models`);

    // If server responds with error status, treat as unavailable
    // (500 Internal Server Error, 503 Service Unavailable)
    if (!response.ok) {
      return [];
    }

    // Parse OpenAI-compatible JSON response
    const data = (await response.json()) as LMStudioModelsResponse;

    // Extract and return model IDs
    // (prefix is added later when saving to config)
    return data.data.map((m) => m.id);
  } catch {
    // Gracefully handle all errors:
    // - ECONNREFUSED: LM Studio not running
    // - ETIMEDOUT: Network timeout
    // - SyntaxError: Invalid JSON response
    // - TypeError: Network errors
    //
    // Return empty array to allow UI to show helpful error message
    return [];
  }
}
