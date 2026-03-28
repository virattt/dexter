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

## Query Guidelines (critical for good results)

The Polymarket search API uses simple text matching against market question titles.
Short, specific queries work far better than long compound strings.

**✅ Effective queries (short, topic-focused):**
- Company name only: \`"NVIDIA"\`, \`"Apple"\`, \`"Tesla"\`
- Company + topic: \`"NVIDIA earnings"\`, \`"Apple revenue"\`
- Macro topic: \`"Fed rate cut"\`, \`"US recession"\`, \`"FOMC"\`
- Event keyword: \`"tariff"\`, \`"oil price"\`, \`"FDA approval"\`
- Crypto: \`"Bitcoin ETF"\`, \`"crypto regulation"\`

**❌ Ineffective queries (too long, use ticker symbols, include years):**
- \`"NVDA earnings beat 2026"\` → use \`"NVIDIA earnings"\` instead
- \`"Fed rate cut Q2 2026"\` → use \`"Fed rate cut"\` instead
- \`"chip export controls 2026"\` → use \`"chip export controls"\` instead

**Key rules:**
- Use the company's full name, not the ticker symbol (\`"NVIDIA"\` not \`"NVDA"\`)
- Omit year/quarter suffixes — the API searches active markets, which are current
- 2–3 words is usually optimal; never more than 4
- Returns top markets sorted by 24h trading volume (most liquid = most reliable signal)
- YES price = implied probability (e.g. 0.72 = 72% chance the event happens)
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

// ---------------------------------------------------------------------------
// Client-side text filtering (API keyword param is unreliable)
// ---------------------------------------------------------------------------

const TEXT_FILTER_STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'not', 'will', 'can', 'has', 'was',
  'how', 'what', 'that', 'this', 'its', 'from', 'with',
]);

/**
 * Returns true if the Polymarket question (or event title) contains at least
 * one significant word from the search query.
 *
 * The Gamma API `keyword` parameter is non-functional — it always returns
 * the highest-volume markets globally regardless of the query. This function
 * provides all client-side relevance filtering after every fetch.
 *
 * Exported for testing.
 */
export function questionMatchesQuery(text: string, query: string): boolean {
  const words = query
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 3 && !TEXT_FILTER_STOP_WORDS.has(w));
  if (words.length === 0) return true;
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

// ---------------------------------------------------------------------------
// Tag-slug map  (verified against live Gamma API — /events endpoint only)
// ---------------------------------------------------------------------------
//
// IMPORTANT: tag_slug ONLY works on the /events endpoint.
//            The /markets endpoint ignores it entirely.
//            The `keyword` parameter on BOTH endpoints is non-functional —
//            it always returns the same top-volume global markets.
//
// Slugs were validated by probing GET /events?tag_slug=X and confirming
// at least 3 relevant events are returned.

const TAG_SLUG_PATTERNS: Array<{ patterns: string[]; slugs: string[] }> = [
  { patterns: ['bitcoin', 'btc'],
    slugs: ['bitcoin', 'crypto-prices', 'crypto'] },
  { patterns: ['ethereum', 'eth'],
    slugs: ['ethereum', 'crypto-prices', 'crypto'] },
  { patterns: ['solana', 'sol', 'crypto', 'defi', 'nft', 'web3'],
    slugs: ['crypto-prices', 'crypto'] },
  { patterns: ['fed', 'fomc', 'federal reserve', 'rate cut', 'rate hike',
               'interest rate', 'basis point'],
    slugs: ['fed-rates', 'fed', 'economic-policy'] },
  { patterns: ['recession', 'gdp', 'inflation', 'cpi', 'unemployment', 'economic'],
    slugs: ['economy', 'business', 'economic-policy'] },
  { patterns: ['tariff', 'trade war', 'trade deal', 'import duty'],
    slugs: ['tariffs', 'politics', 'world'] },
  { patterns: ['oil', 'opec', 'crude', 'energy'],
    slugs: ['commodities'] },
  { patterns: ['gold', 'silver', 'copper', 'platinum', 'palladium', 'precious metal', 'metal'],
    slugs: ['commodities'] },
  { patterns: ['wheat', 'corn', 'soybean', 'coffee', 'sugar', 'grain', 'natural gas'],
    slugs: ['commodities'] },
  { patterns: ['fda', 'drug approval', 'clinical trial', 'pharma', 'pfizer', 'moderna', 'eli lilly'],
    slugs: ['science', 'health'] },
  { patterns: ['nvidia', 'apple', 'microsoft', 'google', 'amazon', 'meta',
               'tesla', 'broadcom', 'qualcomm', 'intel', 'spacex'],
    slugs: ['big-tech', 'tech', 'business'] },
  { patterns: ['earnings', 'revenue', 'eps', 'quarterly results'],
    slugs: ['business', 'finance'] },
  { patterns: ['ai regulation', 'artificial intelligence', 'chatgpt', 'openai', 'antitrust'],
    slugs: ['tech', 'science'] },
  { patterns: ['middle east', 'ukraine', 'russia', 'china', 'taiwan', 'war', 'conflict', 'sanctions', 'geopolitical'],
    slugs: ['world', 'politics'] },
  { patterns: ['election', 'president', 'senate', 'congress', 'trump', 'white house'],
    slugs: ['elections', 'us-politics', 'politics'] },
  { patterns: ['ipo', 'initial public offering'],
    slugs: ['ipos', 'ipo', 'business'] },
];

/** Returns an ordered list of tag slugs to try for the given query. Exported for testing. */
export function inferTagSlugs(query: string): string[] {
  const lower = query.toLowerCase();
  for (const { patterns, slugs } of TAG_SLUG_PATTERNS) {
    if (patterns.some((p) => lower.includes(p))) return slugs;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Core fetch helpers
// ---------------------------------------------------------------------------

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

/**
 * Fetches events from the Gamma API using a specific tag slug and applies
 * client-side text filtering. This is the ONLY reliable search method —
 * the `keyword` param on both /events and /markets endpoints is non-functional.
 *
 * @param tagSlug   - Verified Polymarket tag slug (e.g. 'commodities', 'fed-rates')
 * @param textFilter - Query string used for client-side relevance filtering
 * @param limit     - Max markets to return after filtering
 */
async function searchEventsByTag(
  tagSlug: string,
  textFilter: string,
  limit: number,
): Promise<FormattedMarket[]> {
  try {
    const params = new URLSearchParams({
      limit: String(Math.min(limit * 8, 80)), // fetch wide — text filter reduces count
      active: 'true',
      closed: 'false',
      order: 'volume24hr',
      ascending: 'false',
      tag_slug: tagSlug,
    });
    const res = await fetch(`${GAMMA_BASE}/events?${params}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const events: PolymarketEvent[] = await res.json() as PolymarketEvent[];

    const results: FormattedMarket[] = [];
    for (const event of events) {
      if (!event.markets?.length) continue;
      const titleMatches = questionMatchesQuery(event.title ?? '', textFilter);
      const sorted = [...event.markets]
        .filter((m) => m.active && !m.closed)
        .sort((a, b) => (b.volume24hr ?? 0) - (a.volume24hr ?? 0))
        .slice(0, 4); // up to 4 markets per event
      for (const m of sorted) {
        if (!titleMatches && !questionMatchesQuery(m.question, textFilter)) continue;
        const fmt = formatMarket(m);
        if (fmt) results.push(fmt);
        if (results.length >= limit) return results;
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Primary search function. Uses tag slugs + client-side text filtering.
 *
 * Strategy:
 *  1. Infer tag slugs from query → fetch /events?tag_slug=X (works reliably)
 *  2. If tags infer 0 results or no tags found, do a broad top-events fetch
 *     and rely entirely on the client-side text filter.
 */
async function searchEvents(query: string, limit: number): Promise<FormattedMarket[]> {
  const slugs = inferTagSlugs(query);

  if (slugs.length > 0) {
    // Fetch all tag buckets in parallel, merge, text-filter, deduplicate
    const settled = await Promise.allSettled(
      slugs.map((slug) => searchEventsByTag(slug, query, limit)),
    );

    const seen = new Set<string>();
    const combined: FormattedMarket[] = [];
    for (const r of settled) {
      if (r.status !== 'fulfilled') continue;
      for (const m of r.value) {
        if (!seen.has(m.question)) { seen.add(m.question); combined.push(m); }
        if (combined.length >= limit) return combined;
      }
    }
    if (combined.length > 0) return combined;
  }

  // Broad fallback: no tags inferred or tags returned 0 results.
  // Fetch top events globally and rely on text filter.
  try {
    const params = new URLSearchParams({
      limit: String(limit * 10),
      active: 'true',
      closed: 'false',
      order: 'volume24hr',
      ascending: 'false',
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
    const seen = new Set<string>();
    for (const event of events) {
      if (!event.markets?.length) continue;
      const titleMatches = questionMatchesQuery(event.title ?? '', query);
      const sorted = [...event.markets]
        .filter((m) => m.active && !m.closed)
        .sort((a, b) => (b.volume24hr ?? 0) - (a.volume24hr ?? 0))
        .slice(0, 2);
      for (const m of sorted) {
        if (!titleMatches && !questionMatchesQuery(m.question, query)) continue;
        const fmt = formatMarket(m);
        if (fmt && !seen.has(fmt.question)) {
          seen.add(fmt.question);
          results.push(fmt);
        }
        if (results.length >= limit) return results;
      }
    }
    return results;
  } catch (err) {
    if (slugs.length === 0) throw err; // only re-throw if we had no tag results at all
    return [];
  }
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
 * Uses tag-based search exclusively — the Gamma API keyword param is non-functional.
 */
export async function fetchPolymarketMarkets(
  query: string,
  limit: number,
): Promise<PolymarketMarketResult[]> {
  const markets = await searchEvents(query, limit);
  return markets.map((m) => ({
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
      const markets = await searchEvents(query, limit);
      return formatToolResult({ result: formatResults(markets, query) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return formatToolResult({ error: `Polymarket search failed: ${msg}` });
    }
  },
});


