import { describe, expect, it } from 'bun:test';
import { polymarketTool, questionMatchesQuery, inferTagSlugs } from './polymarket.js';

// ---------------------------------------------------------------------------
// Unit tests — no network, mock fetch
// ---------------------------------------------------------------------------

const MOCK_MARKET = {
  id: '1',
  question: 'Will the Fed cut rates in 2026?',
  outcomes: '["Yes","No"]',
  outcomePrices: '["0.72","0.28"]',
  endDateIso: '2026-12-31',
  volume24hr: 1_500_000,
  volumeNum: 5_000_000,
  liquidityNum: 800_000,
  active: true,
  closed: false,
};

const MOCK_EVENT = {
  id: 'e1',
  title: 'Fed Rate Decisions 2026',
  volume24hr: 1_500_000,
  markets: [MOCK_MARKET],
};

const SPORTS_MARKET = {
  id: '99',
  question: 'Will the Lakers win the NBA championship?',
  outcomes: '["Yes","No"]',
  outcomePrices: '["0.30","0.70"]',
  endDateIso: '2026-06-30',
  volume24hr: 5_000_000,
  volumeNum: 20_000_000,
  liquidityNum: 2_000_000,
  active: true,
  closed: false,
};

const BITCOIN_MARKET = {
  id: '42',
  question: 'Will Bitcoin price exceed $100K in 2026?',
  outcomes: '["Yes","No"]',
  outcomePrices: '["0.65","0.35"]',
  endDateIso: '2026-12-31',
  volume24hr: 3_000_000,
  volumeNum: 10_000_000,
  liquidityNum: 1_500_000,
  active: true,
  closed: false,
};

function mockFetch(eventData: unknown, marketData: unknown) {
  return async (url: string | URL) => {
    const urlStr = String(url);
    const body = urlStr.includes('/events') ? eventData : marketData;
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  };
}

/** Mock that returns sports for keyword search but Bitcoin market for tag_slug */
function mockFetchWithTagFallback(tagSlug: string, tagData: unknown, keywordData: unknown) {
  return async (url: string | URL) => {
    const urlStr = String(url);
    if (urlStr.includes(`tag_slug=${tagSlug}`)) {
      return { ok: true, status: 200, json: async () => tagData } as Response;
    }
    return { ok: true, status: 200, json: async () => keywordData } as Response;
  };
}

