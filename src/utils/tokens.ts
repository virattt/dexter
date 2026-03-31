/**
 * Token estimation utilities for context management.
 * Uses actual API token counts when available (Claudia-style),
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
// Model-aware threshold (Claudia-style)
// ---------------------------------------------------------------------------

/** Buffer tokens before the context limit to trigger compaction. */
const AUTOCOMPACT_BUFFER_TOKENS = 13_000;

/** Reserve tokens for model output during compaction. */
const MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20_000;

/** Fallback context window when provider doesn't specify one. */
const DEFAULT_CONTEXT_WINDOW = 128_000;

/**
 * Get the effective context window size for a model, accounting for
 * reserved output tokens (matches Claudia's getEffectiveContextWindowSize).
 */
export function getEffectiveContextWindow(model: string): number {
  const provider = resolveProvider(model);
  const contextWindow = provider.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  return contextWindow - MAX_OUTPUT_TOKENS_FOR_SUMMARY;
}

/**
 * Get the auto-compact threshold for a model.
 * This is the token count at which compaction should trigger.
 * Matches Claudia's formula: effectiveWindow - 13K buffer.
 */
export function getAutoCompactThreshold(model: string): number {
  return getEffectiveContextWindow(model) - AUTOCOMPACT_BUFFER_TOKENS;
}

/**
 * Estimate context tokens using actual API data when available.
 *
 * Claudia's approach: anchor on the last API response's actual token count,
 * then estimate only the delta (new tool results added since that call).
 * Falls back to pure character estimation when no API data is available.
 *
 * @param lastApiInputTokens - Input tokens from the most recent API response (0 if unavailable)
 * @param lastApiOutputTokens - Output tokens from the most recent API response (0 if unavailable)
 * @param newContentSinceLastCall - Text added to context since the last API call (e.g., new tool results)
 * @param fullContextText - Full context text (used as fallback when no API data)
 */
export function estimateContextTokens(
  lastApiInputTokens: number,
  lastApiOutputTokens: number,
  newContentSinceLastCall: string,
  fullContextText: string,
): number {
  if (lastApiInputTokens > 0) {
    // Anchor on real API data + estimate only the delta
    // The next call's input ≈ last input + last output + new tool results
    // (output becomes part of context for the next turn in multi-turn APIs,
    //  but Dexter rebuilds from scratch each iteration, so we just need
    //  last input + the new tool results added since)
    return lastApiInputTokens + estimateTokens(newContentSinceLastCall);
  }

  // No API data yet — fall back to pure estimation
  return estimateTokens(fullContextText);
}

// ---------------------------------------------------------------------------
// Legacy constants (kept for backward compatibility with clearing fallback)
// ---------------------------------------------------------------------------

/**
 * Maximum token budget for context data in final answer generation.
 */
export const TOKEN_BUDGET = 150_000;

/**
 * Static threshold for legacy clearing fallback.
 * Used when model-aware threshold is not applicable.
 */
export const CONTEXT_THRESHOLD = 100_000;

/**
 * Number of most recent tool results to keep when clearing.
 */
export const KEEP_TOOL_USES = 5;
