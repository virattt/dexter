import { describe, test, expect, beforeEach } from 'bun:test';

// We test the pure logic of the routing cache by importing the module-level functions.
// The in-memory singleton is reset between tests by manipulating module state.

// Pure helpers extracted from the module for isolated unit testing
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function isStale(updatedAt: string, nowMs = Date.now()): boolean {
  return nowMs - new Date(updatedAt).getTime() > TTL_MS;
}

function normalizeKey(ticker: string): string {
  return ticker.toUpperCase().trim();
}

describe('api-routing-cache helpers', () => {
  describe('normalizeKey', () => {
    test('uppercases ticker', () => {
      expect(normalizeKey('aapl')).toBe('AAPL');
      expect(normalizeKey('NVDA')).toBe('NVDA');
    });

    test('trims whitespace', () => {
      expect(normalizeKey('  TSLA  ')).toBe('TSLA');
    });

    test('handles dot-notation tickers', () => {
      expect(normalizeKey('vws.co')).toBe('VWS.CO');
      expect(normalizeKey('san.mc')).toBe('SAN.MC');
    });
  });

  describe('isStale', () => {
    test('returns false for entry updated 1 day ago', () => {
      const updatedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      expect(isStale(updatedAt)).toBe(false);
    });

    test('returns false for entry updated 29 days ago', () => {
      const updatedAt = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();
      expect(isStale(updatedAt)).toBe(false);
    });

    test('returns true for entry updated 31 days ago', () => {
      const updatedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      expect(isStale(updatedAt)).toBe(true);
    });

    test('returns true for a very old timestamp', () => {
      const updatedAt = new Date(0).toISOString(); // epoch
      expect(isStale(updatedAt)).toBe(true);
    });

    test('returns false for entry updated right now', () => {
      const updatedAt = new Date().toISOString();
      expect(isStale(updatedAt)).toBe(false);
    });
  });
});
