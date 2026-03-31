/**
 * Token estimation utilities for context management.
 * Uses actual API token counts when available,
 * falling back to character-based estimation.
 */

import { resolveProvider } from '../providers.js';

// ---------------------------------------------------------------------------
// Character-based estimation (fallback)
// ---------------------------------------------------------------------------

/**
 * Rough token estimation based on character count.
 * JSON is denser than prose, so we use ~3.5 chars per token.
 * This is conservative - better to underestimate available space.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

// ---------------------------------------------------------------------------
// Model-aware threshold
// ---------------------------------------------------------------------------

/** Buffer tokens before the context limit to trigger compaction. */
const AUTOCOMPACT_BUFFER_TOKENS = 13_000;

/** Reserve tokens for model output during compaction. */
const MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20_000;

/** Fallback context window when provider doesn't specify one. */
const DEFAULT_CONTEXT_WINDOW = 128_000;

/**
 * Get the effective context window size for a model, accounting for
 * reserved output tokens.
 */
export function getEffectiveContextWindow(model: string): number {
  const provider = resolveProvider(model);
  const contextWindow = provider.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  return contextWindow - MAX_OUTPUT_TOKENS_FOR_SUMMARY;
}

/**
 * Get the auto-compact threshold for a model.
 * This is the token count at which compaction should trigger.
 * Formula: effectiveWindow - 13K buffer.
 */
export function getAutoCompactThreshold(model: string): number {
  return getEffectiveContextWindow(model) - AUTOCOMPACT_BUFFER_TOKENS;
}

// ---------------------------------------------------------------------------
// Legacy constants
// ---------------------------------------------------------------------------

/**
 * Static threshold used as fallback by memory flush.
 */
export const CONTEXT_THRESHOLD = 100_000;

/**
 * Number of most recent tool results to keep when clearing.
 */
export const KEEP_TOOL_USES = 5;
