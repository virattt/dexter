import { describe, expect, it } from 'bun:test';
import { polymarketTool } from './polymarket.js';

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
