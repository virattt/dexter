import { describe, test, expect, mock, beforeEach, spyOn } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock ./yahoo-finance.js before importing modules under test.
// We mock at the tool level rather than the yahoo-finance2 library level so
// that estimates.ts gets consistent mocks regardless of module-cache state.
// ---------------------------------------------------------------------------

const mockYahooInvoke = mock(async (_input: unknown): Promise<string> => '{}');

mock.module('./yahoo-finance.js', () => ({
  getYahooAnalystTargets: {
    invoke: mockYahooInvoke,
    name: 'get_yahoo_analyst_targets',
  },
  getYahooAnalystRecommendations: {
    invoke: mock(async () => '{}'),
    name: 'get_yahoo_analyst_recommendations',
  },
  getYahooUpgradeDowngradeHistory: {
    invoke: mock(async () => '{}'),
    name: 'get_yahoo_upgrade_downgrade_history',
  },
}));

// ---------------------------------------------------------------------------
// Import after mocking
// ---------------------------------------------------------------------------
import { api } from './api.js';
const { getAnalystEstimates } = await import('./estimates.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResult(raw: unknown): { data: unknown; sourceUrls?: string[] } {
  return JSON.parse(raw as string);
}

const FD_ESTIMATES_STUB = [
  { period: '2025', estimatedEps: 7.5, estimatedRevenue: 400_000_000_000 },
  { period: '2026', estimatedEps: 8.2, estimatedRevenue: 430_000_000_000 },
];

const FD_TARGETS_STUB = {
  targetHighPrice: 350,
  targetLowPrice: 180,
  targetMeanPrice: 250,
  targetMedianPrice: 245,
  recommendationMean: 2.1,
  recommendationKey: 'buy',
  numberOfAnalystOpinions: 42,
};

// Formatted string that getYahooAnalystTargets.invoke resolves to
const yahooTargetsResult = (ticker: string) =>
  JSON.stringify({
    data: FD_TARGETS_STUB,
    sourceUrls: [`https://finance.yahoo.com/quote/${ticker}/analysis`],
  });

// ---------------------------------------------------------------------------
// Primary path — financialdatasets.ai returns data
// ---------------------------------------------------------------------------

describe('getAnalystEstimates — primary path (financialdatasets.ai)', () => {
  let apiGetSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockYahooInvoke.mockReset();
    apiGetSpy = spyOn(api, 'get').mockResolvedValue({
      data: { analyst_estimates: FD_ESTIMATES_STUB },
      url: 'https://api.financialdatasets.ai/analyst-estimates/?ticker=AAPL',
    });
  });

  test('returns financialdatasets.ai data when it is non-empty', async () => {
    const raw = await getAnalystEstimates.invoke({ ticker: 'AAPL', period: 'annual' });
    const result = parseResult(raw);

    expect(result.data).toEqual(FD_ESTIMATES_STUB);
    expect(result.sourceUrls?.[0]).toContain('financialdatasets');
  });

  test('does NOT call Yahoo Finance when financialdatasets.ai returns data', async () => {
    await getAnalystEstimates.invoke({ ticker: 'AAPL', period: 'annual' });
    expect(mockYahooInvoke).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Fallback path — financialdatasets.ai returns empty array
// ---------------------------------------------------------------------------

describe('getAnalystEstimates — fallback on empty array', () => {
  let apiGetSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockYahooInvoke.mockReset();
    apiGetSpy = spyOn(api, 'get').mockResolvedValue({
      data: { analyst_estimates: [] },
      url: 'https://api.financialdatasets.ai/analyst-estimates/?ticker=VWS.CO',
    });
  });

  test('calls Yahoo Finance when financialdatasets.ai returns empty array', async () => {
    mockYahooInvoke.mockResolvedValueOnce(yahooTargetsResult('VWS.CO'));

    await getAnalystEstimates.invoke({ ticker: 'VWS.CO', period: 'annual' });

    expect(mockYahooInvoke).toHaveBeenCalledTimes(1);
    const [calledInput] = mockYahooInvoke.mock.calls[0] as [{ ticker: string }];
    expect(calledInput.ticker).toBe('VWS.CO');
  });

  test('returns Yahoo Finance data when primary is empty', async () => {
    mockYahooInvoke.mockResolvedValueOnce(yahooTargetsResult('VWS.CO'));

    const raw = await getAnalystEstimates.invoke({ ticker: 'VWS.CO', period: 'annual' });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).recommendationKey).toBe('buy');
    expect((result.data as Record<string, unknown>).targetMeanPrice).toBe(250);
  });

  test('sourceUrls contain Yahoo Finance URL when falling back', async () => {
    mockYahooInvoke.mockResolvedValueOnce(yahooTargetsResult('VWS.CO'));

    const raw = await getAnalystEstimates.invoke({ ticker: 'VWS.CO', period: 'annual' });
    const result = parseResult(raw);

    expect(result.sourceUrls?.some(u => u.includes('yahoo'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fallback path — financialdatasets.ai throws
// ---------------------------------------------------------------------------

describe('getAnalystEstimates — fallback on API error', () => {
  let apiGetSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockYahooInvoke.mockReset();
    apiGetSpy = spyOn(api, 'get').mockRejectedValue(
      new Error('[Financial Datasets API] request failed: 404 Not Found'),
    );
  });

  test('calls Yahoo Finance when api.get throws', async () => {
    mockYahooInvoke.mockResolvedValueOnce(yahooTargetsResult('VWS.CO'));

    await getAnalystEstimates.invoke({ ticker: 'VWS.CO', period: 'annual' });

    expect(mockYahooInvoke).toHaveBeenCalledTimes(1);
  });

  test('returns Yahoo Finance data when api.get throws', async () => {
    mockYahooInvoke.mockResolvedValueOnce(yahooTargetsResult('VWS.CO'));

    const raw = await getAnalystEstimates.invoke({ ticker: 'VWS.CO', period: 'annual' });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).targetMeanPrice).toBe(250);
  });

  test('returns error when both sources fail', async () => {
    mockYahooInvoke.mockRejectedValueOnce(new Error('Yahoo also failed'));

    const raw = await getAnalystEstimates.invoke({ ticker: 'INVALID', period: 'annual' });
    const result = parseResult(raw);

    // Should return some data (even if it's an error object from Yahoo), not throw
    expect(result.data).toBeDefined();
  });
});
