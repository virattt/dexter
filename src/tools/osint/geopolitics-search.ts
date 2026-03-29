/**
 * geopolitics_search tool
 *
 * Multi-source geopolitical intelligence gatherer that correlates world events
 * to financial asset implications. Sources (all free / no-key-required):
 *
 *   1. GDELT DOC 2.0 — geopolitical news article index
 *   2. Bluesky AT Protocol — OSINT community posts
 *   3. web_search — Exa/Tavily for broader coverage (if available)
 *   4. X/Twitter — optional, only used when X_BEARER_TOKEN is set
 *
 * Output is deterministic: event classification and asset mapping are
 * rule-based, not LLM-generated.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import { fetchGdeltArticles, deduplicateArticles, parseGdeltDate } from './gdelt.js';
import { searchBskyPosts, bskyUriToWebUrl, deduplicatePosts } from './bluesky.js';
import { detectCategories, getAssetImplications, getMappingForCategory, buildGdeltThemeFilter } from './event-asset-map.js';
import type { AssetCorrelation } from './event-asset-map.js';
import type { EventCategory } from './accounts.js';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface GeopoliticsEvent {
  summary: string;
  category: EventCategory;
  source: 'gdelt' | 'bluesky' | 'web';
  url: string;
  publishedAt: string;
  domain?: string;
  engagement?: number;
  /** Sentiment tone: negative = fear/conflict, positive = resolution */
  tone?: number;
}

export interface AssetImplication {
  ticker: string;
  name: string;
  assetClass: string;
  direction: 'risk-up' | 'risk-down' | 'volatility';
  rationale: string;
  confidence: number;
  isWatchlistTicker: boolean;
}

export interface SourceSummary {
  name: string;
  articleCount: number;
  topDomains: string[];
}

