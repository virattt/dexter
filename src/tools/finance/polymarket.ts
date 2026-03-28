import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { polymarketBreaker } from '../../utils/circuit-breaker.js';

// ---------------------------------------------------------------------------
// Description (injected into system prompt)
// ---------------------------------------------------------------------------

export const POLYMARKET_DESCRIPTION = `
Searches Polymarket prediction markets for crowd-sourced probability estimates on real-world events. Returns market-implied probabilities that reflect the collective wisdom of traders betting real money.

## When to Use

- Gauging crowd probability for macroeconomic events: Fed rate cuts, recessions, GDP outcomes
- Assessing geopolitical risk for a thesis: wars, elections, policy changes, trade tariffs
- Validating or stress-testing an investment hypothesis against market-implied odds
- Finding what events the crowd believes are most likely in a given time horizon
- Checking probability of a company-specific event: bankruptcy, acquisition, regulatory outcome
- Generating contrarian ideas when market prices diverge from prediction market probabilities

## When NOT to Use

- Real-time stock prices or financial metrics (use get_market_data or get_financials)
- Detailed company fundamentals (use get_financials)
- News or breaking events (use web_search)
- Prediction markets are not infallible — treat probabilities as one data point, not ground truth

## Usage Notes

- Use broad natural language queries: "Fed rate cut 2026", "US recession", "tariffs", "oil price"
- Returns top markets sorted by 24h trading volume (most liquid / most relevant first)
- YES price = implied probability (e.g. 0.72 = 72% chance the event happens)
- Liquidity indicates how confident / contested the market is — higher = more reliable signal
- Combine with financial analysis: e.g. if recession probability is 35%, stress-test DCF with lower growth assumptions
`.trim();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PolymarketMarket {
  id: string;
  question: string;
  outcomes: string;
  outcomePrices: string;
  endDateIso?: string;
  volume24hr?: number;
  volumeNum?: number;
  liquidityNum?: number;
  active: boolean;
  closed: boolean;
  description?: string;
}

interface PolymarketEvent {
  id: string;
  title: string;
  endDate?: string;
  markets?: PolymarketMarket[];
  volume24hr?: number;
}

interface FormattedMarket {
  question: string;
  probabilities: Record<string, string>;
  endDate: string | null;
  volume24h: string;
  liquidity: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GAMMA_BASE = 'https://gamma-api.polymarket.com';

function parseJsonField<T>(raw: string | T): T {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return [] as unknown as T;
    }
  }
  return raw;
}

