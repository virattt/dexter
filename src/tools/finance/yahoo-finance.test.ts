import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { makeYahooTools } from './yahoo-finance.js';

// ---------------------------------------------------------------------------
// Use factory-based dependency injection — no module-level mocking needed.
// Each test suite gets its own tool instances backed by mockQuoteSummary so
// tests remain isolated regardless of module-cache order in parallel runs.
// ---------------------------------------------------------------------------

const mockQuoteSummary = mock(async (_ticker: string, _opts: unknown) => ({}));
const { getYahooAnalystTargets, getYahooAnalystRecommendations, getYahooUpgradeDowngradeHistory, getYahooIncomeStatements } =
  makeYahooTools(mockQuoteSummary as Parameters<typeof makeYahooTools>[0]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResult(raw: unknown): { data: unknown; sourceUrls?: string[] } {
  return JSON.parse(raw as string);
}

const FINANCIAL_DATA_STUB = {
  targetHighPrice: 350,
  targetLowPrice: 180,
  targetMeanPrice: 250,
  targetMedianPrice: 245,
  recommendationMean: 2.1,
  recommendationKey: 'buy',
  numberOfAnalystOpinions: 42,
};

const TREND_STUB = [
  { period: '0m', strongBuy: 6, buy: 25, hold: 15, sell: 1, strongSell: 0 },
  { period: '-1m', strongBuy: 5, buy: 24, hold: 16, sell: 1, strongSell: 0 },
];

const HISTORY_STUB = [
  {
    epochGradeDate: '2026-03-23T00:00:00.000Z',
    firm: 'Morgan Stanley',
    toGrade: 'Overweight',
    fromGrade: 'Overweight',
    action: 'reit',
  },
];

// ---------------------------------------------------------------------------
// getYahooAnalystTargets
// ---------------------------------------------------------------------------

describe('getYahooAnalystTargets', () => {
  beforeEach(() => mockQuoteSummary.mockReset());

  test('returns formatted price targets for a US ticker', async () => {
    mockQuoteSummary.mockResolvedValueOnce({ financialData: FINANCIAL_DATA_STUB });

    const raw = await getYahooAnalystTargets.invoke({ ticker: 'AAPL' });
    const result = parseResult(raw);

    expect(result.data).toMatchObject({
      targetHighPrice: 350,
      targetLowPrice: 180,
      targetMeanPrice: 250,
      recommendationKey: 'buy',
      numberOfAnalystOpinions: 42,
    });
    expect(result.sourceUrls).toEqual(
      expect.arrayContaining([expect.stringContaining('AAPL')]),
    );
  });

  test('passes international ticker through unchanged (VWS.CO)', async () => {
    mockQuoteSummary.mockResolvedValueOnce({ financialData: FINANCIAL_DATA_STUB });

    await getYahooAnalystTargets.invoke({ ticker: 'VWS.CO' });

    const [calledTicker] = mockQuoteSummary.mock.calls[0] as [string, unknown];
    expect(calledTicker).toBe('VWS.CO');
  });

  test('requests the financialData module', async () => {
    mockQuoteSummary.mockResolvedValueOnce({ financialData: FINANCIAL_DATA_STUB });

    await getYahooAnalystTargets.invoke({ ticker: 'AAPL' });

    const [, opts] = mockQuoteSummary.mock.calls[0] as [string, { modules: string[] }];
    expect(opts.modules).toContain('financialData');
  });

  test('returns error object when quoteSummary throws', async () => {
    mockQuoteSummary.mockRejectedValueOnce(new Error('Network error'));

    const raw = await getYahooAnalystTargets.invoke({ ticker: 'AAPL' });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toBeDefined();
    expect((result.data as Record<string, unknown>).error).toContain('Network error');
  });

  test('returns error object when financialData is missing from response', async () => {
    mockQuoteSummary.mockResolvedValueOnce({});

    const raw = await getYahooAnalystTargets.invoke({ ticker: 'AAPL' });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getYahooAnalystRecommendations
// ---------------------------------------------------------------------------

describe('getYahooAnalystRecommendations', () => {
  beforeEach(() => mockQuoteSummary.mockReset());

  test('returns recommendation trend array', async () => {
    mockQuoteSummary.mockResolvedValueOnce({ recommendationTrend: { trend: TREND_STUB } });

    const raw = await getYahooAnalystRecommendations.invoke({ ticker: 'AAPL' });
    const result = parseResult(raw);

    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as unknown[]).length).toBe(2);
    expect((result.data as typeof TREND_STUB)[0]).toMatchObject({
      period: '0m',
      strongBuy: 6,
      buy: 25,
    });
  });

  test('requests the recommendationTrend module', async () => {
    mockQuoteSummary.mockResolvedValueOnce({ recommendationTrend: { trend: TREND_STUB } });

    await getYahooAnalystRecommendations.invoke({ ticker: 'AAPL' });

    const [, opts] = mockQuoteSummary.mock.calls[0] as [string, { modules: string[] }];
    expect(opts.modules).toContain('recommendationTrend');
  });

  test('returns error object when quoteSummary throws', async () => {
    mockQuoteSummary.mockRejectedValueOnce(new Error('Timeout'));

    const raw = await getYahooAnalystRecommendations.invoke({ ticker: 'NVDA' });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getYahooUpgradeDowngradeHistory
// ---------------------------------------------------------------------------

describe('getYahooUpgradeDowngradeHistory', () => {
  beforeEach(() => mockQuoteSummary.mockReset());

  test('returns upgrade/downgrade history array', async () => {
    mockQuoteSummary.mockResolvedValueOnce({
      upgradeDowngradeHistory: { history: HISTORY_STUB },
    });

    const raw = await getYahooUpgradeDowngradeHistory.invoke({ ticker: 'AAPL' });
    const result = parseResult(raw);

    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as typeof HISTORY_STUB)[0]).toMatchObject({
      firm: 'Morgan Stanley',
      toGrade: 'Overweight',
      action: 'reit',
    });
  });

  test('requests the upgradeDowngradeHistory module', async () => {
    mockQuoteSummary.mockResolvedValueOnce({
      upgradeDowngradeHistory: { history: HISTORY_STUB },
    });

    await getYahooUpgradeDowngradeHistory.invoke({ ticker: 'AAPL' });

    const [, opts] = mockQuoteSummary.mock.calls[0] as [string, { modules: string[] }];
    expect(opts.modules).toContain('upgradeDowngradeHistory');
  });

  test('returns error object when quoteSummary throws', async () => {
    mockQuoteSummary.mockRejectedValueOnce(new Error('Rate limited'));

    const raw = await getYahooUpgradeDowngradeHistory.invoke({ ticker: 'TSLA' });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getYahooIncomeStatements
// ---------------------------------------------------------------------------

const INCOME_HISTORY_STUB = {
  incomeStatementHistory: [
    {
      endDate: new Date('2024-12-31'),
      totalRevenue: 17_295_000_000,
      grossProfit: 2_000_000_000,
      operatingIncome: 800_000_000,
      netIncome: 499_000_000,
      ebit: 900_000_000,
    },
    {
      endDate: new Date('2023-12-31'),
      totalRevenue: 15_382_000_000,
      grossProfit: null,
      operatingIncome: null,
      netIncome: 77_000_000,
      ebit: null,
    },
  ],
};

describe('getYahooIncomeStatements', () => {
  beforeEach(() => mockQuoteSummary.mockReset());

  test('returns totalRevenue and netIncome for a valid ticker', async () => {
    mockQuoteSummary.mockResolvedValueOnce({ incomeStatementHistory: INCOME_HISTORY_STUB });

    const raw = await getYahooIncomeStatements.invoke({ ticker: 'VWS.CO', limit: 4 });
    const result = parseResult(raw);

    expect(Array.isArray(result.data)).toBe(true);
    const first = (result.data as Record<string, unknown>[])[0];
    expect(first.totalRevenue).toBe(17_295_000_000);
    expect(first.netIncome).toBe(499_000_000);
  });

  test('requests the incomeStatementHistory module', async () => {
    mockQuoteSummary.mockResolvedValueOnce({ incomeStatementHistory: INCOME_HISTORY_STUB });

    await getYahooIncomeStatements.invoke({ ticker: 'VWS.CO', limit: 4 });

    const [, opts] = mockQuoteSummary.mock.calls[0] as [string, { modules: string[] }];
    expect(opts.modules).toContain('incomeStatementHistory');
  });

  test('passes international ticker unchanged (VWS.CO)', async () => {
    mockQuoteSummary.mockResolvedValueOnce({ incomeStatementHistory: INCOME_HISTORY_STUB });

    await getYahooIncomeStatements.invoke({ ticker: 'VWS.CO', limit: 4 });

    const [calledTicker] = mockQuoteSummary.mock.calls[0] as [string, unknown];
    expect(calledTicker).toBe('VWS.CO');
  });

  test('sourceUrls contain finance.yahoo.com/quote/{ticker}/financials', async () => {
    mockQuoteSummary.mockResolvedValueOnce({ incomeStatementHistory: INCOME_HISTORY_STUB });

    const raw = await getYahooIncomeStatements.invoke({ ticker: 'VWS.CO', limit: 4 });
    const result = parseResult(raw);

    expect(result.sourceUrls?.some((u) => u.includes('VWS.CO') && u.includes('financials'))).toBe(true);
  });

  test('respects limit parameter', async () => {
    mockQuoteSummary.mockResolvedValueOnce({ incomeStatementHistory: INCOME_HISTORY_STUB });

    const raw = await getYahooIncomeStatements.invoke({ ticker: 'VWS.CO', limit: 1 });
    const result = parseResult(raw);

    expect((result.data as unknown[]).length).toBe(1);
  });

  test('returns error when quoteSummary throws', async () => {
    mockQuoteSummary.mockRejectedValueOnce(new Error('Network timeout'));

    const raw = await getYahooIncomeStatements.invoke({ ticker: 'VWS.CO', limit: 4 });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toBeDefined();
  });

  test('returns error when incomeStatementHistory has no usable data', async () => {
    mockQuoteSummary.mockResolvedValueOnce({
      incomeStatementHistory: {
        incomeStatementHistory: [{ endDate: new Date(), totalRevenue: null, netIncome: null }],
      },
    });

    const raw = await getYahooIncomeStatements.invoke({ ticker: 'EMPTY', limit: 4 });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toBeDefined();
  });
});
