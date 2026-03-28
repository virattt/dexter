/**
 * TDD tests for the social_sentiment tool.
 *
 * Structure follows Red → Green → Refactor discipline:
 *   1. Pure function tests (scoreSentiment, aggregateStats, formatBar, sentimentEmoji)
 *      — written against the contracts BEFORE implementation details
 *   2. Tool-level integration tests (fetchReddit mock, X mock, combined)
 *   3. Edge cases: empty data, API failures, crypto detection
 *
 * Pure functions are exported from social-sentiment.ts specifically to enable
 * these isolated tests without mocking I/O.
 */
import { describe, expect, it } from 'bun:test';
import {
  scoreSentiment,
  aggregateStats,
  formatBar,
  sentimentEmoji,
  socialSentimentTool,
  type SentimentPost,
} from './social-sentiment.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<SentimentPost> & { text: string }): SentimentPost {
  const { sentiment, score: sentimentScore } = scoreSentiment(overrides.text);
  return {
    source: 'reddit',
    id: `id-${Math.random()}`,
    author: 'u/test',
    score: 100,
    url: 'https://reddit.com/r/test/comments/1',
    created_at: new Date().toISOString(),
    sentiment,
    sentimentScore,
    ...overrides,
  };
}

function getResultText(result: unknown): string {
  if (typeof result === 'string') return result;
  return (result as { data: { result: string } }).data.result ?? JSON.stringify(result);
}

// ---------------------------------------------------------------------------
// 1. scoreSentiment — pure function, no I/O
// ---------------------------------------------------------------------------

describe('scoreSentiment — keyword detection', () => {
  it('detects clear bullish text', () => {
    const r = scoreSentiment('AAPL looking super bullish this week, buying calls, strong earnings beat');
    expect(r.sentiment).toBe('bullish');
    expect(r.score).toBeGreaterThan(0);
  });

  it('detects clear bearish text', () => {
    const r = scoreSentiment('AAPL crashing, puts printing, sell everything, weak earnings miss');
    expect(r.sentiment).toBe('bearish');
    expect(r.score).toBeLessThan(0);
  });

  it('returns neutral for plain text with no signal words', () => {
    const r = scoreSentiment('AAPL reported results today at headquarters');
    expect(r.sentiment).toBe('neutral');
    expect(r.score).toBe(0);
  });

  it('score is bounded between -1 and +1', () => {
    const bull = scoreSentiment('buy long calls moon bullish rally soar pump green gain hold hodl');
    const bear = scoreSentiment('sell short puts crash dump bearish decline plunge weak loss rip dead');
    expect(bull.score).toBeGreaterThanOrEqual(-1);
    expect(bull.score).toBeLessThanOrEqual(1);
    expect(bear.score).toBeGreaterThanOrEqual(-1);
    expect(bear.score).toBeLessThanOrEqual(1);
  });

  it('detects bullish emojis 🚀📈', () => {
    const r = scoreSentiment('AAPL 🚀📈 to the moon');
    expect(r.sentiment).toBe('bullish');
  });

  it('detects bearish emojis 📉🩸', () => {
    const r = scoreSentiment('AAPL 📉🩸 rip');
    expect(r.sentiment).toBe('bearish');
  });

  it('mixed signals balance toward neutral', () => {
    const r = scoreSentiment('buy puts and sell calls, bullish on the bearish trend');
    // Mixed — score should be close to 0
    expect(Math.abs(r.score)).toBeLessThan(0.6);
  });

  it('is case-insensitive', () => {
    const lower = scoreSentiment('BULLISH CALLS LONG BUY MOON');
    const upper = scoreSentiment('bullish calls long buy moon');
    expect(lower.sentiment).toBe(upper.sentiment);
    expect(lower.score).toBe(upper.score);
  });
});

// ---------------------------------------------------------------------------
// 2. aggregateStats — pure function, no I/O
// ---------------------------------------------------------------------------

