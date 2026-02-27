/**
 * Novita AI Provider
 * 
 * OpenAI-compatible provider for Novita AI (https://novita.ai)
 * Uses the OpenAI SDK pointed at Novita's endpoint.
 */

export const NOVITA_CONFIG = {
  id: 'novita',
  displayName: 'Novita AI',
  modelPrefix: 'novita:',
  apiKeyEnvVar: 'NOVITA_API_KEY',
  baseURL: 'https://api.novita.ai/openai',
  fastModel: 'novita:deepseek-ai/DeepSeek-V3',
};
