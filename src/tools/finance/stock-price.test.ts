import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock ../search/tavily.js BEFORE importing stock-price.js
// ---------------------------------------------------------------------------

const mockTavilyInvoke = mock(async (_input: unknown): Promise<string> =>
  JSON.stringify({ data: { result: 'AAPL current price $185' }, sourceUrls: [] }),
);
mock.module('../search/tavily.js', () => ({
  tavilySearch: { invoke: mockTavilyInvoke, name: 'web_search' },
}));

import { api } from './api.js';
import { getStockPrice, getStockPrices, getStockTickers } from './stock-price.js';

function parseResult(raw: unknown): { data: unknown; sourceUrls?: string[] } {
  return JSON.parse(raw as string);
}

const MOCK_SNAPSHOT = {
  ticker: 'AAPL',
  price: 185.50,
  open: 184.00,
  high: 187.20,
  low: 183.50,
  close: 185.50,
  volume: 55_000_000,
  market_cap: 2_800_000_000_000,
};

describe('getStockPrice', () => {
  beforeEach(() => {
    mockTavilyInvoke.mockClear();
    delete process.env.TAVILY_API_KEY;
  });

  test('tool name is get_stock_price', () => {
    expect(getStockPrice.name).toBe('get_stock_price');
  });

  test('returns snapshot from API', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: MOCK_SNAPSHOT },
      url: 'https://api.financialdatasets.ai/prices/snapshot/',
    });
    const result = await getStockPrice.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect((parsed.data as typeof MOCK_SNAPSHOT).price).toBe(185.50);
    expect((parsed.data as typeof MOCK_SNAPSHOT).market_cap).toBe(2_800_000_000_000);
  });

  test('normalizes ticker to uppercase', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: MOCK_SNAPSHOT },
      url: 'https://api.financialdatasets.ai/prices/snapshot/',
    });
    await getStockPrice.invoke({ ticker: 'aapl' });
    expect(spy).toHaveBeenCalledWith('/prices/snapshot/', { ticker: 'AAPL' });
  });

  test('returns empty object when snapshot is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/prices/snapshot/',
    });
    const result = await getStockPrice.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual({});
  });

  test('falls back to Tavily when API throws and TAVILY_API_KEY is set', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key';
    spyOn(api, 'get').mockRejectedValue(new Error('API unavailable'));
    mockTavilyInvoke.mockResolvedValueOnce(
      JSON.stringify({ data: { result: 'AAPL: $185.50' }, sourceUrls: [] }),
    );

    const result = await getStockPrice.invoke({ ticker: 'AAPL' });
    expect(mockTavilyInvoke).toHaveBeenCalled();
    // Tavily result is returned as-is
    expect(result).toBeDefined();
  });

  test('returns structured error when API throws and no Tavily key', async () => {
    delete process.env.TAVILY_API_KEY;
    spyOn(api, 'get').mockRejectedValue(new Error('API unavailable'));

    const result = await getStockPrice.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect((parsed.data as { error: string }).error).toContain('AAPL');
    expect(mockTavilyInvoke).not.toHaveBeenCalled();
  });

  test('returns structured error when API and Tavily both fail', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key';
    spyOn(api, 'get').mockRejectedValue(new Error('API unavailable'));
    mockTavilyInvoke.mockRejectedValueOnce(new Error('Tavily unavailable'));

    const result = await getStockPrice.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect((parsed.data as { error: string }).error).toContain('AAPL');
  });
});

describe('getStockPrices', () => {
  test('tool name is get_stock_prices', () => {
    expect(getStockPrices.name).toBe('get_stock_prices');
  });

  test('returns price array from API', async () => {
    const prices = [
      { date: '2025-01-01', open: 180, close: 185 },
      { date: '2025-01-02', open: 185, close: 188 },
    ];
    spyOn(api, 'get').mockResolvedValue({
      data: { prices },
      url: 'https://api.financialdatasets.ai/prices/',
    });
    const result = await getStockPrices.invoke({
      ticker: 'AAPL',
      interval: 'day',
      start_date: '2025-01-01',
      end_date: '2025-01-31',
    });
    const parsed = parseResult(result);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect((parsed.data as typeof prices).length).toBe(2);
  });

  test('returns empty array when prices is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/prices/',
    });
    const result = await getStockPrices.invoke({
      ticker: 'AAPL',
      interval: 'day',
      start_date: '2025-01-01',
      end_date: '2025-01-31',
    });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual([]);
  });

  test('passes cacheable=true for fully closed past date range', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { prices: [] },
      url: 'https://api.financialdatasets.ai/prices/',
    });
    spy.mockClear();
    await getStockPrices.invoke({
      ticker: 'AAPL',
      interval: 'day',
      start_date: '2020-01-01',
      end_date: '2020-12-31',
    });
    const opts = spy.mock.calls[0][2] as { cacheable: boolean } | undefined;
    expect(opts?.cacheable).toBe(true);
  });
});

describe('getStockTickers', () => {
  test('tool name is get_available_stock_tickers', () => {
    expect(getStockTickers.name).toBe('get_available_stock_tickers');
  });

  test('returns tickers array', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { tickers: ['AAPL', 'MSFT', 'GOOGL'] },
      url: 'https://api.financialdatasets.ai/prices/snapshot/tickers/',
    });
    const result = await getStockTickers.invoke({});
    const parsed = parseResult(result);
    expect(parsed.data).toEqual(['AAPL', 'MSFT', 'GOOGL']);
  });

  test('returns empty array when tickers is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/prices/snapshot/tickers/',
    });
    const result = await getStockTickers.invoke({});
    const parsed = parseResult(result);
    expect(parsed.data).toEqual([]);
  });
});
