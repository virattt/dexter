import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

export const ONCHAIN_CRYPTO_DESCRIPTION = `
Fetches on-chain and market intelligence metrics for cryptocurrencies from CoinGecko (free, no key). Returns market data, community sentiment, developer activity, and global market context. Use when the user asks about crypto fundamentals, on-chain health, developer activity, or market sentiment beyond just price.

## When to Use
- User asks about crypto fundamentals, on-chain health, or developer activity  
- Analyzing whale sentiment, community growth, or ecosystem health
- Comparing crypto projects beyond price (developer commits, community size)
- Global crypto market overview (BTC dominance, total market cap)

## Example Queries
- "What's the on-chain health of Ethereum?"
- "Is Bitcoin developer activity increasing?"
- "What is the BTC dominance right now?"
- "Compare ETH and SOL community/developer metrics"
- "Is crypto market sentiment bullish or bearish?"
`.trim();

/** Map of well-known tickers to CoinGecko IDs. */
export const TICKER_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  LINK: 'chainlink',
};

/** Resolve a ticker symbol to a CoinGecko ID. */
export function resolveCoinGeckoId(ticker: string): string {
  const upper = ticker.trim().toUpperCase();
  return TICKER_TO_COINGECKO_ID[upper] ?? ticker.trim().toLowerCase();
}

const OnchainCryptoInputSchema = z.object({
  ticker: z.string().describe("Crypto ticker e.g. 'BTC', 'ETH', 'SOL'"),
  metrics: z
    .array(z.enum(['market', 'sentiment', 'developer', 'community', 'global']))
    .default(['market', 'sentiment'])
    .describe('Which on-chain/market metrics to fetch'),
});

type MetricCategory = 'market' | 'sentiment' | 'developer' | 'community' | 'global';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMarketMetrics(data: any): Record<string, unknown> {
  const md = data?.market_data ?? {};
  return {
    price_change_24h_pct: md.price_change_percentage_24h ?? null,
    price_change_7d_pct: md.price_change_percentage_7d ?? null,
    price_change_30d_pct: md.price_change_percentage_30d ?? null,
    market_cap_rank: data?.market_cap_rank ?? null,
    ath_change_percentage: md.ath_change_percentage?.usd ?? null,
    total_volume_usd: md.total_volume?.usd ?? null,
    circulating_supply: md.circulating_supply ?? null,
    max_supply: md.max_supply ?? null,
    current_price_usd: md.current_price?.usd ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSentimentMetrics(data: any): Record<string, unknown> {
  return {
    sentiment_votes_up_percentage: data?.sentiment_votes_up_percentage ?? null,
    sentiment_votes_down_percentage: data?.sentiment_votes_down_percentage ?? null,
    public_interest_score: data?.public_interest_score ?? null,
    coingecko_score: data?.coingecko_score ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDeveloperMetrics(data: any): Record<string, unknown> {
  const dd = data?.developer_data ?? {};
  return {
    forks: dd.forks ?? null,
    stars: dd.stars ?? null,
    total_issues: dd.total_issues ?? null,
    closed_issues: dd.closed_issues ?? null,
    pull_requests_merged: dd.pull_requests_merged ?? null,
    commit_activity_4_weeks: dd.commit_activity_4_weeks ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCommunityMetrics(data: any): Record<string, unknown> {
  const cd = data?.community_data ?? {};
  return {
    twitter_followers: cd.twitter_followers ?? null,
    reddit_subscribers: cd.reddit_subscribers ?? null,
    reddit_average_posts_48h: cd.reddit_average_posts_48h ?? null,
    telegram_channel_user_count: cd.telegram_channel_user_count ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractGlobalMetrics(globalData: any): Record<string, unknown> {
  const d = globalData?.data ?? {};
  return {
    total_market_cap_usd: d.total_market_cap?.usd ?? null,
    total_volume_24h_usd: d.total_volume?.usd ?? null,
    btc_dominance: d.market_cap_percentage?.btc ?? null,
    eth_dominance: d.market_cap_percentage?.eth ?? null,
    market_cap_change_24h_pct: d.market_cap_change_percentage_24h_usd ?? null,
    active_cryptocurrencies: d.active_cryptocurrencies ?? null,
  };
}

export const getOnchainCrypto = new DynamicStructuredTool({
  name: 'get_onchain_crypto',
  description:
    'Fetches on-chain and market intelligence metrics for cryptocurrencies from CoinGecko (free, no API key needed). Returns market data, community sentiment, developer activity, and global market context.',
  schema: OnchainCryptoInputSchema,
  func: async (input) => {
    const coinId = resolveCoinGeckoId(input.ticker);
    const metrics = input.metrics as MetricCategory[];
    const needsCoinData = metrics.some((m) => m !== 'global');
    const needsGlobal = metrics.includes('global');

    const result: Record<string, unknown> = {
      ticker: input.ticker.trim().toUpperCase(),
      coinGeckoId: coinId,
    };
    const sourceUrls: string[] = [];

    try {
      // Fetch coin data if any non-global metric is requested
      if (needsCoinData) {
        const coinUrl =
          `https://api.coingecko.com/api/v3/coins/${coinId}` +
          `?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true`;
        sourceUrls.push(coinUrl);

        const res = await fetch(coinUrl, {
          headers: { Accept: 'application/json' },
        });

        if (res.status === 429) {
          return formatToolResult(
            { error: 'CoinGecko rate limit exceeded. Please retry in a few seconds.' },
            [],
          );
        }

        if (!res.ok) {
          throw new Error(`CoinGecko returned ${res.status} for coin ID "${coinId}"`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        result.name = data?.name ?? coinId;
        result.symbol = data?.symbol?.toUpperCase() ?? input.ticker.toUpperCase();

        for (const metric of metrics) {
          switch (metric) {
            case 'market':
              result.market = extractMarketMetrics(data);
              break;
            case 'sentiment':
              result.sentiment = extractSentimentMetrics(data);
              break;
            case 'developer':
              result.developer = extractDeveloperMetrics(data);
              break;
            case 'community':
              result.community = extractCommunityMetrics(data);
              break;
          }
        }
      }

      // Fetch global market data
      if (needsGlobal) {
        const globalUrl = 'https://api.coingecko.com/api/v3/global';
        sourceUrls.push(globalUrl);

        const globalRes = await fetch(globalUrl, {
          headers: { Accept: 'application/json' },
        });

        if (globalRes.status === 429) {
          result.global = { error: 'CoinGecko rate limit exceeded for global endpoint.' };
        } else if (!globalRes.ok) {
          result.global = { error: `CoinGecko global endpoint returned ${globalRes.status}` };
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const globalData: any = await globalRes.json();
          result.global = extractGlobalMetrics(globalData);
        }
      }

      return formatToolResult(result, sourceUrls);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return formatToolResult(
        {
          error: `On-chain crypto data unavailable for ${input.ticker}: ${errorMessage}. Try web_search for "${input.ticker} crypto on-chain metrics".`,
          ticker: input.ticker.toUpperCase(),
          coinGeckoId: coinId,
        },
        [],
      );
    }
  },
});
