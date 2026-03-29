/**
 * TDD tests for src/agent/memory-injection.ts
 *
 * The extracted injectMemoryContext() accepts explicit deps so we can
 * test every branch without touching disk, databases, or LLM APIs.
 */
import { describe, it, expect, mock } from 'bun:test';
import { injectMemoryContext } from './memory-injection.js';
import type { MemoryInjectionDeps, MemoryManagerLike } from './memory-injection.js';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeSearchResult(snippet: string) {
  return {
    snippet,
    path: '/memory/test.md',
    startLine: 1,
    endLine: 5,
    score: 0.9,
    source: 'keyword' as const,
  };
}

function makeDeps(overrides: Partial<MemoryInjectionDeps> = {}): MemoryInjectionDeps {
  const searchMock = mock(async (_query: string) => []);
  const manager: MemoryManagerLike = { search: searchMock };

  return {
    getMemoryManager: async () => manager,
    extractTickers: (text) => {
      // Simple mock extractor: returns uppercase words prefixed with $
      return [...text.matchAll(/\$([A-Z]+)/g)].map(m => m[1]!);
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// No tickers in query
// ---------------------------------------------------------------------------

describe('injectMemoryContext — no tickers', () => {
  it('returns the original prompt unchanged when no tickers found and semantic search is empty', async () => {
    const deps = makeDeps();
    const result = await injectMemoryContext('what is the market doing?', 'analyze it', deps);
    expect(result).toBe('analyze it');
  });

  it('still calls the semantic search pass even when no tickers found', async () => {
    const searchCalls: string[] = [];
    const deps = makeDeps({
      getMemoryManager: async () => ({
        search: async (q: string) => { searchCalls.push(q); return []; },
      }),
    });
    await injectMemoryContext('gold price forecast', 'prompt text', deps);
    // semantic pass uses the full query as the search term
    expect(searchCalls).toContain('gold price forecast');
  });

  it('injects semantic results even without any ticker', async () => {
    const deps = makeDeps({
      getMemoryManager: async () => ({
        search: async () => [makeSearchResult('Gold hit $3,200 per oz')],
      }),
    });
    const result = await injectMemoryContext('gold price forecast', 'my prompt', deps);
    expect(result).toContain('Gold hit $3,200 per oz');
    expect(result).toContain('[context]');
  });

  it('can disable the semantic pass with maxSemanticResults: 0', async () => {
    const searchCalls: string[] = [];
    const deps = makeDeps({
      maxSemanticResults: 0,
      getMemoryManager: async () => ({
        search: async (q: string) => { searchCalls.push(q); return []; },
      }),
    });
    await injectMemoryContext('general question', 'prompt text', deps);
    expect(searchCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tickers found, memories returned
// ---------------------------------------------------------------------------

describe('injectMemoryContext — memories found', () => {
  it('prepends "📚 Prior Research:" block when memories exist', async () => {
    const deps = makeDeps({
      getMemoryManager: async () => ({
        search: async () => [makeSearchResult('AAPL had strong Q4 earnings')],
      }),
    });
    const result = await injectMemoryContext('analyse $AAPL', 'my prompt', deps);
    expect(result).toContain('📚 Prior Research:');
    expect(result).toContain('AAPL had strong Q4 earnings');
  });

  it('ends the prior-research block with the original prompt', async () => {
    const deps = makeDeps({
      getMemoryManager: async () => ({
        search: async () => [makeSearchResult('some context')],
      }),
    });
    const result = await injectMemoryContext('$AAPL analysis', 'original prompt text', deps);
    expect(result.endsWith('original prompt text')).toBe(true);
  });

  it('labels each snippet line with the ticker', async () => {
    const deps = makeDeps({
      getMemoryManager: async () => ({
        search: async (ticker: string) => [makeSearchResult(`${ticker} had revenue of $100B`)],
      }),
    });
    const result = await injectMemoryContext('$AAPL results', 'prompt', deps);
    expect(result).toContain('[AAPL]');
  });

  it('includes multiple snippets per ticker (up to maxResultsPerTicker)', async () => {
    const snippets = ['Snippet A', 'Snippet B', 'Snippet C'];
    const deps = makeDeps({
      getMemoryManager: async () => ({
        search: async () => snippets.map(makeSearchResult),
      }),
      maxResultsPerTicker: 3,
    });
    const result = await injectMemoryContext('$AAPL deep dive', 'prompt', deps);
    for (const s of snippets) {
      expect(result).toContain(s);
    }
  });

  it('respects maxResultsPerTicker cap', async () => {
    const deps = makeDeps({
      maxSemanticResults: 0,        // isolate: only count ticker-pass bullets
      getMemoryManager: async () => ({
        search: async (_ticker: string, opts?: { maxResults?: number }) => {
          const count = opts?.maxResults ?? 99;
          return Array.from({ length: count }, (_, i) => makeSearchResult(`snippet ${i}`));
        },
      }),
      maxResultsPerTicker: 2,
    });
    const result = await injectMemoryContext('$AAPL', 'prompt', deps);
    const bulletCount = (result.match(/^• /gm) ?? []).length;
    expect(bulletCount).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Multiple tickers
// ---------------------------------------------------------------------------

describe('injectMemoryContext — multiple tickers', () => {
  it('looks up each ticker separately', async () => {
    const queriedTickers: string[] = [];
    const deps = makeDeps({
      getMemoryManager: async () => ({
        search: async (ticker: string) => {
          queriedTickers.push(ticker);
          return [makeSearchResult(`${ticker} snippet`)];
        },
      }),
    });
    await injectMemoryContext('compare $AAPL vs $MSFT', 'prompt', deps);
    expect(queriedTickers).toContain('AAPL');
    expect(queriedTickers).toContain('MSFT');
  });

  it('caps at maxTickers (default 2)', async () => {
    const queriedTickers: string[] = [];
    const deps = makeDeps({
      extractTickers: () => ['AAPL', 'MSFT', 'GOOG', 'NVDA'],
      maxSemanticResults: 0,        // disable semantic pass for this ticker-cap test
      getMemoryManager: async () => ({
        search: async (ticker: string) => {
          queriedTickers.push(ticker);
          return [makeSearchResult(`${ticker} snippet`)];
        },
      }),
    });
    await injectMemoryContext('any query', 'prompt', deps);
    expect(queriedTickers).toHaveLength(2);
  });

  it('respects a custom maxTickers value', async () => {
    const queriedTickers: string[] = [];
    const deps = makeDeps({
      extractTickers: () => ['A', 'B', 'C'],
      maxTickers: 3,
      maxSemanticResults: 0,        // isolate: count only ticker-pass searches
      getMemoryManager: async () => ({
        search: async (ticker: string) => {
          queriedTickers.push(ticker);
          return [makeSearchResult(`${ticker} data`)];
        },
      }),
    });
    await injectMemoryContext('query', 'prompt', deps);
    expect(queriedTickers).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Empty results
// ---------------------------------------------------------------------------

describe('injectMemoryContext — empty memory results', () => {
  it('returns prompt unchanged when search returns no results', async () => {
    const deps = makeDeps({
      getMemoryManager: async () => ({ search: async () => [] }),
    });
    const result = await injectMemoryContext('$AAPL earnings', 'original', deps);
    expect(result).toBe('original');
  });

  it('does not prepend block when all tickers return empty results', async () => {
    const deps = makeDeps({
      extractTickers: () => ['AAPL', 'MSFT'],
      getMemoryManager: async () => ({ search: async () => [] }),
    });
    const result = await injectMemoryContext('query', 'prompt', deps);
    expect(result).toBe('prompt');
    expect(result).not.toContain('📚');
  });
});

// ---------------------------------------------------------------------------
// Error resilience
// ---------------------------------------------------------------------------

describe('injectMemoryContext — error resilience', () => {
  it('returns prompt unchanged when getMemoryManager throws', async () => {
    const deps = makeDeps({
      getMemoryManager: async () => { throw new Error('DB unavailable'); },
    });
    const result = await injectMemoryContext('$AAPL question', 'my prompt', deps);
    expect(result).toBe('my prompt');
  });

  it('returns prompt unchanged when memory.search throws', async () => {
    const deps = makeDeps({
      getMemoryManager: async () => ({
        search: async () => { throw new Error('search failed'); },
      }),
    });
    const result = await injectMemoryContext('$AAPL question', 'my prompt', deps);
    expect(result).toBe('my prompt');
  });

  it('returns prompt unchanged when extractTickers throws', async () => {
    const deps = makeDeps({
      extractTickers: () => { throw new Error('regex exploded'); },
    });
    const result = await injectMemoryContext('$AAPL question', 'my prompt', deps);
    expect(result).toBe('my prompt');
  });
});

// ---------------------------------------------------------------------------
// Deduplication across ticker and semantic passes
// ---------------------------------------------------------------------------

describe('injectMemoryContext — deduplication', () => {
  it('de-duplicates identical snippets returned by both ticker and semantic passes', async () => {
    const sharedSnippet = 'AAPL reported $120B revenue';
    const deps = makeDeps({
      getMemoryManager: async () => ({
        // same snippet regardless of query — simulates ticker + semantic returning same fact
        search: async () => [makeSearchResult(sharedSnippet)],
      }),
    });
    const result = await injectMemoryContext('$AAPL earnings', 'prompt', deps);
    const occurrences = (result.match(/AAPL reported \$120B revenue/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});

describe('injectMemoryContext — snippet length', () => {
  it('truncates long snippets to snippetLength characters', async () => {
    const longSnippet = 'x'.repeat(1000);
    const deps = makeDeps({
      getMemoryManager: async () => ({
        search: async () => [makeSearchResult(longSnippet)],
      }),
      snippetLength: 200,
    });
    const result = await injectMemoryContext('$AAPL', 'prompt', deps);
    // each line: "[AAPL] " (7) + snippet (200) = 207 chars max per bullet
    const bulletLine = result.split('\n').find(l => l.startsWith('•'));
    expect(bulletLine).toBeDefined();
    // strip "• [AAPL] " prefix (9 chars) → snippet portion
    const snippetPart = bulletLine!.replace(/^• \[.*?\] /, '');
    expect(snippetPart.length).toBeLessThanOrEqual(200);
  });

  it('uses default snippetLength of 300 when not specified', async () => {
    const longSnippet = 'y'.repeat(500);
    const deps = makeDeps({
      getMemoryManager: async () => ({
        search: async () => [makeSearchResult(longSnippet)],
      }),
    });
    const result = await injectMemoryContext('$AAPL', 'prompt', deps);
    const bulletLine = result.split('\n').find(l => l.startsWith('•'));
    const snippetPart = bulletLine!.replace(/^• \[.*?\] /, '');
    expect(snippetPart.length).toBeLessThanOrEqual(300);
  });
});
