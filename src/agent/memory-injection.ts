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
  /** Maximum characters kept from each snippet. Default: 300 */
  snippetLength?: number;
}

/**
 * Prepends a "📚 Prior Research" block to `prompt` when prior memories exist
 * for tickers found in `query`.  Returns `prompt` unchanged when no relevant
 * memories are found or any step throws.
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
    snippetLength = 300,
  } = deps;

  try {
    const memoryManager = await getMemoryManager();
    const tickers = extractTickers(query).slice(0, maxTickers);
    if (tickers.length === 0) return prompt;

    const lines: string[] = [];
    for (const ticker of tickers) {
      const results = await memoryManager.search(ticker, { maxResults: maxResultsPerTicker });
      for (const r of results) {
        const snippet = r.snippet.trim().replace(/\s+/g, ' ').slice(0, snippetLength);
        lines.push(`[${ticker}] ${snippet}`);
      }
    }

    if (lines.length === 0) return prompt;

    const block = `📚 Prior Research:\n${lines.map(s => `• ${s}`).join('\n')}\n\n`;
    return block + prompt;
  } catch {
    return prompt;
  }
}
