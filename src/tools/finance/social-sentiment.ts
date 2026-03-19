import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

const ADANOS_API_BASE = 'https://api.adanos.org';
const SOURCE_KEYS = ['reddit', 'x', 'polymarket'] as const;

type SourceKey = (typeof SOURCE_KEYS)[number];

type CompareRow = Record<string, unknown>;

type SourceResult = {
  source: SourceKey;
  rows: CompareRow[];
  url: string;
};

type SourceSnapshot = {
  available: boolean;
  buzz_score: number | null;
  bullish_pct: number | null;
  trend: 'rising' | 'falling' | 'stable' | null;
  sentiment_score: number | null;
  mentions?: number;
  unique_posts?: number;
  subreddit_count?: number;
  unique_tweets?: number;
  total_upvotes?: number;
  trade_count?: number;
  market_count?: number;
  total_liquidity?: number | null;
};

export const SOCIAL_SENTIMENT_DESCRIPTION = `
Get structured cross-source social stock sentiment snapshots from Reddit, X/Twitter, and Polymarket.

## When to Use

- Questions like "what's the social sentiment on TSLA?"
- Comparing social/prediction-market sentiment across multiple stocks
- Checking whether Reddit, X/Twitter, and Polymarket are aligned or diverging
- Getting compact sentiment inputs before deeper analysis

## When NOT to Use

- Company fundamentals, prices, analyst estimates, filings, or earnings (use financial_search)
- Raw tweet-level or thread-level X/Twitter research (use x_search)
- General web/news discovery outside structured sentiment snapshots

## Usage Notes

- Returns normalized per-source sentiment blocks plus cross-source averages
- Uses batched compare endpoints for up to 10 tickers per request
- Supports Reddit, X/Twitter, and Polymarket as optional source filters
- Requires \`ADANOS_API_KEY\`
`.trim();

const SocialSentimentInputSchema = z.object({
  tickers: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe('List of stock tickers to analyze (max 10), e.g. ["TSLA", "NVDA", "AMD"].'),
  days: z
    .number()
    .int()
    .min(1)
    .max(90)
    .default(7)
    .describe('Lookback window in days (1-90, default: 7). Free Adanos accounts may be limited to 30 days by the API.'),
  sources: z
    .array(z.enum(SOURCE_KEYS))
    .optional()
    .describe('Optional source filter. Defaults to Reddit, X/Twitter, and Polymarket.'),
});

function getAdanosApiKey(): string {
  const apiKey = process.env.ADANOS_API_KEY;
  if (!apiKey) {
    throw new Error('ADANOS_API_KEY is not set');
  }
  return apiKey;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^\$/, '');
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toRoundedNumber(value: unknown, digits = 1): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    return null;
  }
  return Number(parsed.toFixed(digits));
}

function toRoundedInteger(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    return null;
  }
  return Math.round(parsed);
}

function toTrend(value: unknown): SourceSnapshot['trend'] {
  return value === 'rising' || value === 'falling' || value === 'stable' ? value : null;
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) {
    return null;
  }
  const total = present.reduce((sum, value) => sum + value, 0);
  return Number((total / present.length).toFixed(1));
}

function hasSourceData(source: SourceKey, row: CompareRow): boolean {
  if (source === 'polymarket') {
    return (toRoundedInteger(row.trade_count) ?? 0) > 0;
  }
  return (toRoundedInteger(row.mentions) ?? 0) > 0;
}

function buildSourceSnapshot(source: SourceKey, row: CompareRow | undefined): SourceSnapshot {
  if (!row || !hasSourceData(source, row)) {
    if (source === 'polymarket') {
      return {
        available: false,
        buzz_score: null,
        bullish_pct: null,
        trend: null,
        sentiment_score: null,
        trade_count: 0,
        market_count: 0,
        total_liquidity: 0,
      };
    }

    return {
      available: false,
      buzz_score: null,
      bullish_pct: null,
      trend: null,
      sentiment_score: null,
      mentions: 0,
      ...(source === 'reddit'
        ? { unique_posts: 0, subreddit_count: 0, total_upvotes: 0 }
        : { unique_tweets: 0, total_upvotes: 0 }),
    };
  }

  if (source === 'reddit') {
    return {
      available: true,
      buzz_score: toRoundedNumber(row.buzz_score),
      bullish_pct: toRoundedInteger(row.bullish_pct),
      trend: toTrend(row.trend),
      sentiment_score: toRoundedNumber(row.sentiment_score, 3),
      mentions: toRoundedInteger(row.mentions) ?? 0,
      unique_posts: toRoundedInteger(row.unique_posts) ?? 0,
      subreddit_count: toRoundedInteger(row.subreddit_count) ?? 0,
      total_upvotes: toRoundedInteger(row.total_upvotes) ?? 0,
    };
  }

  if (source === 'x') {
    return {
      available: true,
      buzz_score: toRoundedNumber(row.buzz_score),
      bullish_pct: toRoundedInteger(row.bullish_pct),
      trend: toTrend(row.trend),
      sentiment_score: toRoundedNumber(row.sentiment_score, 3),
      mentions: toRoundedInteger(row.mentions) ?? 0,
      unique_tweets: toRoundedInteger(row.unique_tweets) ?? 0,
      total_upvotes: toRoundedInteger(row.total_upvotes) ?? 0,
    };
  }

  return {
    available: true,
    buzz_score: toRoundedNumber(row.buzz_score),
    bullish_pct: toRoundedInteger(row.bullish_pct),
    trend: toTrend(row.trend),
    sentiment_score: toRoundedNumber(row.sentiment_score, 3),
    trade_count: toRoundedInteger(row.trade_count) ?? 0,
    market_count: toRoundedInteger(row.market_count) ?? 0,
    total_liquidity: toRoundedNumber(row.total_liquidity),
  };
}

