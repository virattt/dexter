import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

const X_API_BASE = 'https://api.x.com/2';
const RATE_DELAY_MS = 350; // Delay between pagination requests to reduce rate-limit risk

const TWEET_FIELDS =
  'tweet.fields=created_at,public_metrics,author_id,conversation_id,entities' +
  '&expansions=author_id' +
  '&user.fields=username,name,public_metrics';

interface XTweet {
  id: string;
  text: string;
  author_id: string;
  username: string;
  name: string;
  created_at: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
  urls: string[];
  tweet_url: string;
}

interface RawXResponse {
  data?: Record<string, unknown>[];
  includes?: { users?: Record<string, unknown>[] };
  meta?: { next_token?: string };
  errors?: unknown[];
}

function getBearerToken(): string {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error('X_BEARER_TOKEN is not set');
  return token;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function xApiGet(url: string): Promise<RawXResponse> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getBearerToken()}` },
  });

  if (res.status === 429) {
    const reset = res.headers.get('x-rate-limit-reset');
    const waitSec = reset
      ? Math.max(parseInt(reset) - Math.floor(Date.now() / 1000), 1)
      : 60;
    throw new Error(`X API rate limited. Resets in ${waitSec}s`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json() as Promise<RawXResponse>;
}

function parseTweets(raw: RawXResponse): XTweet[] {
  if (!raw.data) return [];

  const users: Record<string, Record<string, unknown>> = {};
  for (const u of raw.includes?.users ?? []) {
    users[u.id as string] = u;
  }

  return raw.data.map((t) => {
    const u = users[t.author_id as string] ?? {};
    const m = (t.public_metrics as Record<string, number>) ?? {};
    const entities = t.entities as Record<string, unknown> | undefined;
    const urlEntities = (entities?.urls as Record<string, unknown>[] | undefined) ?? [];

    return {
      id: t.id as string,
      text: t.text as string,
      author_id: t.author_id as string,
      username: (u.username as string) ?? '?',
      name: (u.name as string) ?? '?',
      created_at: t.created_at as string,
      metrics: {
        likes: m.like_count ?? 0,
        retweets: m.retweet_count ?? 0,
        replies: m.reply_count ?? 0,
        impressions: m.impression_count ?? 0,
      },
      urls: urlEntities
        .map((e) => e.expanded_url as string)
        .filter(Boolean),
      tweet_url: `https://x.com/${(u.username as string) ?? '?'}/status/${t.id as string}`,
    };
  });
}

/** Parse shorthand time strings like "1h", "3d" into ISO 8601 start_time. */
function parseSince(since: string): string | null {
  const match = since.match(/^(\d+)(m|h|d)$/);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2];
    const ms =
      unit === 'm' ? num * 60_000 :
      unit === 'h' ? num * 3_600_000 :
      num * 86_400_000;
    return new Date(Date.now() - ms).toISOString();
  }
  if (since.includes('T') || /^\d{4}-/.test(since)) {
    try { return new Date(since).toISOString(); } catch { return null; }
  }
  return null;
}

