import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { xApiGet, xSearchTool } from './x-search.js';
import { getXSearchProvider } from './x-search-provider.js';

// Minimal Response stand-in for the fields xApiGet reads.
function makeResponse(opts: {
  status: number;
  resetSec?: number;
  body?: unknown;
}): Response {
  const headers = new Map<string, string>();
  if (opts.resetSec !== undefined) {
    headers.set(
      'x-rate-limit-reset',
      String(Math.floor(Date.now() / 1000) + opts.resetSec),
    );
  }
  return {
    status: opts.status,
    ok: opts.status >= 200 && opts.status < 300,
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: async () => opts.body ?? {},
    text: async () => JSON.stringify(opts.body ?? {}),
  } as unknown as Response;
}

const realFetch = globalThis.fetch;
const realSetTimeout = globalThis.setTimeout;
const realBearerToken = process.env.X_BEARER_TOKEN;
const realXquikApiKey = process.env.XQUIK_API_KEY;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('xApiGet rate-limit handling', () => {
  beforeEach(() => {
    process.env.X_BEARER_TOKEN = 'test-token';
    delete process.env.XQUIK_API_KEY;
    // Resolve sleep() instantly so retries don't add real wall-clock delay.
    // @ts-expect-error - test stub
    globalThis.setTimeout = (fn: () => void) => {
      fn();
      return 0;
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realSetTimeout;
    restoreEnv('X_BEARER_TOKEN', realBearerToken);
    restoreEnv('XQUIK_API_KEY', realXquikApiKey);
  });

  test('waits for the reset window and retries after a 429', async () => {
    const responses = [
      makeResponse({ status: 429, resetSec: 1 }),
      makeResponse({ status: 200, body: { data: [{ id: '1' }] } }),
    ];
    let calls = 0;
    // @ts-expect-error - test stub
    globalThis.fetch = async () => responses[calls++];

    const result = await xApiGet('https://api.x.com/2/test');

    expect(calls).toBe(2); // retried once after the 429
    expect(result.data).toEqual([{ id: '1' }]);
  });

  test('throws after exhausting retries on repeated 429s', async () => {
    let calls = 0;
    // @ts-expect-error - test stub
    globalThis.fetch = async () => {
      calls++;
      return makeResponse({ status: 429, resetSec: 1 });
    };

    await expect(xApiGet('https://api.x.com/2/test')).rejects.toThrow(
      /rate limited/i,
    );
    // initial attempt + 3 retries
    expect(calls).toBe(4);
  });

  test('does not wait when the reset window exceeds the cap', async () => {
    let calls = 0;
    let waited = false;
    // @ts-expect-error - test stub
    globalThis.setTimeout = (fn: () => void) => {
      waited = true;
      fn();
      return 0;
    };
    // @ts-expect-error - test stub
    globalThis.fetch = async () => {
      calls++;
      return makeResponse({ status: 429, resetSec: 3600 }); // 1h, beyond the cap
    };

    await expect(xApiGet('https://api.x.com/2/test')).rejects.toThrow(
      /rate limited/i,
    );
    expect(calls).toBe(1); // threw immediately, no retry
    expect(waited).toBe(false); // never slept
  });
});

describe('x_search with Xquik', () => {
  beforeEach(() => {
    delete process.env.X_BEARER_TOKEN;
    process.env.XQUIK_API_KEY = 'test-xquik-key';
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    restoreEnv('X_BEARER_TOKEN', realBearerToken);
    restoreEnv('XQUIK_API_KEY', realXquikApiKey);
  });

  test('maps and paginates search results', async () => {
    const calls: Array<{ url: URL; headers: Record<string, string> }> = [];
    const pages = [
      {
        tweets: [{
          id: '1',
          text: 'First result',
          createdAt: '2026-08-20T10:00:00Z',
          likeCount: 12,
          retweetCount: 4,
          replyCount: 2,
          viewCount: 500,
          url: 'https://x.com/alice/status/1',
          author: { id: '10', username: 'alice', name: 'Alice' },
        }],
        has_next_page: true,
        next_cursor: 'next-page',
      },
      {
        tweets: [
          {
            id: '1',
            text: 'Duplicate',
            author: { id: '10', username: 'alice', name: 'Alice' },
          },
          {
            id: '2',
            text: 'Second result',
            entities: { urls: [{ expanded_url: 'https://example.com/source' }] },
            author: { id: '20', username: 'bob', name: 'Bob' },
          },
        ],
        has_next_page: false,
        next_cursor: '',
      },
    ];
    // @ts-expect-error - test stub
    globalThis.fetch = async (input: URL, init?: RequestInit) => {
      calls.push({
        url: new URL(input),
        headers: init?.headers as Record<string, string>,
      });
      return makeResponse({ status: 200, body: pages[calls.length - 1] });
    };

    const result = JSON.parse(await xSearchTool.invoke({
      command: 'search',
      query: '$ACME',
      sort: 'recent',
      since: '1d',
      pages: 2,
      limit: 10,
    })) as {
      data: { tweets: Array<{ id: string; metrics: { likes: number } }>; total_fetched: number };
      sourceUrls: string[];
    };

    expect(calls).toHaveLength(2);
    expect(calls[0].url.pathname).toBe('/api/v1/x/tweets/search');
    expect(calls[0].url.searchParams.get('q')).toBe('$ACME -is:retweet');
    expect(calls[0].url.searchParams.get('queryType')).toBe('Latest');
    expect(calls[0].url.searchParams.has('sinceTime')).toBe(true);
    expect(calls[1].url.searchParams.get('cursor')).toBe('next-page');
    expect(calls[0].headers['x-api-key']).toBe('test-xquik-key');
    expect(result.data.total_fetched).toBe(2);
    expect(result.data.tweets.map((tweet) => tweet.id)).toEqual(['1', '2']);
    expect(result.data.tweets[0].metrics.likes).toBe(12);
    expect(result.sourceUrls).toEqual([
      'https://x.com/alice/status/1',
      'https://x.com/bob/status/2',
    ]);
  });

  test('preserves the official API as the preferred provider', () => {
    process.env.X_BEARER_TOKEN = 'test-bearer-token';

    expect(getXSearchProvider()).toBe('official');
  });

  test('loads a profile and its timeline', async () => {
    const paths: string[] = [];
    // @ts-expect-error - test stub
    globalThis.fetch = async (input: URL) => {
      const url = new URL(input);
      paths.push(`${url.pathname}${url.search}`);
      const body = url.pathname.endsWith('/tweets')
        ? {
            tweets: [{
              id: '3',
              text: 'Profile result',
              author: { id: '30', username: 'carol', name: 'Carol' },
            }],
            has_next_page: false,
            next_cursor: '',
          }
        : { id: '30', username: 'carol', name: 'Carol', followers: 42 };
      return makeResponse({ status: 200, body });
    };

    const result = JSON.parse(await xSearchTool.invoke({
      command: 'profile',
      username: 'carol',
      limit: 5,
    })) as { data: { user: { followers: number }; tweets: Array<{ id: string }> } };

    expect(paths).toContain('/api/v1/x/users/carol');
    expect(paths).toContain('/api/v1/x/users/carol/tweets?pageSize=5&includeReplies=false');
    expect(result.data.user.followers).toBe(42);
    expect(result.data.tweets[0].id).toBe('3');
  });

  test('loads a thread through the native thread endpoint', async () => {
    let requestedUrl: URL | undefined;
    // @ts-expect-error - test stub
    globalThis.fetch = async (input: URL) => {
      requestedUrl = new URL(input);
      return makeResponse({
        status: 200,
        body: {
          tweets: [{
            id: '4',
            text: 'Thread result',
            author: { id: '40', username: 'dana', name: 'Dana' },
          }],
          has_next_page: false,
          next_cursor: '',
        },
      });
    };

    const result = JSON.parse(await xSearchTool.invoke({
      command: 'thread',
      query: '4',
      limit: 5,
    })) as { data: { tweets: Array<{ id: string }> } };

    expect(requestedUrl?.pathname).toBe('/api/v1/x/tweets/4/thread');
    expect(requestedUrl?.searchParams.get('pageSize')).toBe('100');
    expect(result.data.tweets[0].id).toBe('4');
  });

  test('reports Xquik API errors with tool context', async () => {
    // @ts-expect-error - test stub
    globalThis.fetch = async () => makeResponse({
      status: 401,
      body: { error: 'invalid_api_key' },
    });

    await expect(xSearchTool.invoke({
      command: 'search',
      query: '$ACME',
    })).rejects.toThrow('[x_search] Xquik API 401');
  });
});