describe('questionMatchesQuery', () => {
  it('returns true when question contains a query word', () => {
    expect(questionMatchesQuery('Will the Fed cut rates in 2026?', 'Fed rate cut')).toBe(true);
  });

  it('returns true when question contains a partial query word (substring match)', () => {
    expect(questionMatchesQuery('Will Bitcoin reach $100K?', 'Bitcoin price')).toBe(true);
  });

  it('returns false for a sports market when querying crypto', () => {
    expect(questionMatchesQuery('Will the Lakers win the NBA championship?', 'Bitcoin price')).toBe(false);
  });

  it('returns false for a sports market when querying Fed rates', () => {
    expect(questionMatchesQuery('Will Team A win the Super Bowl?', 'Fed rate cut')).toBe(false);
  });

  it('returns true for empty query words (no filtering)', () => {
    expect(questionMatchesQuery('Anything goes here', '')).toBe(true);
  });

  it('ignores stop words in query', () => {
    // "the and for" are all stop words, so zero significant words → no filtering
    expect(questionMatchesQuery('Something completely unrelated', 'the and for')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(questionMatchesQuery('Will NVIDIA earnings beat consensus?', 'nvidia earnings')).toBe(true);
  });

  it('filters short query words (< 3 chars)', () => {
    // "AI" = 2 chars, filtered out → no significant words → returns true
    expect(questionMatchesQuery('Sports championship final', 'AI')).toBe(true);
  });

  it('matches "recession" query against recession market', () => {
    expect(questionMatchesQuery('Will the US enter a recession in 2026?', 'US recession')).toBe(true);
  });

  it('does not match "recession" query against sports market', () => {
    expect(questionMatchesQuery('Will the Cowboys win the Super Bowl?', 'US recession')).toBe(false);
  });
});

describe('inferTagSlugs', () => {
  it('returns bitcoin and crypto for bitcoin query', () => {
    const slugs = inferTagSlugs('Bitcoin price');
    expect(slugs).toContain('bitcoin');
    expect(slugs).toContain('crypto');
  });

  it('returns crypto slugs for eth query', () => {
    const slugs = inferTagSlugs('ethereum price prediction');
    expect(slugs).toContain('crypto');
  });

  it('returns economics for Fed/FOMC query', () => {
    const slugs = inferTagSlugs('Fed rate cut');
    expect(slugs).toContain('economics');
  });

  it('returns economics for recession query', () => {
    const slugs = inferTagSlugs('US recession 2026');
    expect(slugs).toContain('economics');
  });

  it('returns politics slugs for election query', () => {
    const slugs = inferTagSlugs('US presidential election');
    expect(slugs).toContain('politics');
  });

  it('returns technology for NVIDIA query', () => {
    const slugs = inferTagSlugs('NVIDIA earnings');
    expect(slugs.some(s => ['technology', 'business'].includes(s))).toBe(true);
  });

  it('returns empty array for unrecognized query', () => {
    expect(inferTagSlugs('completely random unknown topic')).toEqual([]);
  });

  it('is case-insensitive for BTC', () => {
    expect(inferTagSlugs('BTC halving')).toContain('bitcoin');
  });
});

describe('polymarketTool', () => {
  it('tool name is polymarket_search', () => {
    expect(polymarketTool.name).toBe('polymarket_search');
  });

  it('formats YES/NO probabilities as percentages', async () => {
    globalThis.fetch = mockFetch([MOCK_EVENT], [MOCK_MARKET]) as typeof fetch;
    const result = await polymarketTool.invoke({ query: 'Fed rate cut', limit: 5 });
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    expect(text).toContain('72.0%');
    expect(text).toContain('28.0%');
    expect(text).toContain('Will the Fed cut rates in 2026?');
  });

  it('includes volume and liquidity metadata', async () => {
    globalThis.fetch = mockFetch([MOCK_EVENT], [MOCK_MARKET]) as typeof fetch;
    const result = await polymarketTool.invoke({ query: 'Fed rate cut', limit: 5 });
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    expect(text).toContain('$1.5M');  // 24h volume
    expect(text).toContain('2026-12-31'); // end date
  });

  it('deduplicates markets appearing in both events and direct search', async () => {
    globalThis.fetch = mockFetch([MOCK_EVENT], [MOCK_MARKET]) as typeof fetch;
    const result = await polymarketTool.invoke({ query: 'Fed rate cut', limit: 10 });
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    // Question should appear exactly once
    const occurrences = (text.match(/Will the Fed cut rates in 2026\?/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('filters out sports markets when querying financial topics', async () => {
    // Simulate keyword search returning sports (API ignores keyword)
    globalThis.fetch = mockFetch([], [SPORTS_MARKET]) as typeof fetch;
    const result = await polymarketTool.invoke({ query: 'Bitcoin price', limit: 5 });
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    expect(text).not.toContain('Lakers');
    expect(text).not.toContain('NBA');
  });

  it('uses tag-slug fallback when keyword search returns no relevant results', async () => {
    // keyword search → returns sports (irrelevant, filtered out)
    // tag_slug=bitcoin → returns Bitcoin market (relevant)
    globalThis.fetch = mockFetchWithTagFallback(
      'bitcoin',
      [BITCOIN_MARKET],  // tag-based result
      [SPORTS_MARKET],   // keyword result (filtered out by text filter)
    ) as typeof fetch;
    const result = await polymarketTool.invoke({ query: 'Bitcoin price', limit: 5 });
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    expect(text).toContain('Bitcoin');
    expect(text).not.toContain('Lakers');
  });

  it('returns a no-results message when both endpoints return empty', async () => {
    globalThis.fetch = mockFetch([], []) as typeof fetch;
    const result = await polymarketTool.invoke({ query: 'nonexistent query xyz', limit: 5 });
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    expect(text).toContain('No active Polymarket prediction markets found');
  });

  it('handles API error gracefully without throwing', async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
    const result = await polymarketTool.invoke({ query: 'test', limit: 3 });
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    // Promise.allSettled means a 503 degrades to "no results" rather than crashing
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('TypeError');
    // Either "no results" or error message — both are acceptable graceful responses
    const graceful = text.includes('No active Polymarket') || text.includes('Polymarket search failed');
    expect(graceful).toBe(true);
  });

  it('handles network failure gracefully without throwing', async () => {
    globalThis.fetch = (async () => { throw new Error('Network error'); }) as unknown as typeof fetch;
    const result = await polymarketTool.invoke({ query: 'test', limit: 3 });
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    const graceful = text.includes('No active Polymarket') || text.includes('Polymarket search failed');
    expect(graceful).toBe(true);
  });

  it('skips closed markets', async () => {
    const closedEvent = {
      ...MOCK_EVENT,
      markets: [{ ...MOCK_MARKET, closed: true }],
    };
    globalThis.fetch = mockFetch([closedEvent], []) as typeof fetch;
    const result = await polymarketTool.invoke({ query: 'Fed rate cut', limit: 5 });
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    expect(text).toContain('No active Polymarket prediction markets found');
  });
});

describe('inferTagSlugs — commodity coverage (regression)', () => {
  it('maps gold to commodities', () => {
    expect(inferTagSlugs('gold price')).toContain('commodities');
  });
  it('maps silver to commodities', () => {
    expect(inferTagSlugs('silver forecast')).toContain('commodities');
  });
  it('maps copper to commodities', () => {
    expect(inferTagSlugs('copper demand')).toContain('commodities');
  });
  it('maps natural gas to commodities', () => {
    expect(inferTagSlugs('natural gas price')).toContain('commodities');
  });
  it('maps wheat to commodities', () => {
    expect(inferTagSlugs('wheat supply chain')).toContain('commodities');
  });
});
