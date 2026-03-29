import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import {
  resolveCoinGeckoId,
  TICKER_TO_COINGECKO_ID,
  getOnchainCrypto,
} from './onchain-crypto.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCoinGeckoResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    market_cap_rank: 1,
    coingecko_score: 82.5,
    sentiment_votes_up_percentage: 72.5,
    sentiment_votes_down_percentage: 27.5,
    public_interest_score: 0.054,
    market_data: {
      current_price: { usd: 95000 },
      price_change_percentage_24h: 1.23,
      price_change_percentage_7d: -2.5,
      price_change_percentage_30d: 8.1,
      ath_change_percentage: { usd: -20.5 },
      total_volume: { usd: 35000000000 },
      circulating_supply: 19700000,
      max_supply: 21000000,
    },
    developer_data: {
      forks: 35000,
      stars: 78000,
      total_issues: 8500,
      closed_issues: 7900,
      pull_requests_merged: 12000,
      commit_activity_4_weeks: 150,
    },
    community_data: {
      twitter_followers: 6700000,
      reddit_subscribers: 5800000,
      reddit_average_posts_48h: 120,
      telegram_channel_user_count: null,
    },
    ...overrides,
  };
}

function makeGlobalResponse(): Record<string, unknown> {
  return {
    data: {
      total_market_cap: { usd: 3200000000000 },
      total_volume: { usd: 120000000000 },
      market_cap_percentage: { btc: 52.3, eth: 17.1 },
      market_cap_change_percentage_24h_usd: 1.8,
      active_cryptocurrencies: 13000,
    },
  };
}

// ── mock fetch ────────────────────────────────────────────────────────────────

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ── ticker → CoinGecko ID mapping ─────────────────────────────────────────────

describe('resolveCoinGeckoId', () => {
  it('maps known tickers to correct CoinGecko IDs', () => {
    expect(resolveCoinGeckoId('BTC')).toBe('bitcoin');
    expect(resolveCoinGeckoId('ETH')).toBe('ethereum');
    expect(resolveCoinGeckoId('SOL')).toBe('solana');
    expect(resolveCoinGeckoId('BNB')).toBe('binancecoin');
    expect(resolveCoinGeckoId('XRP')).toBe('ripple');
    expect(resolveCoinGeckoId('ADA')).toBe('cardano');
    expect(resolveCoinGeckoId('DOGE')).toBe('dogecoin');
    expect(resolveCoinGeckoId('AVAX')).toBe('avalanche-2');
    expect(resolveCoinGeckoId('MATIC')).toBe('matic-network');
    expect(resolveCoinGeckoId('LINK')).toBe('chainlink');
  });

  it('is case-insensitive for known tickers', () => {
    expect(resolveCoinGeckoId('btc')).toBe('bitcoin');
    expect(resolveCoinGeckoId('Eth')).toBe('ethereum');
  });

  it('falls back to lowercase for unknown tickers', () => {
    expect(resolveCoinGeckoId('UNKNOWN')).toBe('unknown');
    expect(resolveCoinGeckoId('MYTOKEN')).toBe('mytoken');
  });

  it('trims whitespace from ticker', () => {
    expect(resolveCoinGeckoId(' BTC ')).toBe('bitcoin');
  });

  it('covers all entries in TICKER_TO_COINGECKO_ID map', () => {
    const keys = Object.keys(TICKER_TO_COINGECKO_ID);
    expect(keys.length).toBeGreaterThan(5);
    for (const key of keys) {
      expect(resolveCoinGeckoId(key)).toBe(TICKER_TO_COINGECKO_ID[key]);
    }
  });
});

// ── market metrics parsing ─────────────────────────────────────────────────────

