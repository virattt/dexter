import type { TokenUsage } from './types.js';

/**
 * Tracks token usage across multiple LLM calls.
 */
export class TokenCounter {
  private usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  /**
   * Add usage from an LLM call to the running total.
   */
  add(usage?: TokenUsage): void {
    if (!usage) return;
    this.usage.inputTokens += usage.inputTokens;
    this.usage.outputTokens += usage.outputTokens;
    this.usage.totalTokens += usage.totalTokens;
  }

  /**
   * Get the accumulated token usage, or undefined if no tokens were tracked.
   */
  getUsage(): TokenUsage | undefined {
    return this.usage.totalTokens > 0 ? { ...this.usage } : undefined;
  }

  /**
   * Calculate tokens per second given elapsed time in milliseconds.
   */
  getTokensPerSecond(elapsedMs: number): number | undefined {
    if (this.usage.totalTokens === 0 || elapsedMs <= 0) return undefined;
    return this.usage.totalTokens / (elapsedMs / 1000);
  }
}
