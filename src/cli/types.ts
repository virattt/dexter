/**
 * Application state for the CLI
 */
export type AppState = 
  | 'idle' 
  | 'running' 
  | 'provider_select'  // Selecting LLM provider
  | 'model_select'     // Selecting model for the chosen provider
  | 'api_key_confirm' 
  | 'api_key_input';

/**
 * Generate a unique ID for turns
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
