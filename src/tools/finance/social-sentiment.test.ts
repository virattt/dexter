import { describe, expect, it } from 'bun:test';
import { socialSentimentTool } from './social-sentiment.js';

// ---------------------------------------------------------------------------
// Unit tests — mock fetch
// ---------------------------------------------------------------------------

const REDDIT_POST = {
  id: 'abc123',
  title: 'AAPL looking super bullish this week, buying calls!',
  selftext: 'Strong earnings, buy the dip',
  author: 'trader99',
  ups: 500,
  upvote_ratio: 0.92,
  permalink: '/r/wallstreetbets/comments/abc123/aapl_bullish/',
  created_utc: Math.floor(Date.now() / 1000) - 3600,
};

const REDDIT_POST_BEAR = {
  id: 'def456',
  title: 'AAPL crashing, selling everything, puts printing',
  selftext: 'Weak earnings, avoid this stock',
  author: 'permabear',
  ups: 200,
  upvote_ratio: 0.75,
  permalink: '/r/wallstreetbets/comments/def456/aapl_dump/',
  created_utc: Math.floor(Date.now() / 1000) - 7200,
};

function makeRedditResponse(posts: object[]) {
  return {
    data: {
      children: posts.map((p) => ({ data: p })),
    },
  };
}

function mockFetchReddit(bullPosts: number, bearPosts: number) {
  return async (url: string | URL) => {
    const urlStr = String(url);
    if (urlStr.includes('reddit.com')) {
      const posts = [
        ...Array(bullPosts).fill(REDDIT_POST),
        ...Array(bearPosts).fill(REDDIT_POST_BEAR),
      ];
      return {
        ok: true,
        status: 200,
        json: async () => makeRedditResponse(posts),
      } as Response;
    }
    // Deny other calls (X API, fear/greed)
    return { ok: false, status: 403, json: async () => ({}) } as Response;
  };
}

function getResultText(result: unknown): string {
  if (typeof result === 'string') return result;
  return (result as { data: { result: string } }).data.result ?? JSON.stringify(result);
}

describe('socialSentimentTool', () => {
  it('tool name is social_sentiment', () => {
    expect(socialSentimentTool.name).toBe('social_sentiment');
  });

  it('shows bullish sentiment when posts are mostly bullish', async () => {
    globalThis.fetch = mockFetchReddit(10, 2) as unknown as typeof fetch;
    const result = await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 15 });
    const text = getResultText(result);
    expect(text).toContain('AAPL');
    expect(text).toMatch(/Bullish|Neutral/i);
  });

  it('shows bearish sentiment when posts are mostly bearish', async () => {
    globalThis.fetch = mockFetchReddit(2, 10) as unknown as typeof fetch;
    const result = await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 15 });
    const text = getResultText(result);
    expect(text).toMatch(/Bearish|Neutral/i);
  });

  it('includes source attribution footer', async () => {
    globalThis.fetch = mockFetchReddit(5, 2) as unknown as typeof fetch;
    const result = await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 10 });
    const text = getResultText(result);
    expect(text).toContain('Reddit');
  });

  it('accepts a free-text query instead of a ticker', async () => {
    globalThis.fetch = mockFetchReddit(4, 3) as unknown as typeof fetch;
    const result = await socialSentimentTool.invoke({ query: 'Federal Reserve rate cut', limit: 10 });
    const text = getResultText(result);
    // Should not throw and should return a report
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(20);
  });

  it('shows no-results message when Reddit returns empty', async () => {
    globalThis.fetch = mockFetchReddit(0, 0) as unknown as typeof fetch;
    const result = await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 5 });
    const text = getResultText(result);
    expect(text).toContain('No social media posts found');
  });

  it('handles network failure gracefully without throwing', async () => {
    globalThis.fetch = (async () => { throw new Error('Network down'); }) as unknown as typeof fetch;
    const result = await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 5 });
    const text = getResultText(result);
    expect(text).toContain('No social media posts found');
  });

  it('shows sentiment score in expected range (-100 to +100)', async () => {
    globalThis.fetch = mockFetchReddit(8, 2) as unknown as typeof fetch;
    const result = await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 15 });
    const text = getResultText(result);
    // Score should appear as e.g. "+42/100" or "-15/100"
    expect(text).toMatch(/[+-]?\d+\/100/);
  });

  it('displays bullish/bearish bar chart', async () => {
    globalThis.fetch = mockFetchReddit(5, 5) as unknown as typeof fetch;
    const result = await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 10 });
    const text = getResultText(result);
    expect(text).toContain('🐂');
    expect(text).toContain('🐻');
  });
});
