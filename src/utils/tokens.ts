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

// ============================================================================
// Anthropic-style Context Management Constants
// ============================================================================

/**
 * Token threshold at which context clearing is triggered.
 * Matches Anthropic's default of 100k tokens.
 * When estimated context exceeds this, oldest tool results are cleared.
 */
export const CONTEXT_THRESHOLD = 100_000;

/**
 * Number of most recent tool results to keep when clearing.
 * Anthropic's default is 3, but we use 5 for slightly more context.
 */
export const KEEP_TOOL_USES = 5;

/**
 * Returns the configured context threshold, falling back to the default.
 * Reads from persisted config so users can tune it via `/config set`.
 */
export function getContextThreshold(): number {
  // Import is deferred inside the function body to avoid a potential
  // module-evaluation order issue; config.ts does not import tokens.ts.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getSetting } = require('./config.js') as typeof import('./config.js');
  return getSetting<number>('contextThreshold', CONTEXT_THRESHOLD);
}

/**
 * Returns the configured keepToolUses value, falling back to the default.
 * Reads from persisted config so users can tune it via `/config set`.
 */
export function getKeepToolUses(): number {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getSetting } = require('./config.js') as typeof import('./config.js');
  return getSetting<number>('keepToolUses', KEEP_TOOL_USES);
}
