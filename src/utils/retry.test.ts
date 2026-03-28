/**
 * TDD tests for src/utils/retry.ts
 *
 * RED → GREEN approach: tests define the expected contract; the implementation
 * must satisfy every assertion below.
 *
 * To keep tests deterministic and fast, baseDelayMs is set to 0 on all calls
 * (this collapses the sleep time without altering retry logic).
 */
import { describe, it, expect } from 'bun:test';
import { withRetry, isRateLimitError, isTransientError } from './retry.js';

// ---------------------------------------------------------------------------
// withRetry
// ---------------------------------------------------------------------------

describe('withRetry', () => {
  it('returns the result immediately when fn succeeds on the first attempt', async () => {
    const result = await withRetry(async () => 42);
    expect(result).toBe(42);
  });

  it('returns result when fn succeeds after two failures', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error('429 rate limit');
        return 'success';
      },
      { maxAttempts: 4, baseDelayMs: 0 },
    );
    expect(result).toBe('success');
    expect(calls).toBe(3);
  });

  it('throws the last error after exhausting maxAttempts', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => { calls++; throw new Error('429 rate limit'); },
        { maxAttempts: 3, baseDelayMs: 0 },
      ),
    ).rejects.toThrow('429 rate limit');
    expect(calls).toBe(3);
  });

  it('does NOT retry when shouldRetry returns false for the error', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => { calls++; throw new Error('permanent error'); },
        {
          maxAttempts: 4,
          baseDelayMs: 0,
          shouldRetry: (err) => err instanceof Error && err.message.includes('429'),
        },
      ),
    ).rejects.toThrow('permanent error');
    expect(calls).toBe(1); // bailed immediately
  });

  it('retries when shouldRetry returns true and stops on max attempts', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => { calls++; throw new Error('429 rate limit'); },
        { maxAttempts: 3, baseDelayMs: 0, shouldRetry: isRateLimitError },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(3);
  });

  it('maxAttempts = 1 means zero retries (single call)', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => { calls++; throw new Error('err'); },
        { maxAttempts: 1, baseDelayMs: 0 },
      ),
    ).rejects.toThrow('err');
    expect(calls).toBe(1);
  });

  it('passes the attempt number to shouldRetry', async () => {
    const attempts: number[] = [];
    let calls = 0;
    await expect(
      withRetry(
        async () => { calls++; throw new Error('429 rate limit'); },
        {
          maxAttempts: 3,
          baseDelayMs: 0,
          shouldRetry: (_err, attempt) => {
            attempts.push(attempt);
            return true;
          },
        },
      ),
    ).rejects.toThrow();
    // shouldRetry is called after attempt 1 and after attempt 2 (not after the final one)
    expect(attempts).toEqual([1, 2]);
  });

  it('works with baseDelayMs = 0 and jitter = 0 (no sleep overhead)', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 2) throw new Error('429 rate limit');
        return 'done';
      },
      { baseDelayMs: 0, jitter: 0 },
    );
    expect(result).toBe('done');
    expect(calls).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// isRateLimitError
// ---------------------------------------------------------------------------

describe('isRateLimitError', () => {
  it('returns true when error message contains "429"', () => {
    expect(isRateLimitError(new Error('HTTP 429 Too Many Requests'))).toBe(true);
  });

  it('returns true when message contains "rate limit" (lowercase)', () => {
    expect(isRateLimitError(new Error('rate limit exceeded'))).toBe(true);
  });

  it('returns true when message contains "Rate Limit" (mixed case)', () => {
    expect(isRateLimitError(new Error('Rate Limit exceeded'))).toBe(true);
  });

  it('returns true for FMP-style error format "[FMP API] 429 ..."', () => {
    expect(isRateLimitError(new Error('[FMP API] 429 Too Many Requests'))).toBe(true);
  });

  it('returns false for HTTP 500 errors', () => {
    expect(isRateLimitError(new Error('HTTP 500 Internal Server Error'))).toBe(false);
  });

  it('returns false for HTTP 400 errors', () => {
    expect(isRateLimitError(new Error('400 Bad Request'))).toBe(false);
  });

  it('returns false for non-Error string values', () => {
    expect(isRateLimitError('429')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isRateLimitError(null)).toBe(false);
  });

  it('returns false for numeric values', () => {
    expect(isRateLimitError(429)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTransientError
// ---------------------------------------------------------------------------

describe('isTransientError', () => {
  it('returns true for 429 rate limit errors', () => {
    expect(isTransientError(new Error('429 rate limit'))).toBe(true);
  });

  it('returns true for 500 Internal Server Error', () => {
    expect(isTransientError(new Error('HTTP 500 Internal Server Error'))).toBe(true);
  });

  it('returns true for 503 Service Unavailable', () => {
    expect(isTransientError(new Error('503 Service Unavailable'))).toBe(true);
  });

  it('returns true for 502 Bad Gateway', () => {
    expect(isTransientError(new Error('502 Bad Gateway'))).toBe(true);
  });

  it('returns true for 428 Precondition Required', () => {
    expect(isTransientError(new Error('428 Precondition Required'))).toBe(true);
  });

  it('returns false for 400 Bad Request', () => {
    expect(isTransientError(new Error('400 Bad Request'))).toBe(false);
  });

  it('returns false for 401 Unauthorized', () => {
    expect(isTransientError(new Error('401 Unauthorized'))).toBe(false);
  });

  it('returns false for 403 Forbidden', () => {
    expect(isTransientError(new Error('403 Forbidden'))).toBe(false);
  });

  it('returns false for 404 Not Found', () => {
    expect(isTransientError(new Error('404 Not Found'))).toBe(false);
  });

  it('returns false for non-Error string values', () => {
    expect(isTransientError('500 error')).toBe(false);
  });
});
