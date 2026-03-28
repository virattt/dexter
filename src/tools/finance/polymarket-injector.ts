/**
 * Polymarket pre-query context injector.
 *
 * Before the agent starts reasoning, this module:
 *   1. Calls `extractSignals()` to identify what events can move the asset
 *   2. Fetches Polymarket markets for each signal (in parallel)
 *   3. Prepends a categorised "🎯 Prediction Markets" block to the prompt
 *
 * Fully silent on failure — returns the original prompt unchanged.
 * Deps-injected for testability (no direct Polymarket API calls in tests).
 */

import type { SignalCategory } from './signal-extractor.js';
import type { PolymarketMarketResult } from './polymarket.js';

export type { PolymarketMarketResult };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolymarketInjectorDeps {
  extractSignals: (query: string) => SignalCategory[];
  fetchMarkets: (query: string, limit: number) => Promise<PolymarketMarketResult[]>;
  /** Maximum number of signals to search (default: 4) */
  maxSignals?: number;
  /** Minimum 24-hour volume (USD) to include a market (default: 0) */
  minLiquidity?: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Prepends a "🎯 Prediction Markets" block to `prompt` when relevant Polymarket
 * markets are found for the signals extracted from `query`. Returns `prompt`
 * unchanged if no markets are found or any step throws.
 */
export async function injectPolymarketContext(
  query: string,
  prompt: string,
  deps: PolymarketInjectorDeps,
): Promise<string> {
  try {
    const { extractSignals, fetchMarkets, maxSignals = 4, minLiquidity = 0 } = deps;

    const signals = extractSignals(query).slice(0, maxSignals);
    if (signals.length === 0) return prompt;

    // Fetch markets for each signal in parallel; ignore individual failures
    const settled = await Promise.allSettled(
      signals.map(async (signal) => ({
        signal,
        markets: await fetchMarkets(signal.searchPhrase, 2),
      })),
    );

    // Build categorised output sections
    const sections: string[] = [];

    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      const { signal, markets } = result.value;
      const visible = markets.filter((m) => m.volume24h >= minLiquidity);
      if (visible.length === 0) continue;

      const lines = visible
        .map((m) => `  • "${m.question}" → ${Math.round(m.probability * 100)}% YES`)
        .join('\n');

      const dash = '─'.repeat(Math.max(2, 40 - signal.name.length));
      sections.push(`  ─ ${signal.name} ${dash}\n${lines}`);
    }

    if (sections.length === 0) return prompt;

    const block = `🎯 Prediction Markets (crowd-implied probabilities):\n${sections.join('\n')}`;
    return `${block}\n\n${prompt}`;
  } catch {
    return prompt;
  }
}
