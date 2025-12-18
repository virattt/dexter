/**
 * Application state for the CLI
 */
export type AppState = 'idle' | 'running' | 'model_select';

/**
 * Generate a unique ID for turns
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
