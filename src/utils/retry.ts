/**
 * Exponential backoff retry utility.
 *
 * Retries an async function when the supplied `shouldRetry` predicate returns
 * true, using a 2^n * baseDelayMs delay between attempts (capped at maxDelayMs).
 * On each attempt the predicate receives the thrown value so callers can
 * differentiate 429 rate-limits from permanent errors.
 *
 * Usage:
 *   const data = await withRetry(() => fetch(url), {
 *     maxAttempts: 4,
 *     shouldRetry: (e) => e instanceof RateLimitError,
 *   });
 */

export interface RetryOptions {
  /** Maximum total attempts (including the first). Default: 4 */
  maxAttempts?: number;
  /** Base delay in milliseconds — doubles each retry. Default: 1_000 */
  baseDelayMs?: number;
  /** Upper cap on delay. Default: 16_000 (16 s) */
  maxDelayMs?: number;
  /** Return true to retry, false to rethrow immediately. Default: always retry. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Optional jitter fraction [0–1] added to delay. Default: 0.2 */
  jitter?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 1_000;
  const maxDelayMs = opts.maxDelayMs ?? 16_000;
  const jitter = opts.jitter ?? 0.2;
  const shouldRetry = opts.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !shouldRetry(err, attempt)) throw err;

      // 2^(attempt-1) * base, capped at max, plus random jitter
      const base = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const noise = base * jitter * Math.random();
      await sleep(Math.round(base + noise));
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Helpers for common HTTP retry predicates
// ---------------------------------------------------------------------------

/** Returns true when the error message indicates an HTTP 429 rate-limit. */
export function isRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes('429') || err.message.toLowerCase().includes('rate limit');
}

/** Returns true for transient server-side errors (429 or 5xx). */
export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /4[28]9|5\d\d/.test(err.message) || err.message.toLowerCase().includes('rate limit');
}