async function searchTweets(
  query: string,
  opts: {
    pages?: number;
    maxResults?: number;
    sortOrder?: 'relevancy' | 'recency';
    since?: string;
  } = {},
): Promise<XTweet[]> {
  const pages = Math.min(opts.pages ?? 1, 5);
  const maxResults = Math.max(Math.min(opts.maxResults ?? 100, 100), 10);
  const sort = opts.sortOrder ?? 'relevancy';
  const encoded = encodeURIComponent(query);

  let timeFilter = '';
  if (opts.since) {
    const startTime = parseSince(opts.since);
    if (startTime) timeFilter = `&start_time=${startTime}`;
  }

  const allTweets: XTweet[] = [];
  let nextToken: string | undefined;

  for (let page = 0; page < pages; page++) {
    const pagination = nextToken ? `&pagination_token=${nextToken}` : '';
    const url =
      `${X_API_BASE}/tweets/search/recent?query=${encoded}` +
      `&max_results=${maxResults}&${TWEET_FIELDS}` +
      `&sort_order=${sort}${timeFilter}${pagination}`;

    const raw = await xApiGet(url);
    allTweets.push(...parseTweets(raw));
    nextToken = raw.meta?.next_token;
    if (!nextToken) break;
    if (page < pages - 1) await sleep(RATE_DELAY_MS);
  }

  // Deduplicate
  const seen = new Set<string>();
  return allTweets.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

async function getProfile(
  username: string,
  count: number,
): Promise<{ user: Record<string, unknown>; tweets: XTweet[] }> {
  const userUrl =
    `${X_API_BASE}/users/by/username/${username}` +
    `?user.fields=public_metrics,description,created_at`;
  const userData = await xApiGet(userUrl as unknown as string);
  const user = (userData as unknown as { data: Record<string, unknown> }).data;
  if (!user) throw new Error(`User @${username} not found`);

  await sleep(RATE_DELAY_MS);

  const query = `from:${username} -is:retweet -is:reply`;
  const tweets = await searchTweets(query, {
    maxResults: Math.min(count, 100),
    sortOrder: 'recency',
  });

  return { user, tweets };
}

async function getThread(conversationId: string): Promise<XTweet[]> {
  const query = `conversation_id:${conversationId}`;
  return searchTweets(query, { pages: 2, sortOrder: 'recency' });
}

// ─── Tool definition ─────────────────────────────────────────────────────────

const schema = z.object({
  command: z
    .enum(['search', 'profile', 'thread'])
    .describe(
      'search: search recent tweets; profile: get recent tweets from a user; thread: fetch a conversation thread',
    ),
  query: z
    .string()
    .optional()
    .describe(
      'For search: the search query (supports X operators like from:, -is:retweet, OR, etc.). ' +
      'For thread: the root tweet ID.',
    ),
  username: z
    .string()
    .optional()
    .describe('For profile: the X/Twitter username (without @)'),
  sort: z
    .enum(['likes', 'impressions', 'retweets', 'recent'])
    .optional()
    .default('likes')
    .describe('Sort order for results (default: likes)'),
  since: z
    .string()
    .optional()
    .describe('Time filter: "1h", "3h", "12h", "1d", "7d" or ISO 8601 timestamp'),
  min_likes: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Filter results to tweets with at least this many likes'),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(15)
    .describe('Maximum number of results to return (default: 15)'),
  pages: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .default(1)
    .describe('Number of pages to fetch for search (1 page ≈ 100 tweets, default: 1)'),
});

export const xSearchTool = new DynamicStructuredTool({
  name: 'x_search',
  description:
    'Search X/Twitter for real-time public sentiment, news, and expert opinions. ' +
    'Uses the official X API v2 (read-only).',
  schema,
  func: async (input) => {
    try {
      const limit = input.limit ?? 15;

      if (input.command === 'search') {
        if (!input.query) throw new Error('query is required for search command');

        let query = input.query;
        // Auto-suppress retweets unless caller explicitly included the operator
        if (!query.includes('is:retweet')) query += ' -is:retweet';

        const sortOrder =
          input.sort === 'recent' ? 'recency' : 'relevancy';

        const maxResults = Math.min(Math.max(limit, 10), 100);
        let tweets = await searchTweets(query, {
          pages: input.pages ?? 1,
          maxResults,
          sortOrder,
          since: input.since,
        });

        // Post-hoc filters
        if (input.min_likes && input.min_likes > 0) {
          tweets = tweets.filter((t) => t.metrics.likes >= (input.min_likes ?? 0));
        }

        // Sort
        if (input.sort && input.sort !== 'recent') {
          const metric = input.sort as 'likes' | 'impressions' | 'retweets';
          tweets.sort((a, b) => b.metrics[metric] - a.metrics[metric]);
        }

        const results = tweets.slice(0, limit);
        const urls = results.map((t) => t.tweet_url);
        return formatToolResult({ tweets: results, total_fetched: tweets.length }, urls);
      }

      if (input.command === 'profile') {
        if (!input.username) throw new Error('username is required for profile command');
        const { user, tweets } = await getProfile(input.username, limit);
        const urls = tweets.map((t) => t.tweet_url);
        return formatToolResult({ user, tweets: tweets.slice(0, limit) }, urls);
      }

      if (input.command === 'thread') {
        if (!input.query) throw new Error('tweet ID (query field) is required for thread command');
        const tweets = await getThread(input.query);
        const urls = tweets.map((t) => t.tweet_url);
        return formatToolResult({ tweets: tweets.slice(0, limit) }, urls);
      }

      throw new Error(`Unknown command: ${input.command}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[x_search] ${message}`);
    }
  },
});

export const X_SEARCH_DESCRIPTION = `
Search X/Twitter for real-time public sentiment, market opinions, breaking news, and expert takes.
Uses the official X API v2 (read-only, last 7 days).

## When to Use

- Gauging public/market sentiment on a stock, sector, or macro event from X/Twitter specifically
- Finding what analysts, investors, or industry experts are saying on X/Twitter specifically
- Researching breaking news or recent developments on X/Twitter specifically
- Checking what a specific account (@CEO, analyst, etc.) has posted recently on X/Twitter specifically
- Following a conversation thread for context on X/Twitter specifically
- Queries like "what are people saying about X", "X sentiment", "check twitter for Y" on X/Twitter specifically

## When NOT to Use

- Structured financial data (use get_financials instead)
- Historical data beyond 7 days (X recent search is limited to last 7 days)
- General web research (use web_search instead)

## Commands

- **search**: Search recent tweets. Supports X operators: \`from:username\`, \`-is:reply\`, \`OR\`, \`"exact phrase"\`, \`$TICKER\`, \`#hashtag\`
- **profile**: Get recent tweets from a specific user (excludes retweets and replies)
- **thread**: Fetch a full conversation thread by root tweet ID

## Usage Notes

- Retweets are automatically excluded from search results unless you explicitly include \`is:retweet\`
- Use \`sort: "likes"\` to surface highest-signal tweets
- Use \`min_likes\` to filter noise (e.g. 10+ likes for quality signal)
- Use \`since\` for time-bounded research: "1h", "3h", "12h", "1d", "7d"
- Each page fetches up to 100 tweets (~$0.50 API cost); use \`pages: 1\` (default) for most queries
- Requires \`X_BEARER_TOKEN\` environment variable (get one at developer.x.com)
`.trim();
