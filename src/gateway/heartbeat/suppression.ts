export const HEARTBEAT_OK_TOKEN = 'HEARTBEAT_OK';

type SuppressionReason = 'ok-token' | 'empty' | 'duplicate' | 'no-action' | 'none';

export type SuppressionResult = {
  shouldSuppress: boolean;
  cleanedText: string;
  reason: SuppressionReason;
};

export type SuppressionState = {
  lastMessageText: string | null;
  lastMessageAt: number | null;
};

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Strip the HEARTBEAT_OK token from text, handling bold markdown wrappers
 * and trailing punctuation.
 */
function stripOkToken(text: string): string {
  // Match HEARTBEAT_OK with optional bold wrappers (**) and trailing punctuation
  const pattern = /^\s*(?:\*\*)?HEARTBEAT_OK(?:\*\*)?[.!]?\s*|\s*(?:\*\*)?HEARTBEAT_OK(?:\*\*)?[.!]?\s*$/gi;
  return text.replace(pattern, '').trim();
}

/**
 * Check if the text is essentially just the HEARTBEAT_OK token
 * (possibly with bold wrappers and punctuation).
 */
function isJustOkToken(text: string): boolean {
  const stripped = text.trim();
  return /^(?:\*\*)?HEARTBEAT_OK(?:\*\*)?[.!]?\s*$/.test(stripped);
}

/**
 * Heuristic: detect "nothing to report" responses the LLM sent despite
 * being told to use HEARTBEAT_OK.  Only matches unambiguously dismissive
 * phrases — avoids domain-specific patterns that could false-positive
 * on legitimate alerts.
 */
const NO_ACTION_PATTERNS = [
  /\bno action needed\b/i,
  /\bno alert needed\b/i,
  /\bnothing to report\b/i,
  /\bno (?:significant |notable )?change/i,
  /\beverything (?:is |looks )?(?:fine|normal|good|ok)\b/i,
];

function looksLikeNoAction(text: string): boolean {
  return NO_ACTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Evaluate whether a heartbeat response should be suppressed.
 */
export function evaluateSuppression(
  text: string,
  state: SuppressionState,
): SuppressionResult {
  const trimmed = text.trim();

  // Empty response
  if (!trimmed) {
    return { shouldSuppress: true, cleanedText: '', reason: 'empty' };
  }

  // Response is just the HEARTBEAT_OK token
  if (isJustOkToken(trimmed)) {
    return { shouldSuppress: true, cleanedText: '', reason: 'ok-token' };
  }

  // Strip token from start/end if it appears alongside other content
  const cleaned = stripOkToken(trimmed);

  if (!cleaned) {
    return { shouldSuppress: true, cleanedText: '', reason: 'ok-token' };
  }

  // Heuristic: suppress "no action needed" style responses
  if (looksLikeNoAction(cleaned)) {
    return { shouldSuppress: true, cleanedText: cleaned, reason: 'no-action' };
  }

  // Duplicate suppression: same text within 24h
  if (
    state.lastMessageText !== null &&
    state.lastMessageAt !== null &&
    Date.now() - state.lastMessageAt < DUPLICATE_WINDOW_MS &&
    cleaned === state.lastMessageText
  ) {
    return { shouldSuppress: true, cleanedText: cleaned, reason: 'duplicate' };
  }

  return { shouldSuppress: false, cleanedText: cleaned, reason: 'none' };
}