describe('market metrics from CoinGecko response', () => {
  it('parses market metrics correctly', async () => {
    const coinData = makeCoinGeckoResponse();
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(coinData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const result = await getOnchainCrypto.invoke({ ticker: 'BTC', metrics: ['market'] });
    const parsed = JSON.parse(result);
    const market = parsed.data?.market;

    expect(market).toBeDefined();
    expect(market.price_change_24h_pct).toBe(1.23);
    expect(market.price_change_7d_pct).toBe(-2.5);
    expect(market.price_change_30d_pct).toBe(8.1);
    expect(market.market_cap_rank).toBe(1);
    expect(market.ath_change_percentage).toBe(-20.5);
    expect(market.circulating_supply).toBe(19700000);
    expect(market.max_supply).toBe(21000000);
    expect(market.current_price_usd).toBe(95000);
  });

  it('handles null market fields gracefully', async () => {
    const coinData = makeCoinGeckoResponse({
      market_data: {},
      market_cap_rank: null,
    });
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(coinData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const result = await getOnchainCrypto.invoke({ ticker: 'ETH', metrics: ['market'] });
    const parsed = JSON.parse(result);
    expect(parsed.data?.market).toBeDefined();
    expect(parsed.data?.market.market_cap_rank).toBeNull();
  });
});

// ── sentiment metrics ─────────────────────────────────────────────────────────

describe('sentiment metrics from CoinGecko response', () => {
  it('parses sentiment fields', async () => {
    const coinData = makeCoinGeckoResponse();
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(coinData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const result = await getOnchainCrypto.invoke({ ticker: 'BTC', metrics: ['sentiment'] });
    const parsed = JSON.parse(result);
    const sentiment = parsed.data?.sentiment;

    expect(sentiment).toBeDefined();
    expect(sentiment.sentiment_votes_up_percentage).toBe(72.5);
    expect(sentiment.sentiment_votes_down_percentage).toBe(27.5);
    expect(sentiment.coingecko_score).toBe(82.5);
  });
});

// ── developer metrics ─────────────────────────────────────────────────────────

describe('developer metrics from CoinGecko response', () => {
  it('parses developer activity fields', async () => {
    const coinData = makeCoinGeckoResponse();
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(coinData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const result = await getOnchainCrypto.invoke({ ticker: 'BTC', metrics: ['developer'] });
    const parsed = JSON.parse(result);
    const dev = parsed.data?.developer;

    expect(dev).toBeDefined();
    expect(dev.forks).toBe(35000);
    expect(dev.stars).toBe(78000);
    expect(dev.commit_activity_4_weeks).toBe(150);
    expect(dev.pull_requests_merged).toBe(12000);
  });
});

// ── community metrics ─────────────────────────────────────────────────────────

describe('community metrics from CoinGecko response', () => {
  it('parses community fields', async () => {
    const coinData = makeCoinGeckoResponse();
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(coinData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const result = await getOnchainCrypto.invoke({ ticker: 'BTC', metrics: ['community'] });
    const parsed = JSON.parse(result);
    const community = parsed.data?.community;

    expect(community).toBeDefined();
    expect(community.twitter_followers).toBe(6700000);
    expect(community.reddit_subscribers).toBe(5800000);
    expect(community.telegram_channel_user_count).toBeNull();
  });
});

// ── global metrics ────────────────────────────────────────────────────────────

describe('global metrics from CoinGecko', () => {
  it('parses global market metrics', async () => {
    const globalData = makeGlobalResponse();
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/global')) {
        return new Response(JSON.stringify(globalData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(makeCoinGeckoResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const result = await getOnchainCrypto.invoke({ ticker: 'BTC', metrics: ['global'] });
    const parsed = JSON.parse(result);
    const global = parsed.data?.global;

    expect(global).toBeDefined();
    expect(global.btc_dominance).toBe(52.3);
    expect(global.eth_dominance).toBe(17.1);
    expect(global.market_cap_change_24h_pct).toBe(1.8);
    expect(global.active_cryptocurrencies).toBe(13000);
  });
});

// ── rate limit handling ───────────────────────────────────────────────────────

describe('CoinGecko rate limit handling', () => {
  it('returns error string (not throws) on 429 rate limit', async () => {
    globalThis.fetch = mock(async () =>
      new Response('Too Many Requests', { status: 429 }),
    ) as unknown as typeof fetch;

    const result = await getOnchainCrypto.invoke({ ticker: 'BTC', metrics: ['market'] });
    expect(typeof result).toBe('string');
    const parsed = JSON.parse(result);
    expect(parsed.data?.error).toMatch(/rate limit/i);
  });
});

// ── unknown ticker fallback ───────────────────────────────────────────────────

describe('unknown ticker fallback', () => {
  it('uses lowercase ticker as CoinGecko ID for unknown tokens', async () => {
    let calledUrl = '';
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      calledUrl = url.toString();
      return new Response(JSON.stringify(makeCoinGeckoResponse({ id: 'newtoken', symbol: 'nwtkn' })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    await getOnchainCrypto.invoke({ ticker: 'NWTKN', metrics: ['market'] });
    expect(calledUrl).toContain('/coins/nwtkn');
  });

  it('returns error string (not throws) when unknown coin returns 404', async () => {
    globalThis.fetch = mock(async () =>
      new Response('Not Found', { status: 404 }),
    ) as unknown as typeof fetch;

    const result = await getOnchainCrypto.invoke({ ticker: 'FAKECOIN', metrics: ['market'] });
    expect(typeof result).toBe('string');
    const parsed = JSON.parse(result);
    expect(parsed.data?.error).toBeDefined();
  });
});