function formatVolume(n: number | undefined): string {
  if (!n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function formatMarket(m: PolymarketMarket): FormattedMarket | null {
  const outcomes = parseJsonField<string[]>(m.outcomes);
  const prices = parseJsonField<string[]>(m.outcomePrices);
  if (!outcomes.length || !prices.length) return null;

  const probabilities: Record<string, string> = {};
  outcomes.forEach((outcome, i) => {
    const pct = parseFloat(prices[i] ?? '0') * 100;
    probabilities[outcome] = `${pct.toFixed(1)}%`;
  });

  return {
    question: m.question,
    probabilities,
    endDate: m.endDateIso ?? null,
    volume24h: formatVolume(m.volume24hr),
    liquidity: formatVolume(m.liquidityNum),
  };
}

async function searchEvents(query: string, limit: number): Promise<FormattedMarket[]> {
  const params = new URLSearchParams({
    limit: String(limit * 2), // fetch extra — some events have no active markets
    active: 'true',
    closed: 'false',
    order: 'volume24hr',
    ascending: 'false',
    keyword: query,
  });

  const res = await fetch(`${GAMMA_BASE}/events?${params}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    polymarketBreaker.onFailure();
    throw new Error(`Polymarket API error: ${res.status}`);
  }
  polymarketBreaker.onSuccess();

  const events: PolymarketEvent[] = await res.json() as PolymarketEvent[];

  const results: FormattedMarket[] = [];
  for (const event of events) {
    if (!event.markets?.length) continue;
    // Sort markets within event by volume desc, take top 3 per event
    const sorted = [...event.markets]
      .filter((m) => m.active && !m.closed)
      .sort((a, b) => (b.volume24hr ?? 0) - (a.volume24hr ?? 0))
      .slice(0, 3);
    for (const m of sorted) {
      const fmt = formatMarket(m);
      if (fmt) results.push(fmt);
      if (results.length >= limit) return results;
    }
  }
  return results;
}

async function searchMarkets(query: string, limit: number): Promise<FormattedMarket[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    active: 'true',
    closed: 'false',
    order: 'volume24hr',
    ascending: 'false',
    keyword: query,
  });

  const res = await fetch(`${GAMMA_BASE}/markets?${params}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    polymarketBreaker.onFailure();
    throw new Error(`Polymarket API error: ${res.status}`);
  }
  polymarketBreaker.onSuccess();

  const markets: PolymarketMarket[] = await res.json() as PolymarketMarket[];
  return markets
    .filter((m) => m.active && !m.closed)
    .map(formatMarket)
    .filter((m): m is FormattedMarket => m !== null);
}

function formatResults(markets: FormattedMarket[], query: string): string {
  if (markets.length === 0) {
    return `No active Polymarket prediction markets found for "${query}". Try broader keywords.`;
  }

  const lines: string[] = [
    `Polymarket — prediction market probabilities for: "${query}"`,
    `(Prices reflect crowd-sourced odds from real-money traders)\n`,
  ];

  for (const m of markets) {
    lines.push(`▸ ${m.question}`);
    for (const [outcome, prob] of Object.entries(m.probabilities)) {
      lines.push(`    ${outcome}: ${prob}`);
    }
    const meta: string[] = [];
    if (m.endDate) meta.push(`expires ${m.endDate}`);
    if (m.volume24h !== '$0') meta.push(`24h vol ${m.volume24h}`);
    if (m.liquidity !== '$0') meta.push(`liquidity ${m.liquidity}`);
    if (meta.length) lines.push(`    ${meta.join(' · ')}`);
    lines.push('');
  }

  lines.push('Source: polymarket.com — probabilities are market-implied, not guaranteed.');
  return lines.join('\n').trim();
}

// ---------------------------------------------------------------------------
// Structured fetch (for programmatic use by polymarket-injector)
// ---------------------------------------------------------------------------

/** Structured Polymarket market result — numeric values, suitable for the injector. */
export interface PolymarketMarketResult {
  question: string;
  /** YES probability [0, 1] */
  probability: number;
  /** 24-hour trading volume in USD */
  volume24h: number;
}

function parseYesProbability(probs: Record<string, string>): number {
  const key = Object.keys(probs).find((k) => k.toLowerCase() === 'yes') ?? Object.keys(probs)[0];
  if (!key) return 0.5;
  return Math.min(1, Math.max(0, parseFloat(probs[key].replace('%', '')) / 100));
}

function parseVolumeStr(s: string): number {
  const n = parseFloat(s.replace(/[$,]/g, ''));
  if (isNaN(n)) return 0;
  if (s.includes('M')) return n * 1_000_000;
  if (s.includes('K')) return n * 1_000;
  return n;
}

/**
 * Fetches Polymarket markets for `query` and returns structured numeric results.
 * Used by `polymarket-injector` for pre-query context injection.
 * Throws on network / API error (caller should handle).
 */
export async function fetchPolymarketMarkets(
  query: string,
  limit: number,
): Promise<PolymarketMarketResult[]> {
  const [eventResults, marketResults] = await Promise.allSettled([
    searchEvents(query, limit),
    searchMarkets(query, limit),
  ]);

  const seen = new Set<string>();
  const combined: FormattedMarket[] = [];

  const addIfNew = (m: FormattedMarket) => {
    if (!seen.has(m.question)) { seen.add(m.question); combined.push(m); }
  };
  if (eventResults.status === 'fulfilled') eventResults.value.forEach(addIfNew);
  if (marketResults.status === 'fulfilled') marketResults.value.forEach(addIfNew);

  return combined.slice(0, limit).map((m) => ({
    question: m.question,
    probability: parseYesProbability(m.probabilities),
    volume24h: parseVolumeStr(m.volume24h),
  }));
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const polymarketTool = new DynamicStructuredTool({
  name: 'polymarket_search',
  description: 'Search Polymarket prediction markets for crowd-sourced probability estimates on macro, geopolitical, and financial events.',
  schema: z.object({
    query: z.string().describe(
      'Natural language search query, e.g. "Fed rate cut 2026", "US recession", "tariffs", "OPEC oil production"',
    ),
    limit: z.number().optional().default(8).describe(
      'Max number of markets to return (default 8)',
    ),
  }),
  func: async ({ query, limit = 8 }, _config?: unknown) => {
    if (polymarketBreaker.isOpen()) {
      return formatToolResult({ error: 'Polymarket API is temporarily unavailable (circuit open). Try again in a few minutes.' });
    }
    try {
      // Search events first (richer structure), fall back to direct market search
      const [eventResults, marketResults] = await Promise.allSettled([
        searchEvents(query, limit),
        searchMarkets(query, limit),
      ]);

      // Merge: prefer event results, fill remaining slots from direct markets
      const seen = new Set<string>();
      const combined: FormattedMarket[] = [];

      const addIfNew = (m: FormattedMarket) => {
        if (!seen.has(m.question)) {
          seen.add(m.question);
          combined.push(m);
        }
      };

      if (eventResults.status === 'fulfilled') {
        eventResults.value.forEach(addIfNew);
      }
      if (marketResults.status === 'fulfilled' && combined.length < limit) {
        marketResults.value.forEach(addIfNew);
      }

      return formatToolResult({ result: formatResults(combined.slice(0, limit), query) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return formatToolResult({ error: `Polymarket search failed: ${msg}` });
    }
  },
});