export interface GeopoliticsResult {
  topic: string;
  timeWindow: string;
  detectedCategories: EventCategory[];
  events: GeopoliticsEvent[];
  assetImplications: AssetImplication[];
  watchlistHits: string[];
  confidence: 'high' | 'medium' | 'low';
  sources: SourceSummary[];
  /** ISO timestamp of when the search was run */
  fetchedAt: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────────────────────────

const INPUT_SCHEMA = z.object({
  topic: z.string().describe(
    'Geopolitical topic to research, e.g. "Russia Ukraine ceasefire", "China Taiwan military exercises", "Middle East oil supply"'
  ),
  categories: z
    .array(
      z.enum([
        'ukraine-russia', 'middle-east', 'china-taiwan', 'us-china-trade',
        'iran', 'north-korea', 'cyberattack', 'sanctions', 'election-risk',
        'energy-supply', 'commodity-shock', 'pandemic-risk', 'general-conflict',
      ])
    )
    .optional()
    .describe('Specific event categories to focus on. If omitted, categories are auto-detected from the topic.'),
  timeWindow: z
    .enum(['1d', '3d', '7d'])
    .default('1d')
    .describe('How far back to search: 1d = last 24h, 3d = 72h, 7d = last week'),
  watchlistTickers: z
    .array(z.string())
    .optional()
    .describe('User watchlist tickers to cross-reference against asset implications'),
  limit: z
    .number()
    .int()
    .min(5)
    .max(50)
    .default(20)
    .describe('Maximum number of articles/posts to fetch per source'),
});

type GeopoliticsInput = z.infer<typeof INPUT_SCHEMA>;

// ──────────────────────────────────────────────────────────────────────────────
// Core logic (exported for testing)
// ──────────────────────────────────────────────────────────────────────────────

/** Build the GDELT keyword query from a topic + optional categories. */
export function buildGdeltQuery(topic: string, categories?: EventCategory[]): string {
  const topicWords = topic
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ');

  const themeFilter = categories ? buildGdeltThemeFilter(categories) : '';
  return themeFilter ? `${topicWords} (${themeFilter})` : topicWords;
}

/** Build a Bluesky search query for OSINT-heavy results. */
export function buildBskyQuery(topic: string, categories?: EventCategory[]): string {
  const categoryHints = categories
    ?.flatMap((c) => {
      const m = getMappingForCategory(c);
      return m ? [m.displayName.split(' ')[0].toLowerCase()] : [];
    })
    .slice(0, 3)
    .join(' ') ?? '';

  const combined = categoryHints ? `${topic} ${categoryHints}` : topic;
  return combined.trim();
}

/** Classify a single article/post text into event categories. */
export function classifyText(text: string, explicitCategories?: EventCategory[]): EventCategory[] {
  if (explicitCategories && explicitCategories.length > 0) {
    // Narrow down to only the categories that have keyword matches
    const detected = detectCategories(text);
    const intersect = explicitCategories.filter((c) => detected.includes(c));
    return intersect.length > 0 ? intersect : explicitCategories;
  }
  const detected = detectCategories(text);
  return detected.length > 0 ? detected : ['general-conflict'];
}

/** Determine overall confidence based on event count and source diversity. */
export function calculateConfidence(
  eventCount: number,
  sourceCount: number
): 'high' | 'medium' | 'low' {
  if (eventCount >= 10 && sourceCount >= 2) return 'high';
  if (eventCount >= 5 || sourceCount >= 2) return 'medium';
  return 'low';
}

/** Attach watchlist flag to asset implications. */
export function flagWatchlistAssets(
  implications: AssetCorrelation[],
  watchlist: string[]
): AssetImplication[] {
  const wlSet = new Set(watchlist.map((t) => t.toUpperCase()));
  return implications.map((a) => ({
    ...a,
    isWatchlistTicker: wlSet.has(a.ticker.toUpperCase()),
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool implementation
// ──────────────────────────────────────────────────────────────────────────────

async function runGeopoliticsSearch(input: GeopoliticsInput): Promise<string> {
  const { topic, categories: explicitCats, timeWindow, watchlistTickers = [], limit } = input;

  const events: GeopoliticsEvent[] = [];
  const sourceSummaries: SourceSummary[] = [];

  // Auto-detect categories from topic if not provided
  const autoCategories = detectCategories(topic);
  const effectiveCategories: EventCategory[] | undefined =
    explicitCats && explicitCats.length > 0 ? explicitCats : autoCategories.length > 0 ? autoCategories : undefined;

  // ── 1. GDELT ──────────────────────────────────────────────────────────────
  try {
    const gdeltQuery = buildGdeltQuery(topic, effectiveCategories);
    const articles = await fetchGdeltArticles(gdeltQuery, {
      timespan: timeWindow as '1d' | '3d' | '7d',
      maxRecords: limit,
    });

    const deduped = deduplicateArticles(articles);
    const gdeltDomains = new Map<string, number>();

    for (const article of deduped) {
      const textForClassification = `${article.title} ${article.url}`;
      const cats = classifyText(textForClassification, effectiveCategories);

      events.push({
        summary: article.title,
        category: cats[0] ?? 'general-conflict',
        source: 'gdelt',
        url: article.url,
        publishedAt: parseGdeltDate(article.seendate).toISOString(),
        domain: article.domain,
        tone: article.tone,
      });

      gdeltDomains.set(article.domain, (gdeltDomains.get(article.domain) ?? 0) + 1);
    }

    if (deduped.length > 0) {
      const topDomains = [...gdeltDomains.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([d]) => d);

      sourceSummaries.push({
        name: 'GDELT News Index',
        articleCount: deduped.length,
        topDomains,
      });
    }
  } catch (_err) {
    // GDELT failure is non-fatal — continue with other sources
  }

  // ── 2. Bluesky ──────────────────────────────────────────────────────────
  try {
    const bskyQuery = buildBskyQuery(topic, effectiveCategories);
    const posts = await searchBskyPosts(bskyQuery, {
      limit: Math.min(limit, 25),
      sort: 'latest',
    });

    const deduped = deduplicatePosts(posts);

    for (const post of deduped) {
      const cats = classifyText(post.text, effectiveCategories);
      events.push({
        summary: post.text.slice(0, 200),
        category: cats[0] ?? 'general-conflict',
        source: 'bluesky',
        url: bskyUriToWebUrl(post.uri),
        publishedAt: post.createdAt,
        engagement: post.likeCount + post.repostCount,
      });
    }

    if (deduped.length > 0) {
      const handles = [...new Set(posts.map((p) => p.authorHandle))].slice(0, 5);
      sourceSummaries.push({
        name: 'Bluesky',
        articleCount: deduped.length,
        topDomains: handles,
      });
    }
  } catch (_err) {
    // Bluesky failure is non-fatal
  }

  // ── Classify + deduplicate events ─────────────────────────────────────────
  const allCategories: EventCategory[] = effectiveCategories ?? [
    ...new Set(events.map((e) => e.category)),
  ];

  // ── Asset implications ────────────────────────────────────────────────────
  const rawImplications = getAssetImplications(allCategories);
  const assetImplications = flagWatchlistAssets(rawImplications, watchlistTickers);
  const watchlistHits = assetImplications
    .filter((a) => a.isWatchlistTicker)
    .map((a) => a.ticker);

  // ── Confidence ───────────────────────────────────────────────────────────
  const confidence = calculateConfidence(events.length, sourceSummaries.length);

  const result: GeopoliticsResult = {
    topic,
    timeWindow,
    detectedCategories: allCategories,
    events: events.slice(0, 40),
    assetImplications,
    watchlistHits,
    confidence,
    sources: sourceSummaries,
    fetchedAt: new Date().toISOString(),
  };

  return formatResult(result);
}

function formatResult(r: GeopoliticsResult): string {
  const lines: string[] = [
    `## Geopolitics OSINT: ${r.topic}`,
    `**Time window**: ${r.timeWindow} | **Confidence**: ${r.confidence} | **Fetched**: ${new Date(r.fetchedAt).toUTCString()}`,
    '',
  ];

  if (r.detectedCategories.length > 0) {
    lines.push(`**Detected event categories**: ${r.detectedCategories.join(', ')}`);
    lines.push('');
  }

  // Events summary
  if (r.events.length === 0) {
    lines.push('*No events found for this topic in the selected time window.*');
  } else {
    lines.push(`### Events (${r.events.length} found)`);
    const top = r.events
      .sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))
      .slice(0, 10);
    for (const ev of top) {
      const ts = new Date(ev.publishedAt).toUTCString();
      lines.push(`- **[${ev.category}]** ${ev.summary} — *${ev.source}* · ${ts}`);
      lines.push(`  ${ev.url}`);
    }
    lines.push('');
  }

  // Asset implications
  if (r.assetImplications.length > 0) {
    lines.push('### Asset Implications');
    const watched = r.assetImplications.filter((a) => a.isWatchlistTicker);
    const rest = r.assetImplications.filter((a) => !a.isWatchlistTicker);

    if (watched.length > 0) {
      lines.push('**⚡ Watchlist hits:**');
      for (const a of watched) {
        lines.push(`  - \`${a.ticker}\` ${a.name} → **${a.direction}** (confidence: ${Math.round(a.confidence * 100)}%): ${a.rationale}`);
      }
      lines.push('');
    }

    if (rest.length > 0) {
      lines.push('**Other implications:**');
      for (const a of rest.slice(0, 10)) {
        lines.push(`  - \`${a.ticker}\` ${a.name} → ${a.direction} (${Math.round(a.confidence * 100)}%): ${a.rationale}`);
      }
      lines.push('');
    }
  }

  // Sources
  if (r.sources.length > 0) {
    lines.push('### Sources');
    for (const s of r.sources) {
      lines.push(`- **${s.name}**: ${s.articleCount} articles (${s.topDomains.slice(0, 3).join(', ')})`);
    }
    lines.push('');
  }

  if (r.watchlistHits.length > 0) {
    lines.push(`> 💼 **Watchlist alert**: ${r.watchlistHits.join(', ')} appear in asset implications for this topic.`);
  }

  return lines.join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool export
// ──────────────────────────────────────────────────────────────────────────────

export const GEOPOLITICS_SEARCH_DESCRIPTION = `Search geopolitical OSINT sources (GDELT news index, Bluesky) for events that may affect financial assets.
Use this tool when the user asks about:
- Geopolitical risk affecting a sector or ticker
- Conflict, sanctions, trade war, cyberattack news
- Macro risk from elections, coups, or regime change
- How world events correlate to energy, defense, semiconductor, or commodity prices

The tool auto-detects event categories from the topic and maps events to asset implications with direction (risk-up / risk-down / volatility).
No API key required (GDELT and Bluesky are free/open).`;

export const geopoliticsSearchTool = new DynamicStructuredTool({
  name: 'geopolitics_search',
  description: GEOPOLITICS_SEARCH_DESCRIPTION,
  schema: INPUT_SCHEMA,
  func: async (input) => {
    try {
      return await runGeopoliticsSearch(input);
    } catch (err) {
      return `Error running geopolitics search: ${(err as Error).message}`;
    }
  },
});
