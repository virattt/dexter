/**
 * Token estimation utilities for context management.
 * Used to prevent exceeding LLM context window limits.
 */

/**
 * Rough token estimation based on character count.
 * JSON is denser than prose, so we use ~3.5 chars per token.
 * This is conservative - better to underestimate available space.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/**
 * Maximum token budget for context data in final answer generation.
 * Conservative limit that leaves room for system prompt, query, and response.
 */
export const TOKEN_BUDGET = 150_000;
