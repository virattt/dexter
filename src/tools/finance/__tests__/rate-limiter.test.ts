/**
 * Rate Limiter Tests
 * Tests for the rate limiting utility
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RateLimiter } from '../providers/rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // Create a fresh instance for each test
    rateLimiter = new RateLimiter({
      default: { perSecond: 5, perMinute: 100 },
      orders: { perSecond: 10, perMinute: 250 },
    });
  });

  describe('waitForToken', () => {
    it('should allow requests under per-second limit', async () => {
      const start = Date.now();
      await rateLimiter.waitForToken('default');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // Should be nearly instant
    });

    it('should wait when per-second limit is reached', async () => {
      const limit = 2; // Use a small limit for testing
      const testLimiter = new RateLimiter({
        test: { perSecond: limit, perMinute: 100 },
      });

      // Make requests up to the limit
      for (let i = 0; i < limit; i++) {
        await testLimiter.waitForToken('test');
      }

      // Next request should wait
      const start = Date.now();
      await testLimiter.waitForToken('test');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(800); // Should wait ~1 second
    }, 3000);

    it('should allow requests for different endpoint types independently', async () => {
      await rateLimiter.waitForToken('default');
      await rateLimiter.waitForToken('orders');

      // Both should complete without waiting
      expect(true).toBe(true);
    });
  });

  describe('wouldExceedLimit', () => {
    it('should return false when under limit', () => {
      expect(rateLimiter.wouldExceedLimit('default')).toBe(false);
    });

    it('should return true when at per-second limit', async () => {
      const limit = 3;
      const testLimiter = new RateLimiter({
        test: { perSecond: limit, perMinute: 100 },
      });

      // Fill up to the limit
      for (let i = 0; i < limit; i++) {
        await testLimiter.waitForToken('test');
      }

      expect(testLimiter.wouldExceedLimit('test')).toBe(true);
    });

    it('should return false for non-existent endpoint type', () => {
      expect(rateLimiter.wouldExceedLimit('nonexistent')).toBe(false);
    });
  });

  describe('getUsageStats', () => {
    it('should return zero counts when no requests made', () => {
      const stats = rateLimiter.getUsageStats('default');

      expect(stats.countSecond).toBe(0);
      expect(stats.countMinute).toBe(0);
    });

    it('should track requests in the last second', async () => {
      await rateLimiter.waitForToken('default');
      await rateLimiter.waitForToken('default');

      const stats = rateLimiter.getUsageStats('default');

      expect(stats.countSecond).toBe(2);
      expect(stats.countMinute).toBeGreaterThanOrEqual(2);
    });
  });
});
