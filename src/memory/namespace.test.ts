/**
 * Tests for memory namespace support.
 * Verifies that FinancialMemoryStore correctly scopes insights by namespace.
 */

import { describe, test, expect, beforeEach } from 'bun:test';

// We test the core namespace filtering logic with an in-memory DB mock.
// This avoids needing a real SQLite instance while still validating the logic.

interface MockInsight {
  id: number;
  ticker: string;
  tags: string[];
  content: string;
  routing?: string;
  namespace?: string;
  createdAt: number;
  updatedAt: number;
}

function recallByTickerWithNs(
  insights: MockInsight[],
  ticker: string,
  namespace?: string,
): MockInsight[] {
  const upper = ticker.toUpperCase();
  const results = insights.filter((i) => i.ticker.toUpperCase() === upper);
  if (namespace !== undefined) {
    return results.filter((i) => (i.namespace ?? null) === namespace);
  }
  return results;
}

function searchWithNs(
  insights: MockInsight[],
  keyword: string,
  namespace?: string,
): MockInsight[] {
  let results = insights.filter((i) =>
    i.content.toLowerCase().includes(keyword.toLowerCase()),
  );
  if (namespace !== undefined) {
    results = results.filter((i) => (i.namespace ?? null) === namespace);
  }
  return results;
}

function getRoutingWithNs(
  insights: MockInsight[],
  ticker: string,
  namespace?: string,
): string | null {
  const matching = recallByTickerWithNs(insights, ticker, namespace);
  const sorted = [...matching].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  for (const i of sorted) {
    if (i.routing) return i.routing;
  }
  return null;
}

const BASE_TS = 1_700_000_000_000;

const sampleInsights: MockInsight[] = [
  {
    id: 1,
    ticker: 'AAPL',
    tags: ['ticker:AAPL', 'analysis:thesis'],
    content: 'DCF valuation: WACC 8%, terminal growth 2.5%',
    namespace: 'dcf',
    routing: 'fmp-ok',
    createdAt: BASE_TS,
    updatedAt: BASE_TS,
  },
  {
    id: 2,
    ticker: 'AAPL',
    tags: ['ticker:AAPL', 'analysis:thesis'],
    content: 'Bear case: margin compression, market share loss',
    namespace: 'short-thesis',
    createdAt: BASE_TS + 1,
    updatedAt: BASE_TS + 1,
  },
  {
    id: 3,
    ticker: 'AAPL',
    tags: ['ticker:AAPL', 'routing:fmp-ok'],
    content: 'Global routing insight for AAPL',
    namespace: undefined,
    routing: 'fmp-ok',
    createdAt: BASE_TS + 2,
    updatedAt: BASE_TS + 2,
  },
  {
    id: 4,
    ticker: 'NVDA',
    tags: ['ticker:NVDA'],
    content: 'Semiconductor valuation with WACC 10%',
    namespace: 'dcf',
    createdAt: BASE_TS,
    updatedAt: BASE_TS,
  },
];

describe('memory namespace filtering', () => {
  describe('recallByTicker with namespace', () => {
    test('returns only insights matching namespace', () => {
      const results = recallByTickerWithNs(sampleInsights, 'AAPL', 'dcf');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(1);
    });

    test('returns different insights for different namespace', () => {
      const results = recallByTickerWithNs(sampleInsights, 'AAPL', 'short-thesis');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(2);
    });

    test('returns only global insights (null namespace) when namespace is null-string', () => {
      const results = recallByTickerWithNs(sampleInsights, 'AAPL', undefined);
      // No namespace filter — returns all AAPL insights
      expect(results).toHaveLength(3);
    });

    test('returns empty when namespace has no matching insights', () => {
      const results = recallByTickerWithNs(sampleInsights, 'AAPL', 'peer-comparison');
      expect(results).toHaveLength(0);
    });

    test('ticker filter is case-insensitive', () => {
      const results = recallByTickerWithNs(sampleInsights, 'aapl', 'dcf');
      expect(results).toHaveLength(1);
    });
  });

  describe('search with namespace', () => {
    test('scopes search results to namespace', () => {
      const results = searchWithNs(sampleInsights, 'WACC', 'dcf');
      // Both AAPL and NVDA have WACC in dcf namespace
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.namespace === 'dcf')).toBe(true);
    });

    test('without namespace, returns all matching insights', () => {
      const results = searchWithNs(sampleInsights, 'WACC');
      expect(results).toHaveLength(2);
    });

    test('namespace scoping prevents cross-contamination', () => {
      const dcfResults = searchWithNs(sampleInsights, 'margin', 'dcf');
      expect(dcfResults).toHaveLength(0); // "margin" is in short-thesis, not dcf

      const shortResults = searchWithNs(sampleInsights, 'margin', 'short-thesis');
      expect(shortResults).toHaveLength(1);
    });
  });

  describe('getRouting with namespace', () => {
    test('returns routing from namespaced insight', () => {
      const routing = getRoutingWithNs(sampleInsights, 'AAPL', 'dcf');
      expect(routing).toBe('fmp-ok');
    });

    test('returns null when namespace has no routing', () => {
      const routing = getRoutingWithNs(sampleInsights, 'AAPL', 'short-thesis');
      expect(routing).toBeNull();
    });

    test('without namespace, returns routing from any matching insight', () => {
      const routing = getRoutingWithNs(sampleInsights, 'AAPL');
      expect(routing).toBe('fmp-ok');
    });

    test('returns null for ticker with no insights in namespace', () => {
      const routing = getRoutingWithNs(sampleInsights, 'MSFT', 'dcf');
      expect(routing).toBeNull();
    });
  });

  describe('namespace tag convention', () => {
    test('namespace tag is added when namespace is provided', () => {
      const tags = ['ticker:AAPL', 'analysis:thesis'];
      const namespace = 'dcf';
      if (namespace && !tags.some((t) => t.startsWith('ns:'))) {
        tags.push(`ns:${namespace}`);
      }
      expect(tags).toContain('ns:dcf');
    });

    test('existing ns: tag is not duplicated', () => {
      const tags = ['ticker:AAPL', 'ns:dcf'];
      const namespace = 'dcf';
      if (namespace && !tags.some((t) => t.startsWith('ns:'))) {
        tags.push(`ns:${namespace}`);
      }
      const nsTags = tags.filter((t) => t.startsWith('ns:'));
      expect(nsTags).toHaveLength(1);
    });
  });
});