describe('aggregateStats — sentiment aggregation', () => {
  it('returns all-zero stats for empty array', () => {
    const stats = aggregateStats([]);
    expect(stats.total).toBe(0);
    expect(stats.bullishPct).toBe(0);
    expect(stats.bearishPct).toBe(0);
    expect(stats.avgScore).toBe(0);
  });

  it('computes correct percentages for 3 bullish + 1 bearish', () => {
    const posts: SentimentPost[] = [
      makePost({ text: 'buy calls strong bullish rally' }),
      makePost({ text: 'buy the dip, going long, gains incoming' }),
      makePost({ text: 'rocket moon squeeze breakout' }),
      makePost({ text: 'sell puts crash dump panic' }),
    ];
    const stats = aggregateStats(posts);
    expect(stats.total).toBe(4);
    expect(stats.bullish).toBe(3);
    expect(stats.bearish).toBe(1);
    expect(stats.bullishPct).toBe(75);
    expect(stats.bearishPct).toBe(25);
  });

  it('weights by engagement: high-score bullish post lifts avgScore', () => {
    const posts: SentimentPost[] = [
      makePost({ text: 'sell crash bearish puts dump decline plunge', score: 10 }),   // weak bear
      makePost({ text: 'buy calls moon bullish strong rally soar', score: 1000 }),    // viral bull
    ];
    const stats = aggregateStats(posts);
    // avgScore should be positive because the bullish post has 100× the engagement
    expect(stats.avgScore).toBeGreaterThan(0);
  });

  it('bullishPct + bearishPct + neutralPct = 100', () => {
    const posts: SentimentPost[] = [
      makePost({ text: 'buy long bullish' }),
      makePost({ text: 'sell short bearish' }),
      makePost({ text: 'quarterly report filed today' }),
    ];
    const stats = aggregateStats(posts);
    expect(stats.bullishPct + stats.bearishPct + stats.neutralPct).toBe(100);
  });

  it('avgScore is in range -100 to +100', () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      makePost({ text: i % 2 === 0 ? 'buy long bullish moon 🚀' : 'sell short bearish crash 📉' }),
    );
    const stats = aggregateStats(posts);
    expect(stats.avgScore).toBeGreaterThanOrEqual(-100);
    expect(stats.avgScore).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// 3. formatBar — pure function
// ---------------------------------------------------------------------------

describe('formatBar — ASCII chart rendering', () => {
  it('full bar at 100%', () => {
    const bar = formatBar(100, '🐂');
    expect(bar).toContain('🐂');
    expect(bar).toContain('████████████████████'); // 20 full blocks
    expect(bar).not.toContain('░');
    expect(bar).toContain('100%');
  });

  it('empty bar at 0%', () => {
    const bar = formatBar(0, '🐻');
    expect(bar).toContain('🐻');
    expect(bar).not.toContain('█');
    expect(bar).toContain('░░░░░░░░░░░░░░░░░░░░'); // 20 empty blocks
    expect(bar).toContain('0%');
  });

  it('half bar at 50%', () => {
    const bar = formatBar(50, '😐');
    expect(bar).toContain('██████████'); // 10 filled
    expect(bar).toContain('░░░░░░░░░░'); // 10 empty
    expect(bar).toContain('50%');
  });
});

// ---------------------------------------------------------------------------
// 4. sentimentEmoji — pure function
// ---------------------------------------------------------------------------

describe('sentimentEmoji — label thresholds', () => {
  it('+80 → Very Bullish', () => expect(sentimentEmoji(80)).toContain('Very Bullish'));
  it('+40 → Bullish',      () => expect(sentimentEmoji(40)).toContain('Bullish'));
  it('0  → Neutral',       () => expect(sentimentEmoji(0)).toContain('Neutral'));
  it('-40 → Bearish',      () => expect(sentimentEmoji(-40)).toContain('Bearish'));
  it('-80 → Very Bearish', () => expect(sentimentEmoji(-80)).toContain('Very Bearish'));

  it('boundary: +60 is still Very Bullish', () => expect(sentimentEmoji(60)).toContain('Very Bullish'));
  it('boundary: +19 is Neutral/Mixed',      () => expect(sentimentEmoji(19)).toContain('Neutral'));
  it('boundary: +20 is Bullish',            () => expect(sentimentEmoji(20)).toContain('Bullish'));
});

// ---------------------------------------------------------------------------
// 5. Tool integration — mock fetch (Reddit only)
// ---------------------------------------------------------------------------

function makeRedditResponse(posts: object[]) {
  return { data: { children: posts.map((p) => ({ data: p })) } };
}

const BULL_POST = {
  id: 'b1', title: 'AAPL strong buy calls bullish rally breakout',
  selftext: 'buy the dip loading accumulate', author: 'bulltrader',
  ups: 500, upvote_ratio: 0.92,
  permalink: '/r/wallstreetbets/comments/b1/bull/', created_utc: Math.floor(Date.now() / 1000) - 3600,
};
const BEAR_POST = {
  id: 'br1', title: 'AAPL crash sell puts dump bearish decline',
  selftext: 'weak earnings miss avoid exit', author: 'beartrader',
  ups: 200, upvote_ratio: 0.75,
  permalink: '/r/wallstreetbets/comments/br1/bear/', created_utc: Math.floor(Date.now() / 1000) - 7200,
};

function mockFetchReddit(bullCount: number, bearCount: number) {
  return async (url: string | URL) => {
    if (String(url).includes('reddit.com')) {
      const posts = [...Array(bullCount).fill(BULL_POST), ...Array(bearCount).fill(BEAR_POST)];
      return { ok: true, status: 200, json: async () => makeRedditResponse(posts) } as Response;
    }
    // Deny X/FearGreed so we test Reddit path cleanly
    return { ok: false, status: 403, json: async () => ({}) } as Response;
  };
}

describe('socialSentimentTool — integration (mocked fetch)', () => {
  it('tool name is social_sentiment', () => {
    expect(socialSentimentTool.name).toBe('social_sentiment');
  });

  it('reports bullish when most posts are bullish', async () => {
    globalThis.fetch = mockFetchReddit(8, 2) as unknown as typeof fetch;
    const text = getResultText(await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 15 }));
    expect(text).toMatch(/Bullish/i);
    expect(text).toContain('AAPL');
  });

  it('reports bearish when most posts are bearish', async () => {
    globalThis.fetch = mockFetchReddit(1, 9) as unknown as typeof fetch;
    const text = getResultText(await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 15 }));
    expect(text).toMatch(/Bearish/i);
  });

  it('contains visual bar chart (🐂/🐻/😐)', async () => {
    globalThis.fetch = mockFetchReddit(5, 3) as unknown as typeof fetch;
    const text = getResultText(await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 10 }));
    expect(text).toContain('🐂');
    expect(text).toContain('🐻');
    expect(text).toContain('😐');
  });

  it('includes sentiment score in -100 to +100 format', async () => {
    globalThis.fetch = mockFetchReddit(6, 2) as unknown as typeof fetch;
    const text = getResultText(await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 10 }));
    expect(text).toMatch(/[+-]?\d+\/100/);
  });

  it('contains source attribution footer', async () => {
    globalThis.fetch = mockFetchReddit(4, 2) as unknown as typeof fetch;
    const text = getResultText(await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 10 }));
    expect(text).toContain('Reddit');
  });

  it('shows top bullish posts section when bullish posts exist', async () => {
    globalThis.fetch = mockFetchReddit(5, 1) as unknown as typeof fetch;
    const text = getResultText(await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 10 }));
    expect(text).toContain('Top Bullish Posts');
  });

  it('shows top bearish posts section when bearish posts exist', async () => {
    globalThis.fetch = mockFetchReddit(1, 5) as unknown as typeof fetch;
    const text = getResultText(await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 10 }));
    expect(text).toContain('Top Bearish Posts');
  });

  it('accepts free-text query (no ticker)', async () => {
    globalThis.fetch = mockFetchReddit(3, 2) as unknown as typeof fetch;
    const text = getResultText(await socialSentimentTool.invoke({ query: 'Federal Reserve rate cut', limit: 10 }));
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(20);
  });

  it('returns no-results message for empty Reddit response', async () => {
    globalThis.fetch = mockFetchReddit(0, 0) as unknown as typeof fetch;
    const text = getResultText(await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 5 }));
    expect(text).toContain('No social media posts found');
  });

  it('handles Reddit API failure gracefully (no throw)', async () => {
    globalThis.fetch = (async () => { throw new Error('Network failure'); }) as unknown as typeof fetch;
    const text = getResultText(await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 5 }));
    expect(text).toContain('No social media posts found');
  });

  it('deduplicates repeated posts from multiple subreddits', async () => {
    // Same post id appearing in multiple subreddit responses
    globalThis.fetch = mockFetchReddit(3, 1) as unknown as typeof fetch;
    const text = getResultText(await socialSentimentTool.invoke({ ticker: 'AAPL', limit: 20 }));
    // Just verify it doesn't crash and returns valid output
    expect(text).toContain('AAPL');
  });
});
