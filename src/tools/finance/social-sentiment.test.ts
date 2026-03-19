import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { socialSentimentTool } from './social-sentiment.js';
import { getToolRegistry } from '../registry.js';

const originalFetch = globalThis.fetch;
const originalAdanosApiKey = process.env.ADANOS_API_KEY;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('socialSentimentTool', () => {
  beforeEach(() => {
    process.env.ADANOS_API_KEY = 'sk_test_adanos';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalAdanosApiKey === undefined) {
      delete process.env.ADANOS_API_KEY;
    } else {
      process.env.ADANOS_API_KEY = originalAdanosApiKey;
    }
  });

  test('returns normalized cross-source sentiment snapshots and averages', async () => {
    const fetchMock = mock(async (url: string | URL) => {
      const href = String(url);

      if (href.includes('/reddit/stocks/v1/compare')) {
        return jsonResponse({
          stocks: [
            {
              ticker: 'TSLA',
              buzz_score: 81.2,
              bullish_pct: 46,
              trend: 'rising',
              sentiment_score: 0.14,
              mentions: 647,
              unique_posts: 211,
              subreddit_count: 23,
              total_upvotes: 4120,
            },
            {
              ticker: 'NVDA',
              buzz_score: 60.0,
              bullish_pct: 52,
              trend: 'stable',
              sentiment_score: 0.11,
              mentions: 180,
              unique_posts: 99,
              subreddit_count: 14,
              total_upvotes: 1440,
            },
          ],
        });
      }

      if (href.includes('/x/stocks/v1/compare')) {
        return jsonResponse({
          stocks: [
            {
              ticker: 'TSLA',
              buzz_score: 86.4,
              bullish_pct: 58,
              trend: 'falling',
              sentiment_score: 0.29,
              mentions: 2650,
              unique_tweets: 392,
              total_upvotes: 95000,
            },
            {
              ticker: 'NVDA',
              buzz_score: 74.8,
              bullish_pct: 61,
              trend: 'rising',
              sentiment_score: 0.34,
              mentions: 1480,
              unique_tweets: 201,
              total_upvotes: 42000,
            },
          ],
        });
      }

      if (href.includes('/polymarket/stocks/v1/compare')) {
        return jsonResponse({
          stocks: [
            {
              ticker: 'TSLA',
              buzz_score: 55.7,
              bullish_pct: 72,
              trend: 'stable',
              sentiment_score: 0.41,
              trade_count: 3731,
              market_count: 71,
              total_liquidity: 8400000,
            },
            {
              ticker: 'NVDA',
              buzz_score: 0.0,
              bullish_pct: null,
              trend: null,
              sentiment_score: null,
              trade_count: 0,
              market_count: 0,
              total_liquidity: 0,
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch URL: ${href}`);
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const rawResult = await socialSentimentTool.invoke({
      tickers: ['tsla', '$nvda'],
      days: 7,
    });
    const result = JSON.parse(rawResult as string);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.sourceUrls).toEqual([
      'https://api.adanos.org/reddit/stocks/v1/compare?tickers=TSLA%2CNVDA&days=7',
      'https://api.adanos.org/x/stocks/v1/compare?tickers=TSLA%2CNVDA&days=7',
      'https://api.adanos.org/polymarket/stocks/v1/compare?tickers=TSLA%2CNVDA&days=7',
    ]);

    expect(result.data).toEqual({
      period_days: 7,
      requested_sources: ['reddit', 'x', 'polymarket'],
      stocks: [
        {
          ticker: 'TSLA',
          average_buzz: 74.4,
          average_bullish_pct: 58.7,
          sources_with_data: 3,
          sources_requested: 3,
          sources: {
            reddit: {
              available: true,
              buzz_score: 81.2,
              bullish_pct: 46,
              trend: 'rising',
              sentiment_score: 0.14,
              mentions: 647,
              unique_posts: 211,
              subreddit_count: 23,
              total_upvotes: 4120,
            },
            x: {
              available: true,
              buzz_score: 86.4,
              bullish_pct: 58,
              trend: 'falling',
              sentiment_score: 0.29,
              mentions: 2650,
              unique_tweets: 392,
              total_upvotes: 95000,
            },
            polymarket: {
              available: true,
              buzz_score: 55.7,
              bullish_pct: 72,
              trend: 'stable',
              sentiment_score: 0.41,
              trade_count: 3731,
              market_count: 71,
              total_liquidity: 8400000,
            },
          },
        },
        {
          ticker: 'NVDA',
          average_buzz: 67.4,
          average_bullish_pct: 56.5,
          sources_with_data: 2,
          sources_requested: 3,
          sources: {
            reddit: {
              available: true,
              buzz_score: 60.0,
              bullish_pct: 52,
              trend: 'stable',
              sentiment_score: 0.11,
              mentions: 180,
              unique_posts: 99,
              subreddit_count: 14,
              total_upvotes: 1440,
            },
            x: {
              available: true,
              buzz_score: 74.8,
              bullish_pct: 61,
              trend: 'rising',
              sentiment_score: 0.34,
              mentions: 1480,
              unique_tweets: 201,
              total_upvotes: 42000,
            },
            polymarket: {
              available: false,
              buzz_score: null,
              bullish_pct: null,
              trend: null,
              sentiment_score: null,
              trade_count: 0,
              market_count: 0,
              total_liquidity: 0,
            },
          },
        },
      ],
    });
  });

  test('keeps successful sources when one source fails', async () => {
    const fetchMock = mock(async (url: string | URL) => {
      const href = String(url);

      if (href.includes('/reddit/stocks/v1/compare')) {
        return jsonResponse({
          stocks: [
            {
              ticker: 'TSLA',
              buzz_score: 81.2,
              bullish_pct: 46,
              trend: 'rising',
              sentiment_score: 0.14,
              mentions: 647,
              unique_posts: 211,
              subreddit_count: 23,
              total_upvotes: 4120,
            },
          ],
        });
      }

      if (href.includes('/x/stocks/v1/compare')) {
        return new Response('upstream failed', { status: 503, statusText: 'Service Unavailable' });
      }

      if (href.includes('/polymarket/stocks/v1/compare')) {
        return jsonResponse({
          stocks: [
            {
              ticker: 'TSLA',
              buzz_score: 55.7,
              bullish_pct: 72,
              trend: 'stable',
              sentiment_score: 0.41,
              trade_count: 3731,
              market_count: 71,
              total_liquidity: 8400000,
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch URL: ${href}`);
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const rawResult = await socialSentimentTool.invoke({
      tickers: ['TSLA'],
      days: 7,
    });
    const result = JSON.parse(rawResult as string);

    expect(result.data.source_errors).toEqual([
      {
        source: 'x',
        error: 'x compare request failed: 503 Service Unavailable',
      },
    ]);
    expect(result.data.stocks[0]).toMatchObject({
      ticker: 'TSLA',
      average_buzz: 68.5,
      average_bullish_pct: 59.0,
      sources_with_data: 2,
      sources_requested: 3,
    });
  });

  test('fails clearly when all requested sources fail', async () => {
    const fetchMock = mock(async () => new Response('rate limited', { status: 429, statusText: 'Too Many Requests' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      socialSentimentTool.invoke({
        tickers: ['TSLA'],
        days: 7,
      }),
    ).rejects.toThrow(
      '[social_sentiment] All requested sentiment sources failed (reddit: reddit compare request failed: 429 Too Many Requests; x: x compare request failed: 429 Too Many Requests; polymarket: polymarket compare request failed: 429 Too Many Requests)',
    );
  });

  test('supports the full paid lookback window exposed by the API', async () => {
    const fetchMock = mock(async (url: string | URL) => {
      const href = String(url);
      expect(href).toContain('days=90');
      return jsonResponse({
        stocks: [
          {
            ticker: 'TSLA',
            buzz_score: 70.3,
            bullish_pct: 55,
            trend: 'stable',
            sentiment_score: 0.18,
            mentions: 1200,
            unique_posts: 410,
            subreddit_count: 38,
            total_upvotes: 8200,
          },
        ],
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const rawResult = await socialSentimentTool.invoke({
      tickers: ['TSLA'],
      days: 90,
      sources: ['reddit'],
    });
    const result = JSON.parse(rawResult as string);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.data.period_days).toBe(90);
    expect(result.data.requested_sources).toEqual(['reddit']);
    expect(result.data.stocks[0]).toMatchObject({
      ticker: 'TSLA',
      average_buzz: 70.3,
      average_bullish_pct: 55.0,
      sources_with_data: 1,
      sources_requested: 1,
    });
  });
});

describe('social_sentiment registry gating', () => {
  afterEach(() => {
    if (originalAdanosApiKey === undefined) {
      delete process.env.ADANOS_API_KEY;
    } else {
      process.env.ADANOS_API_KEY = originalAdanosApiKey;
    }
  });

  test('does not register social_sentiment without ADANOS_API_KEY', () => {
    delete process.env.ADANOS_API_KEY;
    const toolNames = getToolRegistry('gpt-5.4').map((tool) => tool.name);
    expect(toolNames).not.toContain('social_sentiment');
  });

  test('registers social_sentiment when ADANOS_API_KEY is set', () => {
    process.env.ADANOS_API_KEY = 'sk_test_adanos';
    const toolNames = getToolRegistry('gpt-5.4').map((tool) => tool.name);
    expect(toolNames).toContain('social_sentiment');
  });
});
