/**
 * Rate Limiter
 * 
 * In-memory rate limiting with sliding window algorithm.
 * Prevents API blocking by enforcing per-second and per-minute limits.
 */

import type { IRateLimiter, RateLimitConfig } from './types.js';

/**
 * Rate limiter implementation using sliding window
 */
export class RateLimiter implements IRateLimiter {
  private limits: Map<string, RateLimitConfig>;
  private timestamps: Map<string, number[]>;

  constructor(limits: Record<string, RateLimitConfig>) {
    this.limits = new Map(Object.entries(limits));
    this.timestamps = new Map();
  }

  /**
   * Wait for a rate limit token if limits are approached
   */
  async waitForToken(endpointType: string): Promise<void> {
    const limit = this.limits.get(endpointType);
    if (!limit) {
      return; // No limit configured
    }

    const now = Date.now();
    const timestamps = this.timestamps.get(endpointType) || [];

    // Clean old timestamps
    const recentSecond = timestamps.filter(t => now - t < 1000);
    const recentMinute = timestamps.filter(t => now - t < 60000);

    // Check per-second limit
    if (recentSecond.length >= limit.perSecond) {
      const waitTime = 1000 - (now - recentSecond[0]);
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }

    // Recalculate after potential wait
    const updatedTimestamps = this.timestamps.get(endpointType) || [];
    const updatedRecentMinute = updatedTimestamps.filter(t => Date.now() - t < 60000);

    // Check per-minute limit
    if (updatedRecentMinute.length >= limit.perMinute) {
      const waitTime = 60000 - (Date.now() - updatedRecentMinute[0]);
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }

    // Record this request
    const finalTimestamps = this.timestamps.get(endpointType) || [];
    finalTimestamps.push(Date.now());
    this.timestamps.set(endpointType, finalTimestamps);
  }

  /**
   * Check if the next request would exceed the limit (non-blocking)
   */
  wouldExceedLimit(endpointType: string): boolean {
    const limit = this.limits.get(endpointType);
    if (!limit) {
      return false;
    }

    const now = Date.now();
    const timestamps = this.timestamps.get(endpointType) || [];

    const recentSecond = timestamps.filter(t => now - t < 1000);
    const recentMinute = timestamps.filter(t => now - t < 60000);

    return recentSecond.length >= limit.perSecond || recentMinute.length >= limit.perMinute;
  }

  /**
   * Get usage statistics for monitoring
   */
  getUsageStats(endpointType: string): { countSecond: number; countMinute: number } {
    const now = Date.now();
    const timestamps = this.timestamps.get(endpointType) || [];

    const countSecond = timestamps.filter(t => now - t < 1000).length;
    const countMinute = timestamps.filter(t => now - t < 60000).length;

    return { countSecond, countMinute };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default rate limits
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { perSecond: 5, perMinute: 100 },
  orders: { perSecond: 10, perMinute: 250 },
  liveData: { perSecond: 10, perMinute: 300 },
  nonTrading: { perSecond: 20, perMinute: 500 },
};

// Default rate limiter instance
export const rateLimiter = new RateLimiter(DEFAULT_RATE_LIMITS);
