/**
 * Memory auto-injection helper.
 *
 * Extracted from Agent.injectMemoryContext() to allow unit testing without
 * constructing a full Agent instance.  The real agent wires in the actual
 * MemoryManager and extractTickers; tests supply lightweight fakes.
 */

import type { MemorySearchResult, MemorySearchOptions } from '../memory/types.js';

export interface MemoryManagerLike {
  search(query: string, options?: MemorySearchOptions): Promise<MemorySearchResult[]>;
}

export interface MemoryInjectionDeps {
  getMemoryManager: () => Promise<MemoryManagerLike>;
  extractTickers: (text: string) => string[];
  /** Maximum tickers to look up. Default: 2 */
  maxTickers?: number;
  /** Maximum memory results per ticker. Default: 3 */
  maxResultsPerTicker?: number;
  /**
   * Maximum results from the full-query semantic search.
   * Set to 0 to disable the semantic search pass. Default: 3
   */
  maxSemanticResults?: number;
  /** Maximum characters kept from each snippet. Default: 300 */
  snippetLength?: number;
}

/**
 * Prepends a "📚 Prior Research" block to `prompt` when prior memories exist
 * for the current query.
 *
 * Two search passes (results are deduplicated):
 * 1. **Ticker-based**: searches for each ticker symbol found in the query.
 *    Catches specific stock/crypto facts ("AAPL P/E was 28x last session").
 * 2. **Semantic / full-query**: searches using the full query text.
 *    Catches non-ticker memories: macro topics, Fed rates, gold price, sector
 *    notes, and any prior research that didn't centre on a ticker symbol.
 *    This is what makes memory injection *query-specific* — a query about
 *    "gold price forecast" gets gold memories, not the previous AAPL session.
 *
 * Returns `prompt` unchanged when no relevant memories are found or any step
 * throws.
 */
export async function injectMemoryContext(
  query: string,
  prompt: string,
  deps: MemoryInjectionDeps,
): Promise<string> {
  const {
    getMemoryManager,
    extractTickers,
    maxTickers = 2,
    maxResultsPerTicker = 3,
    maxSemanticResults = 3,
    snippetLength = 300,
  } = deps;

  try {
    const memoryManager = await getMemoryManager();
    const seen = new Set<string>(); // deduplicate snippets across both passes
    const lines: string[] = [];

    const addResult = (label: string, r: MemorySearchResult) => {
      const snippet = r.snippet.trim().replace(/\s+/g, ' ').slice(0, snippetLength);
      const key = snippet.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      lines.push(`[${label}] ${snippet}`);
    };

    // Pass 1: ticker-specific search
    const tickers = extractTickers(query).slice(0, maxTickers);
    for (const ticker of tickers) {
      const results = await memoryManager.search(ticker, { maxResults: maxResultsPerTicker });
      for (const r of results) addResult(ticker, r);
    }

    // Pass 2: full-query semantic search (query-specific context).
    // Always run, even when no tickers were found — this handles macro/sector
    // queries like "Fed rate cut", "gold forecast", "oil supply chain", etc.
    if (maxSemanticResults > 0) {
      const semanticResults = await memoryManager.search(query, {
        maxResults: maxSemanticResults,
      });
      for (const r of semanticResults) addResult('context', r);
    }

    if (lines.length === 0) return prompt;

    const block = `📚 Prior Research:\n${lines.map(s => `• ${s}`).join('\n')}\n\n`;
    return block + prompt;
  } catch {
    return prompt;
  }
}