async function callAdanosCompare(source: SourceKey, tickers: string[], days: number): Promise<SourceResult> {
  const url = new URL(`${ADANOS_API_BASE}/${source}/stocks/v1/compare`);
  url.searchParams.set('tickers', tickers.join(','));
  url.searchParams.set('days', String(days));

  const response = await fetch(url.toString(), {
    headers: {
      'X-API-Key': getAdanosApiKey(),
    },
  });

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`.trim();
    throw new Error(`${source} compare request failed: ${detail}`);
  }

  const payload = await response.json().catch(() => {
    throw new Error(`${source} compare request returned invalid JSON`);
  });

  const rows = payload && typeof payload === 'object' && Array.isArray((payload as { stocks?: unknown[] }).stocks)
    ? ((payload as { stocks: unknown[] }).stocks.filter((row): row is CompareRow => typeof row === 'object' && row !== null))
    : [];

  return { source, rows, url: url.toString() };
}

function buildSocialSentimentPayload(
  tickers: string[],
  days: number,
  requestedSources: SourceKey[],
  results: SourceResult[],
  errors: Array<{ source: SourceKey; error: string }>,
): Record<string, unknown> {
  const rowsBySource = new Map<SourceKey, Map<string, CompareRow>>();

  for (const result of results) {
    const rowMap = new Map<string, CompareRow>();
    for (const row of result.rows) {
      const ticker = typeof row.ticker === 'string' ? normalizeTicker(row.ticker) : null;
      if (ticker) {
        rowMap.set(ticker, row);
      }
    }
    rowsBySource.set(result.source, rowMap);
  }

  const stocks = tickers.map((ticker) => {
    const sources = Object.fromEntries(
      requestedSources.map((source) => [source, buildSourceSnapshot(source, rowsBySource.get(source)?.get(ticker))]),
    ) as Record<SourceKey, SourceSnapshot>;

    const availableSources = requestedSources.filter((source) => sources[source].available);

    return {
      ticker,
      average_buzz: average(availableSources.map((source) => sources[source].buzz_score)),
      average_bullish_pct: average(availableSources.map((source) => sources[source].bullish_pct)),
      sources_with_data: availableSources.length,
      sources_requested: requestedSources.length,
      sources,
    };
  });

  const payload: Record<string, unknown> = {
    period_days: days,
    requested_sources: requestedSources,
    stocks,
  };

  if (errors.length > 0) {
    payload.source_errors = errors;
  }

  return payload;
}

export const socialSentimentTool = new DynamicStructuredTool({
  name: 'social_sentiment',
  description:
    'Retrieves structured cross-source social stock sentiment snapshots from Reddit, X/Twitter, and Polymarket. Use for social sentiment comparisons and cross-source alignment checks.',
  schema: SocialSentimentInputSchema,
  func: async (input) => {
    try {
      const tickers = [...new Set(input.tickers.map(normalizeTicker).filter(Boolean))];
      const requestedSources = [...new Set((input.sources?.length ? input.sources : SOURCE_KEYS))];

      if (tickers.length === 0) {
        throw new Error('At least one valid ticker is required');
      }

      const results = await Promise.all(
        requestedSources.map(async (source) => {
          try {
            return await callAdanosCompare(source, tickers, input.days);
          } catch (error) {
            return {
              source,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      const successful = results.filter((result): result is SourceResult => 'rows' in result);
      const failed = results.filter((result): result is { source: SourceKey; error: string } => 'error' in result);

      if (successful.length === 0) {
        const summary = failed.map((item) => `${item.source}: ${item.error}`).join('; ');
        throw new Error(`All requested sentiment sources failed (${summary})`);
      }

      return formatToolResult(
        buildSocialSentimentPayload(tickers, input.days, requestedSources, successful, failed),
        successful.map((result) => result.url),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[social_sentiment] ${message}`);
    }
  },
});
