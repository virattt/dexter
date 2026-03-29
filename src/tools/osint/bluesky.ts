/**
 * Bluesky AT Protocol public API client.
 *
 * Uses the unauthenticated public AppView endpoint — no credentials required.
 * API reference: https://docs.bsky.app/docs/api/app-bsky-feed-search-posts
 */

export interface BskyPost {
  uri: string;
  /** Bluesky handle of the author (e.g. "bellingcat.bsky.social") */
  authorHandle: string;
  authorDisplayName: string;
  text: string;
  /** ISO 8601 timestamp */
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
}

export interface BskySearchOptions {
  limit?: number;
  /** ISO 8601 — only return posts after this time */
  since?: string;
  /** 'latest' | 'top' (default: 'latest') */
  sort?: 'latest' | 'top';
}

const BSKY_BASE = 'https://public.api.bsky.app/xrpc';
const DEFAULT_LIMIT = 25;
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Search Bluesky posts by keyword query.
 */
export async function searchBskyPosts(query: string, options: BskySearchOptions = {}): Promise<BskyPost[]> {
  const { limit = DEFAULT_LIMIT, since, sort = 'latest' } = options;

  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(limit, 100)),
    sort,
  });
  if (since) params.set('since', since);

  const url = `${BSKY_BASE}/app.bsky.feed.searchPosts?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`Bluesky HTTP ${resp.status}: ${resp.statusText}`);
    }
    const data = await resp.json() as { posts?: BskyRawPost[] };
    return (data.posts ?? []).map(normalizePost);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`Bluesky request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch recent posts from a specific Bluesky account.
 * Uses the getAuthorFeed endpoint for targeted monitoring.
 */
export async function getBskyAuthorFeed(handle: string, limit = 10): Promise<BskyPost[]> {
  const params = new URLSearchParams({ actor: handle, limit: String(Math.min(limit, 100)) });
  const url = `${BSKY_BASE}/app.bsky.feed.getAuthorFeed?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`Bluesky feed HTTP ${resp.status}: ${resp.statusText}`);
    }
    const data = await resp.json() as { feed?: Array<{ post: BskyRawPost }> };
    return (data.feed ?? []).map((item) => normalizePost(item.post));
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`Bluesky feed request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal normalization
// ──────────────────────────────────────────────────────────────────────────────

interface BskyRawPost {
  uri?: string;
  author?: { handle?: string; displayName?: string };
  record?: { text?: string; createdAt?: string };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
}

function normalizePost(raw: BskyRawPost): BskyPost {
  return {
    uri: raw.uri ?? '',
    authorHandle: raw.author?.handle ?? '',
    authorDisplayName: raw.author?.displayName ?? '',
    text: raw.record?.text ?? '',
    createdAt: raw.record?.createdAt ?? '',
    likeCount: raw.likeCount ?? 0,
    repostCount: raw.repostCount ?? 0,
    replyCount: raw.replyCount ?? 0,
  };
}

/** Build a Bluesky URI into a web URL for display. */
export function bskyUriToWebUrl(uri: string): string {
  // at://did:plc:.../app.bsky.feed.post/<rkey>
  const match = uri.match(/at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)/);
  if (!match) return uri;
  return `https://bsky.app/profile/${match[1]}/post/${match[2]}`;
}

/** Deduplicate posts by URI. */
export function deduplicatePosts(posts: BskyPost[]): BskyPost[] {
  const seen = new Set<string>();
  return posts.filter((p) => {
    if (seen.has(p.uri)) return false;
    seen.add(p.uri);
    return true;
  });
}
