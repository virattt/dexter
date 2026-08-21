import type { XTweet } from './x-search-provider.js';

const XQUIK_API_BASE = 'https://xquik.com/api/v1';

interface XquikAuthor extends Record<string, unknown> {
  id: string;
  username: string;
  name: string;
}

interface XquikTweet {
  id: string;
  text: string;
  createdAt?: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
  entities?: Record<string, unknown>;
  url?: string;
  author?: XquikAuthor;
}

interface XquikTweetPage {
  tweets: XquikTweet[];
  has_next_page: boolean;
  next_cursor: string;
}

function getApiKey(): string {
  const key = process.env.XQUIK_API_KEY;
  if (!key) throw new Error('XQUIK_API_KEY is not set');
  return key;
}

async function xquikGet<T>(
  path: string,
  params?: URLSearchParams,
): Promise<T> {
  const url = new URL(`${XQUIK_API_BASE}${path}`);
  params?.forEach((value, key) => url.searchParams.append(key, value));

  const response = await fetch(url, {
    headers: { 'x-api-key': getApiKey() },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Xquik API ${response.status}: ${body.slice(0, 300)}`);
  }

  return response.json() as Promise<T>;
}

function extractUrls(tweet: XquikTweet): string[] {
  const entities = tweet.entities?.urls;
  if (!Array.isArray(entities)) return [];

  return entities.flatMap((entity) => {
    if (!entity || typeof entity !== 'object') return [];
    const values = entity as Record<string, unknown>;
    const url = values.expanded_url ?? values.expandedUrl ?? values.url;
    return typeof url === 'string' ? [url] : [];
  });
}

function mapTweet(tweet: XquikTweet): XTweet {
  const username = tweet.author?.username ?? '?';
  return {
    id: tweet.id,
    text: tweet.text,
    author_id: tweet.author?.id ?? '',
    username,
    name: tweet.author?.name ?? '?',
    created_at: tweet.createdAt ?? '',
    metrics: {
      likes: tweet.likeCount ?? 0,
      retweets: tweet.retweetCount ?? 0,
      replies: tweet.replyCount ?? 0,
      impressions: tweet.viewCount ?? 0,
    },
    urls: extractUrls(tweet),
    tweet_url: tweet.url ?? `https://x.com/${username}/status/${tweet.id}`,
  };
}

function deduplicate(tweets: XTweet[]): XTweet[] {
  const seen = new Set<string>();
  return tweets.filter((tweet) => {
    if (seen.has(tweet.id)) return false;
    seen.add(tweet.id);
    return true;
  });
}

export async function searchXquikTweets(
  query: string,
  opts: {
    pages: number;
    maxResults: number;
    sortOrder: 'relevancy' | 'recency';
    since?: string;
  },
): Promise<XTweet[]> {
  const tweets: XTweet[] = [];
  let cursor: string | undefined;

  for (let pageNumber = 0; pageNumber < opts.pages; pageNumber++) {
    const params = new URLSearchParams({
      q: query,
      queryType: opts.sortOrder === 'recency' ? 'Latest' : 'Top',
      limit: String(opts.maxResults),
    });
    if (opts.since) params.set('sinceTime', opts.since);
    if (cursor) params.set('cursor', cursor);

    const page = await xquikGet<XquikTweetPage>('/x/tweets/search', params);
    tweets.push(...page.tweets.map(mapTweet));
    cursor = page.next_cursor || undefined;
    if (!page.has_next_page || !cursor) break;
  }

  return deduplicate(tweets);
}

export async function getXquikProfile(
  username: string,
  count: number,
): Promise<{ user: Record<string, unknown>; tweets: XTweet[] }> {
  const id = encodeURIComponent(username);
  const params = new URLSearchParams({
    pageSize: String(Math.min(count, 100)),
    includeReplies: 'false',
  });
  const [user, page] = await Promise.all([
    xquikGet<XquikAuthor>(`/x/users/${id}`),
    xquikGet<XquikTweetPage>(`/x/users/${id}/tweets`, params),
  ]);
  return { user, tweets: page.tweets.map(mapTweet) };
}

export async function getXquikThread(tweetId: string): Promise<XTweet[]> {
  const id = encodeURIComponent(tweetId);
  const tweets: XTweet[] = [];
  let cursor: string | undefined;

  for (let pageNumber = 0; pageNumber < 2; pageNumber++) {
    const params = new URLSearchParams({ pageSize: '100' });
    if (cursor) params.set('cursor', cursor);

    const page = await xquikGet<XquikTweetPage>(`/x/tweets/${id}/thread`, params);
    tweets.push(...page.tweets.map(mapTweet));
    cursor = page.next_cursor || undefined;
    if (!page.has_next_page || !cursor) break;
  }

  return deduplicate(tweets);
}
