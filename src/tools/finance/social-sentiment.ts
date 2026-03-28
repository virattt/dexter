/**
 * Social Sentiment Tool
 *
 * Aggregates social media sentiment for stocks, crypto, and market topics from:
 *   1. Reddit — r/wallstreetbets, r/investing, r/stocks (free, no key required)
 *   2. X/Twitter — official API v2 (requires X_BEARER_TOKEN env var)
 *   3. Crypto Fear & Greed Index — alternative.me (free, for crypto/BTC queries)
 *
 * Returns a structured sentiment report: bullish/bearish/neutral percentages,
 * a -100 to +100 sentiment score, and representative posts/tweets.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { xApiBreaker } from '../../utils/circuit-breaker.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REDDIT_UA = 'Dexter/1.0 (financial research assistant)';
const REDDIT_BASE = 'https://www.reddit.com';
const X_API_BASE = 'https://api.x.com/2';
const FEAR_GREED_URL = 'https://api.alternative.me/fng/?limit=1';

const CRYPTO_TICKERS = new Set(['BTC', 'ETH', 'SOL', 'ADA', 'DOGE', 'XRP', 'BNB', 'MATIC', 'AVAX', 'DOT', 'LTC', 'LINK', 'UNI', 'ATOM', 'NEAR', 'OP', 'ARB', 'PEPE', 'SHIB']);
const CRYPTO_SUBREDDITS = ['cryptocurrency', 'Bitcoin', 'ethereum', 'CryptoMarkets'];
const STOCK_SUBREDDITS = ['wallstreetbets', 'investing', 'stocks', 'options'];
const MARKET_SUBREDDITS = ['wallstreetbets', 'investing', 'economics', 'StockMarket'];

// Sentiment keywords (lower-cased match)
const BULLISH_WORDS = new Set([
  'buy', 'long', 'calls', 'call', 'moon', 'ath', 'breakout', 'squeeze',
  'bull', 'bullish', 'yolo', 'rocket', 'pump', 'green', 'gains', 'gain',
  'profit', 'hold', 'hodl', 'undervalued', 'dip', 'loading', 'accumulate',
  'strong', 'rally', 'soar', 'surge', 'beat', 'smash', 'crush', 'outperform',
  'upgrade', 'higher', 'rise', 'bounce', 'recover', 'run',
]);
const BEARISH_WORDS = new Set([
  'sell', 'short', 'puts', 'put', 'crash', 'dump', 'panic', 'bear', 'bearish',
  'red', 'loss', 'rip', 'bankrupt', 'dead', 'overvalued', 'avoid', 'exit',
  'drop', 'fall', 'decline', 'plunge', 'miss', 'disappoint', 'weak',
  'downgrade', 'lower', 'sink', 'collapse', 'fear', 'warning', 'risk',
]);
const BULLISH_EMOJIS = new Set(['🚀', '📈', '💎', '🤑', '🐂', '🟢', '💪', '🔥']);
const BEARISH_EMOJIS = new Set(['📉', '🩸', '💀', '⚰️', '🐻', '🔴', '😱', '💸', '🗑️']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SentimentPost {
  source: 'reddit' | 'x';
  id: string;
  text: string;
  author: string;
  score: number;          // upvotes or likes
  ratio?: number;         // upvote_ratio (reddit) or impressions (x, normalized)
  url: string;
  created_at: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number; // -1 to +1
}

interface SentimentStats {
  total: number;
  bullish: number;
  bearish: number;
  neutral: number;
  bullishPct: number;
  bearishPct: number;
  neutralPct: number;
  avgScore: number;       // weighted average sentiment -100 to +100
}

// ---------------------------------------------------------------------------
// Pure helpers (no I/O — fully unit-testable)
// Exported for direct unit testing.
// ---------------------------------------------------------------------------

export function scoreSentiment(text: string): { sentiment: 'bullish' | 'bearish' | 'neutral'; score: number } {
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/);

  let bull = 0;
  let bear = 0;

  for (const w of words) {
    if (BULLISH_WORDS.has(w)) bull++;
    if (BEARISH_WORDS.has(w)) bear++;
  }
  // Emoji scanning (characters, not words)
  for (const ch of text) {
    if (BULLISH_EMOJIS.has(ch)) bull++;
    if (BEARISH_EMOJIS.has(ch)) bear++;
  }

  const total = bull + bear;
  if (total === 0) return { sentiment: 'neutral', score: 0 };

  const score = (bull - bear) / total; // -1 to +1
  const sentiment = score > 0.1 ? 'bullish' : score < -0.1 ? 'bearish' : 'neutral';
  return { sentiment, score };
}

export function aggregateStats(posts: SentimentPost[]): SentimentStats {
  const total = posts.length;
  if (total === 0) return { total: 0, bullish: 0, bearish: 0, neutral: 0, bullishPct: 0, bearishPct: 0, neutralPct: 0, avgScore: 0 };

  const bullish = posts.filter((p) => p.sentiment === 'bullish').length;
  const bearish = posts.filter((p) => p.sentiment === 'bearish').length;
  const neutral = total - bullish - bearish;

  // Weight by engagement score (upvotes/likes)
  const maxScore = Math.max(1, ...posts.map((p) => p.score));
  let weightedSum = 0;
  let weightSum = 0;
  for (const p of posts) {
    const w = 1 + (p.score / maxScore);
    weightedSum += p.sentimentScore * w;
    weightSum += w;
  }
  const avgScore = Math.round((weightedSum / weightSum) * 100);

  return {
    total,
    bullish, bearish, neutral,
    bullishPct: Math.round((bullish / total) * 100),
    bearishPct: Math.round((bearish / total) * 100),
    // Compute neutralPct as remainder to guarantee bullishPct + bearishPct + neutralPct = 100.
    neutralPct: 100 - Math.round((bullish / total) * 100) - Math.round((bearish / total) * 100),
    avgScore,
  };
}

// ---------------------------------------------------------------------------
// Reddit
// ---------------------------------------------------------------------------

async function fetchReddit(query: string, subreddits: string[], limit = 25): Promise<SentimentPost[]> {
  const posts: SentimentPost[] = [];

  await Promise.allSettled(
    subreddits.map(async (sub) => {
      try {
        const url =
          `${REDDIT_BASE}/r/${sub}/search.json` +
          `?q=${encodeURIComponent(query)}&sort=new&limit=${limit}&t=week&restrict_sr=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': REDDIT_UA },
        });
        if (!res.ok) return;
        const data = await res.json() as { data?: { children?: { data: Record<string, unknown> }[] } };
        const children = data?.data?.children ?? [];
        for (const c of children) {
          const p = c.data;
          const text = `${p.title ?? ''} ${p.selftext ?? ''}`.trim();
          const { sentiment, score: sentimentScore } = scoreSentiment(text);
          posts.push({
            source: 'reddit',
            id: p.id as string,
            text: (text.slice(0, 280) + (text.length > 280 ? '…' : '')) as string,
            author: `u/${p.author as string} (r/${sub})`,
            score: (p.ups as number) ?? 0,
            ratio: (p.upvote_ratio as number) ?? 0.5,
            url: `https://reddit.com${p.permalink as string}`,
            created_at: new Date((p.created_utc as number) * 1000).toISOString(),
            sentiment,
            sentimentScore,
          });
        }
      } catch {
        // Silently skip failed subreddits
      }
    }),
  );

  // Deduplicate by post id
  const seen = new Set<string>();
  return posts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

// ---------------------------------------------------------------------------
// X / Twitter
// ---------------------------------------------------------------------------

async function fetchXTweets(query: string, limit: number): Promise<SentimentPost[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return [];

  if (xApiBreaker.isOpen()) return [];

  const TWEET_FIELDS =
    'tweet.fields=created_at,public_metrics,author_id' +
    '&expansions=author_id' +
    '&user.fields=username';

  try {
    const q = `${query} lang:en -is:retweet`;
    const url =
      `${X_API_BASE}/tweets/search/recent` +
      `?query=${encodeURIComponent(q)}&max_results=${Math.min(limit, 100)}&${TWEET_FIELDS}` +
      `&sort_order=relevancy`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      xApiBreaker.onFailure();
      return [];
    }
    xApiBreaker.onSuccess();

    const raw = await res.json() as {
      data?: { id: string; text: string; author_id: string; created_at: string; public_metrics: Record<string, number> }[];
      includes?: { users?: { id: string; username: string }[] };
    };

    const users: Record<string, string> = {};
    for (const u of raw.includes?.users ?? []) {
      users[u.id] = u.username;
    }

    return (raw.data ?? []).map((t) => {
      const { sentiment, score: sentimentScore } = scoreSentiment(t.text);
      const username = users[t.author_id] ?? '?';
      return {
        source: 'x' as const,
        id: t.id,
        text: t.text.slice(0, 280),
        author: `@${username}`,
        score: t.public_metrics?.like_count ?? 0,
        url: `https://x.com/${username}/status/${t.id}`,
        created_at: t.created_at,
        sentiment,
        sentimentScore,
      };
    });
  } catch {
    xApiBreaker.onFailure();
    return [];
  }
}

// ---------------------------------------------------------------------------
// Crypto Fear & Greed
// ---------------------------------------------------------------------------

async function fetchFearGreed(): Promise<{ value: number; classification: string } | null> {
  try {
    const res = await fetch(FEAR_GREED_URL);
    if (!res.ok) return null;
    const data = await res.json() as { data?: { value: string; value_classification: string }[] };
    const d = data?.data?.[0];
    if (!d) return null;
    return { value: parseInt(d.value), classification: d.value_classification };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatBar(pct: number, emoji: string): string {
  const filled = Math.round(pct / 5); // 20 segments = 100%
  return emoji + ' ' + '█'.repeat(filled) + '░'.repeat(20 - filled) + ` ${pct}%`;
}

export function sentimentEmoji(score: number): string {
  if (score >= 60) return '🐂 Very Bullish';
  if (score >= 20) return '📈 Bullish';
  if (score >= -20) return '😐 Neutral / Mixed';
  if (score >= -60) return '📉 Bearish';
  return '🐻 Very Bearish';
}

function formatSentimentReport(
  query: string,
  ticker: string,
  redditPosts: SentimentPost[],
  xTweets: SentimentPost[],
  fearGreed: { value: number; classification: string } | null,
): string {
  const all = [...redditPosts, ...xTweets];
  const stats = aggregateStats(all);
  const redditStats = aggregateStats(redditPosts);
  const xStats = aggregateStats(xTweets);

  if (stats.total === 0) {
    return `No social media posts found for "${query}". Try a broader search term or check if the ticker is correct.`;
  }

  const lines: string[] = [
    `📊 **Social Sentiment: ${ticker || query}**`,
    `_(${stats.total} posts/tweets from the past 7 days)_`,
    '',
    `## Overall: ${sentimentEmoji(stats.avgScore)} (score ${stats.avgScore > 0 ? '+' : ''}${stats.avgScore}/100)`,
    '',
    formatBar(stats.bullishPct, '🐂'),
    formatBar(stats.bearishPct, '🐻'),
    formatBar(stats.neutralPct, '😐'),
    '',
  ];

  // Source breakdown
  if (redditStats.total > 0 && xStats.total > 0) {
    lines.push('| Source | Posts | 🐂 Bullish | 🐻 Bearish | Score |');
    lines.push('|---|---|---|---|---|');
    lines.push(`| Reddit | ${redditStats.total} | ${redditStats.bullishPct}% | ${redditStats.bearishPct}% | ${redditStats.avgScore > 0 ? '+' : ''}${redditStats.avgScore} |`);
    lines.push(`| X/Twitter | ${xStats.total} | ${xStats.bullishPct}% | ${xStats.bearishPct}% | ${xStats.avgScore > 0 ? '+' : ''}${xStats.avgScore} |`);
    lines.push('');
  }

  // Crypto Fear & Greed
  if (fearGreed) {
    const fgBar = `${'█'.repeat(Math.round(fearGreed.value / 10))}${'░'.repeat(10 - Math.round(fearGreed.value / 10))}`;
    lines.push(`## Crypto Fear & Greed Index`);
    lines.push(`${fgBar} **${fearGreed.value}/100** — ${fearGreed.classification}`);
    lines.push('');
  }

  // Top bullish posts
  const topBullish = all
    .filter((p) => p.sentiment === 'bullish')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (topBullish.length > 0) {
    lines.push('## 🐂 Top Bullish Posts');
    for (const p of topBullish) {
      lines.push(`> **${p.author}** · ${p.score} ${p.source === 'reddit' ? '↑' : '♥'}  `);
      lines.push(`> ${p.text}`);
      lines.push(`> [source](${p.url})`);
      lines.push('');
    }
  }

  // Top bearish posts
  const topBearish = all
    .filter((p) => p.sentiment === 'bearish')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (topBearish.length > 0) {
    lines.push('## 🐻 Top Bearish Posts');
    for (const p of topBearish) {
      lines.push(`> **${p.author}** · ${p.score} ${p.source === 'reddit' ? '↑' : '♥'}  `);
      lines.push(`> ${p.text}`);
      lines.push(`> [source](${p.url})`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`_Data sources: ${[
    redditPosts.length > 0 ? 'Reddit (r/wallstreetbets, r/investing, r/stocks)' : null,
    xTweets.length > 0 ? 'X/Twitter API v2' : null,
    fearGreed ? 'alternative.me Fear & Greed' : null,
  ].filter(Boolean).join(', ')}_`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

const schema = z.object({
  ticker: z
    .string()
    .optional()
    .describe(
      'Stock or crypto ticker symbol (e.g. "AAPL", "BTC", "ETH", "SPY"). ' +
      'Takes precedence over query when provided.',
    ),
  query: z
    .string()
    .optional()
    .describe(
      'Free-text search topic when no ticker applies, e.g. "Federal Reserve rate cut", ' +
      '"gold", "US recession". Used as-is for Reddit/X search.',
    ),
  include_fear_greed: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, also fetch the Crypto Fear & Greed Index (only meaningful for crypto queries).',
    ),
  limit: z
    .number()
    .int()
    .min(5)
    .max(100)
    .optional()
    .default(25)
    .describe('Max posts to fetch per source (default: 25). Higher = more data but slower.'),
});

export const socialSentimentTool = new DynamicStructuredTool({
  name: 'social_sentiment',
  description:
    'Analyze social media sentiment for a stock, crypto, or market topic. ' +
    'Aggregates Reddit and X/Twitter posts with bullish/bearish scoring.',
  schema,
  func: async (input) => {
    try {
      const ticker = (input.ticker ?? '').trim().toUpperCase();
      const query = ticker
        ? (ticker.startsWith('$') ? ticker : `$${ticker} OR #${ticker}`)
        : (input.query ?? '').trim();

      if (!query && !ticker) {
        throw new Error('Provide either a ticker symbol or a search query');
      }

      const searchText = ticker || input.query || '';
      const isCrypto = CRYPTO_TICKERS.has(ticker);
      const subreddits = isCrypto
        ? CRYPTO_SUBREDDITS
        : ticker
          ? STOCK_SUBREDDITS
          : MARKET_SUBREDDITS;

      const limit = input.limit ?? 25;

      // Fetch all sources in parallel
      const [redditPosts, xTweets, fearGreed] = await Promise.all([
        fetchReddit(searchText, subreddits, limit),
        fetchXTweets(query, limit),
        (input.include_fear_greed || isCrypto) ? fetchFearGreed() : Promise.resolve(null),
      ]);

      const report = formatSentimentReport(searchText, ticker || input.query || '', redditPosts, xTweets, fearGreed);
      const urls = [...redditPosts, ...xTweets].map((p) => p.url);
      return formatToolResult({ result: report }, urls);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[social_sentiment] ${message}`);
    }
  },
});

export const SOCIAL_SENTIMENT_DESCRIPTION = `
Analyze social media sentiment for any stock, crypto, ETF, or market topic.
Aggregates Reddit (r/wallstreetbets, r/investing, r/stocks) and X/Twitter posts
with keyword-based bullish/bearish scoring, weighted by engagement.

## When to Use

- "What is sentiment on $AAPL?" / "What are people saying about AMD?"
- "Is crypto market bullish or bearish right now?"
- "What does WSB think about $TSLA?"
- "Social sentiment on the Fed rate decision"
- Any question about public/retail market mood, social chatter, or crowd positioning

## Output

Returns a -100 to +100 sentiment score, bullish/bearish/neutral percentages, source breakdown,
top bullish and bearish posts with engagement metrics, and (for crypto) the Fear & Greed Index.

## Data Sources

- **Reddit** — always available, no key required. Covers r/wallstreetbets, r/investing,
  r/stocks (stocks/ETFs) or r/cryptocurrency, r/Bitcoin, r/ethereum (crypto).
- **X/Twitter** — only available when X_BEARER_TOKEN env var is set.
  Uses official X API v2 (last 7 days, read-only).
- **Fear & Greed Index** — always available for crypto queries (alternative.me, free).

## Parameters

- \`ticker\`: Stock/crypto ticker (e.g. "AAPL", "BTC"). Auto-formats search query.
- \`query\`: Free-text for non-ticker topics (e.g. "gold", "Fed rate cut").
- \`include_fear_greed\`: Include Fear & Greed Index (auto-enabled for crypto tickers).
- \`limit\`: Posts per source, 5–100 (default 25).
`.trim();
