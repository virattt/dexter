import { describe, test, expect, mock, spyOn, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock ../search/tavily.js BEFORE importing key-ratios.js
// ---------------------------------------------------------------------------

const mockTavilyInvoke = mock(async (_input: unknown): Promise<string> =>
  JSON.stringify({ data: { result: 'AAPL P/E: 28x' }, sourceUrls: [] }),
);
mock.module('../search/tavily.js', () => ({
  tavilySearch: { invoke: mockTavilyInvoke, name: 'web_search' },
}));

import { api } from './api.js';
import { getKeyRatios, getHistoricalKeyRatios } from './key-ratios.js';

function parseResult(raw: unknown): { data: unknown; sourceUrls?: string[] } {
  return JSON.parse(raw as string);
}

const MOCK_SNAPSHOT = {
  ticker: 'AAPL',
  pe_ratio: 28.5,
  price_to_book: 45.2,
  ev_to_ebitda: 22.1,
  gross_profit_margin: 0.464,
  return_on_equity: 1.72,
  debt_to_equity: 1.87,
};

const MOCK_HISTORICAL = [
  { report_period: '2024-09-30', pe_ratio: 28.5, ev_to_ebitda: 22.1 },
  { report_period: '2024-06-30', pe_ratio: 31.2, ev_to_ebitda: 24.5 },
];

describe('getKeyRatios', () => {
  beforeEach(() => {
    mockTavilyInvoke.mockClear();
    delete process.env.TAVILY_API_KEY;
  });

  test('tool name is get_key_ratios', () => {
    expect(getKeyRatios.name).toBe('get_key_ratios');
  });

  test('returns snapshot data from API', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: MOCK_SNAPSHOT },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await getKeyRatios.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect((parsed.data as typeof MOCK_SNAPSHOT).pe_ratio).toBe(28.5);
    expect((parsed.data as typeof MOCK_SNAPSHOT).return_on_equity).toBe(1.72);
  });

  test('normalizes ticker to uppercase', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: MOCK_SNAPSHOT },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    await getKeyRatios.invoke({ ticker: 'aapl' });
    expect(spy).toHaveBeenCalledWith('/financial-metrics/snapshot/', { ticker: 'AAPL' });
  });

  test('returns empty object when snapshot is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await getKeyRatios.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual({});
  });

  test('falls back to Tavily when API throws and TAVILY_API_KEY is set', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key';
    spyOn(api, 'get').mockRejectedValue(new Error('402 Forbidden'));
    mockTavilyInvoke.mockResolvedValueOnce(
      JSON.stringify({ data: { result: 'AAPL P/E: 28x, EV/EBITDA: 22x' }, sourceUrls: [] }),
    );

    const result = await getKeyRatios.invoke({ ticker: 'AAPL' });
    expect(mockTavilyInvoke).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  test('returns structured error when API throws and no Tavily key', async () => {
    delete process.env.TAVILY_API_KEY;
    spyOn(api, 'get').mockRejectedValue(new Error('API unavailable'));

    const result = await getKeyRatios.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect((parsed.data as { error: string }).error).toContain('AAPL');
    expect(mockTavilyInvoke).not.toHaveBeenCalled();
  });

  test('returns structured error when API and Tavily both fail', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key';
    spyOn(api, 'get').mockRejectedValue(new Error('API unavailable'));
    mockTavilyInvoke.mockRejectedValueOnce(new Error('Tavily unavailable'));

    const result = await getKeyRatios.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect((parsed.data as { error: string }).error).toContain('AAPL');
  });
});

describe('getHistoricalKeyRatios', () => {
  beforeEach(() => {
    mockTavilyInvoke.mockClear();
    delete process.env.TAVILY_API_KEY;
  });

  test('tool name is get_historical_key_ratios', () => {
    expect(getHistoricalKeyRatios.name).toBe('get_historical_key_ratios');
  });

  test('returns historical metrics and strips redundant fields', async () => {
    const withRedundant = MOCK_HISTORICAL.map((r) => ({
      ...r,
      accession_number: '0000320193-24-000123',
      currency: 'USD',
      period: 'annual',
    }));
    spyOn(api, 'get').mockResolvedValue({
      data: { financial_metrics: withRedundant },
      url: 'https://api.financialdatasets.ai/financial-metrics/',
    });
    const result = await getHistoricalKeyRatios.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result) as { data: Record<string, unknown>[] };
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data[0].pe_ratio).toBe(28.5);
    // Redundant fields stripped
    expect(parsed.data[0].accession_number).toBeUndefined();
    expect(parsed.data[0].currency).toBeUndefined();
  });

  test('returns empty array when financial_metrics is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/financial-metrics/',
    });
    const result = await getHistoricalKeyRatios.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual([]);
  });

  test('passes optional date filter params to API', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { financial_metrics: [] },
      url: 'https://api.financialdatasets.ai/financial-metrics/',
    });
    spy.mockClear();
    await getHistoricalKeyRatios.invoke({
      ticker: 'AAPL',
      period: 'annual',
      report_period_gte: '2023-01-01',
      report_period_lte: '2024-12-31',
    });
    const params = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(params.report_period_gte).toBe('2023-01-01');
    expect(params.report_period_lte).toBe('2024-12-31');
  });

  test('falls back to Tavily when API throws and TAVILY_API_KEY is set', async () => {
    process.env.TAVILY_API_KEY = 'test-tavily-key';
    spyOn(api, 'get').mockRejectedValue(new Error('402'));
    mockTavilyInvoke.mockResolvedValueOnce(
      JSON.stringify({ data: { result: 'AAPL historical P/E 2022-2024' }, sourceUrls: [] }),
    );
    await getHistoricalKeyRatios.invoke({ ticker: 'AAPL' });
    expect(mockTavilyInvoke).toHaveBeenCalled();
  });

  test('returns structured error when API throws and no Tavily key', async () => {
    delete process.env.TAVILY_API_KEY;
    spyOn(api, 'get').mockRejectedValue(new Error('API unavailable'));

    const result = await getHistoricalKeyRatios.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect((parsed.data as { error: string }).error).toContain('AAPL');
  });
});
