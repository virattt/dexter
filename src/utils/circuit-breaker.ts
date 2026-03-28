/**
 * Simple in-process circuit breaker for external API calls.
 *
 * States:
 *  CLOSED   — normal operation; failures are counted
 *  OPEN     — circuit is tripped; calls are rejected immediately
 *  HALF_OPEN — one probe call is allowed through to test recovery
 *
 * Transitions:
 *  CLOSED  → OPEN      after `failureThreshold` consecutive failures
 *  OPEN    → HALF_OPEN after `resetTimeoutMs` elapses
 *  HALF_OPEN → CLOSED  on success
 *  HALF_OPEN → OPEN    on failure (resets the timer)
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  /** Consecutive failures before opening the circuit. Default: 3 */
  failureThreshold?: number;
  /** Milliseconds to wait before allowing a probe through. Default: 300_000 (5 min) */
  resetTimeoutMs?: number;
  /** Human-readable name for logging/debugging. */
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  readonly name: string;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.failureThreshold = opts.failureThreshold ?? 3;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 300_000;
    this.name = opts.name ?? 'unknown';
  }

  /** Returns true when the circuit is OPEN and the call should be skipped. */
  isOpen(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  /** Call after a successful API response. */
  onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  /** Call after a failed API response (error or non-2xx status). */
  onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  /**
   * Wraps an async call with circuit-breaker logic.
   * Returns `fallback` immediately if the circuit is open.
   */
  async call<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    if (this.isOpen()) return fallback;
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch {
      this.onFailure();
      return fallback;
    }
  }

  get currentState(): CircuitState {
    return this.state;
  }

  get consecutiveFailures(): number {
    return this.failures;
  }
}

// ---------------------------------------------------------------------------
// Pre-built breakers for known flaky external APIs
// ---------------------------------------------------------------------------

/** Polymarket Gamma API — public, but occasionally goes down. */
export const polymarketBreaker = new CircuitBreaker({
  name: 'polymarket',
  failureThreshold: 3,
  resetTimeoutMs: 300_000,
});

/** X / Twitter API v2 — aggressive rate limits and intermittent auth failures. */
export const xApiBreaker = new CircuitBreaker({
  name: 'x-api',
  failureThreshold: 3,
  resetTimeoutMs: 300_000,
});
