import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';

// Module-level mock state for WatchlistController
let mockWatchlistEntries: Array<{ ticker: string }> = [];
let mockWatchlistShouldThrow = false;

mock.module('../../controllers/watchlist-controller.js', () => ({
  WatchlistController: class {
    list() {
      if (mockWatchlistShouldThrow) {
        throw new Error('Watchlist read failed');
      }
      return mockWatchlistEntries;
    }
  },
}));

const { portfolioRiskTool } = await import('./portfolio-risk.js');
const { api } = await import('./api.js');

/** Generate N monotonically increasing close prices */
function makePrices(n: number, start = 100): number[] {
  return Array.from({ length: n }, (_, i) => start + i * 0.5);
}

let apiSpy: ReturnType<typeof spyOn<typeof api, 'get'>>;
let originalApiKey: string | undefined;

beforeEach(() => {
  mockWatchlistEntries = [];
  mockWatchlistShouldThrow = false;
  originalApiKey = process.env.FINANCIAL_DATASETS_API_KEY;
  process.env.FINANCIAL_DATASETS_API_KEY = 'test-key';
  apiSpy = spyOn(api, 'get').mockResolvedValue({
    data: { prices: makePrices(30).map((close) => ({ close })) },
    url: 'https://api.test/prices/',
  });
});

afterEach(() => {
  apiSpy.mockRestore();
  if (originalApiKey === undefined) {
    delete process.env.FINANCIAL_DATASETS_API_KEY;
  } else {
    process.env.FINANCIAL_DATASETS_API_KEY = originalApiKey;
  }
});

describe('portfolioRiskTool', () => {
  test('returns error when FINANCIAL_DATASETS_API_KEY is not set', async () => {
    delete process.env.FINANCIAL_DATASETS_API_KEY;
    const result = await portfolioRiskTool.invoke({ tickers: ['AAPL'] });
    const parsed = JSON.parse(result);
    expect(parsed.data.error).toBeDefined();
    expect(parsed.data.error.toLowerCase()).toContain('api_key');
  });

  test('returns risk report for explicit tickers', async () => {
    const result = await portfolioRiskTool.invoke({ tickers: ['AAPL', 'MSFT'] });
    const parsed = JSON.parse(result);
    expect(parsed.data).toBeDefined();
    expect(parsed.data.error).toBeUndefined();
  });

  test('reads tickers from watchlist when none provided', async () => {
    mockWatchlistEntries = [{ ticker: 'AAPL' }, { ticker: 'TSLA' }];
    const result = await portfolioRiskTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.data).toBeDefined();
    expect(parsed.data.error).toBeUndefined();
  });

  test('returns error when no tickers provided and watchlist is empty', async () => {
    mockWatchlistEntries = [];
    const result = await portfolioRiskTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.data.error).toBeDefined();
  });

  test('gracefully handles watchlist read failure and falls through to empty list', async () => {
    mockWatchlistShouldThrow = true;
    const result = await portfolioRiskTool.invoke({});
    const parsed = JSON.parse(result);
    // Falls through to empty-list error (watchlist unreadable = treated as empty)
    expect(parsed.data.error).toBeDefined();
  });

  test('returns warning for ticker with insufficient price history', async () => {
    // Return fewer than 20 prices for TINY
    apiSpy.mockImplementation(async (url, params) => {
      const ticker = (params as Record<string, string>).ticker;
      if (ticker === 'TINY') {
        return { data: { prices: makePrices(5).map((c) => ({ close: c })) }, url: 'https://api.test/' };
      }
      return { data: { prices: makePrices(30).map((c) => ({ close: c })) }, url: 'https://api.test/' };
    });

    const result = await portfolioRiskTool.invoke({ tickers: ['TINY', 'AAPL'] });
    const parsed = JSON.parse(result);
    // TINY should produce a warning; AAPL should be in the report
    const warnings = parsed.data.warnings as string[] | undefined;
    expect(warnings?.some((w: string) => w.includes('TINY'))).toBe(true);
  });

  test('returns error when all tickers fail price fetch', async () => {
    apiSpy.mockRejectedValue(new Error('API down'));
    const result = await portfolioRiskTool.invoke({ tickers: ['AAPL', 'MSFT'] });
    const parsed = JSON.parse(result);
    expect(parsed.data.error).toBeDefined();
  });

  test('includes source URLs from price API calls', async () => {
    apiSpy.mockResolvedValue({
      data: { prices: makePrices(30).map((c) => ({ close: c })) },
      url: 'https://api.test/prices/AAPL',
    });
    const result = await portfolioRiskTool.invoke({ tickers: ['AAPL'] });
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed.sourceUrls)).toBe(true);
    expect(parsed.sourceUrls.length).toBeGreaterThan(0);
  });
});
