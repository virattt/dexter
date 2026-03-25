import { describe, test, expect, beforeEach, spyOn } from 'bun:test';

// ---------------------------------------------------------------------------
// FMP_API_KEY must be set before the module is loaded so getFmpApiKey() does
// not throw during tool creation.
// ---------------------------------------------------------------------------
process.env.FMP_API_KEY = 'test-fmp-key';

const { fmpApi, getFmpIncomeStatements, getFmpBalanceSheets, getFmpCashFlowStatements } =
  await import('./fmp.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResult(raw: unknown): { data: unknown; sourceUrls?: string[] } {
  return JSON.parse(raw as string);
}

// ---------------------------------------------------------------------------
// Stubs — include the redundant fields that should be stripped
// ---------------------------------------------------------------------------

const INCOME_STUB = [
  {
    date: '2024-12-31',
    symbol: 'VWS.CO',
    revenue: 16_500_000_000,
    grossProfit: 2_640_000_000,
    operatingIncome: 990_000_000,
    netIncome: 528_000_000,
    eps: 1.43,
    ebitda: 1_485_000_000,
    // Redundant fields that should be stripped:
    cik: '0001234567',
    link: 'https://sec.gov/...',
    finalLink: 'https://sec.gov/.../final',
    fillingDate: '2025-02-28',
    acceptedDate: '2025-02-28 06:00:00',
  },
];

const BALANCE_STUB = [
  {
    date: '2024-12-31',
    symbol: 'VWS.CO',
    totalAssets: 24_000_000_000,
    totalLiabilities: 18_000_000_000,
    totalStockholdersEquity: 6_000_000_000,
    totalDebt: 8_000_000_000,
    link: 'https://sec.gov/...',
    finalLink: 'https://sec.gov/.../final',
    cik: '0001234567',
    fillingDate: '2025-02-28',
    acceptedDate: '2025-02-28 06:00:00',
  },
];

const CASHFLOW_STUB = [
  {
    date: '2024-12-31',
    symbol: 'VWS.CO',
    operatingCashFlow: 1_200_000_000,
    capitalExpenditure: -800_000_000,
    freeCashFlow: 400_000_000,
    link: 'https://sec.gov/...',
    finalLink: 'https://sec.gov/.../final',
    cik: '0001234567',
    fillingDate: '2025-02-28',
    acceptedDate: '2025-02-28 06:00:00',
  },
];

// ===========================================================================
// getFmpIncomeStatements
// ===========================================================================

describe('getFmpIncomeStatements', () => {
  let mockGet: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockGet = spyOn(fmpApi, 'get').mockResolvedValue(INCOME_STUB);
  });

  test('returns income statement data for a valid ticker', async () => {
    const raw = await getFmpIncomeStatements.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });
    const result = parseResult(raw);

    expect(Array.isArray(result.data)).toBe(true);
    const first = (result.data as Record<string, unknown>[])[0];
    expect(first.revenue).toBe(16_500_000_000);
  });

  test('strips redundant fields (cik, link, finalLink, fillingDate, acceptedDate)', async () => {
    const raw = await getFmpIncomeStatements.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });
    const result = parseResult(raw);
    const first = (result.data as Record<string, unknown>[])[0];

    expect(first.cik).toBeUndefined();
    expect(first.link).toBeUndefined();
    expect(first.finalLink).toBeUndefined();
    expect(first.fillingDate).toBeUndefined();
    expect(first.acceptedDate).toBeUndefined();
    // Useful fields must survive
    expect(first.revenue).toBe(16_500_000_000);
    expect(first.eps).toBe(1.43);
  });

  test('calls /income-statement/{ticker} with correct period=annual', async () => {
    await getFmpIncomeStatements.invoke({ ticker: 'AAPL', period: 'annual', limit: 4 });

    expect(mockGet).toHaveBeenCalledWith(
      '/income-statement/AAPL',
      expect.objectContaining({ period: 'annual', limit: 4 }),
    );
  });

  test('maps period=quarterly to FMP period=quarter', async () => {
    await getFmpIncomeStatements.invoke({ ticker: 'AAPL', period: 'quarterly', limit: 2 });

    expect(mockGet).toHaveBeenCalledWith(
      '/income-statement/AAPL',
      expect.objectContaining({ period: 'quarter' }),
    );
  });

  test('passes international ticker (VWS.CO) unchanged to fmpApi', async () => {
    await getFmpIncomeStatements.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });

    expect(mockGet).toHaveBeenCalledWith('/income-statement/VWS.CO', expect.any(Object));
  });

  test('sourceUrls contain financialmodelingprep.com', async () => {
    const raw = await getFmpIncomeStatements.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });
    const result = parseResult(raw);

    expect(result.sourceUrls?.some((u) => u.includes('financialmodelingprep'))).toBe(true);
  });

  test('returns error object when fmpApi returns empty array', async () => {
    mockGet.mockResolvedValueOnce([]);

    const raw = await getFmpIncomeStatements.invoke({ ticker: 'UNKNOWN', period: 'annual', limit: 4 });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toBeDefined();
  });

  test('returns error object when fmpApi throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('[FMP API] 401 Unauthorized'));

    const raw = await getFmpIncomeStatements.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toContain('[FMP API]');
  });
});

// ===========================================================================
// getFmpBalanceSheets
// ===========================================================================

describe('getFmpBalanceSheets', () => {
  let mockGet: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockGet = spyOn(fmpApi, 'get').mockResolvedValue(BALANCE_STUB);
  });

  test('returns balance sheet data for a valid ticker', async () => {
    const raw = await getFmpBalanceSheets.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });
    const result = parseResult(raw);

    expect(Array.isArray(result.data)).toBe(true);
    const first = (result.data as Record<string, unknown>[])[0];
    expect(first.totalAssets).toBe(24_000_000_000);
  });

  test('calls /balance-sheet-statement/{ticker}', async () => {
    await getFmpBalanceSheets.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });

    expect(mockGet).toHaveBeenCalledWith('/balance-sheet-statement/VWS.CO', expect.any(Object));
  });

  test('strips redundant fields', async () => {
    const raw = await getFmpBalanceSheets.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });
    const result = parseResult(raw);
    const first = (result.data as Record<string, unknown>[])[0];

    expect(first.link).toBeUndefined();
    expect(first.cik).toBeUndefined();
  });

  test('returns error object when data is empty', async () => {
    mockGet.mockResolvedValueOnce([]);

    const raw = await getFmpBalanceSheets.invoke({ ticker: 'UNKNOWN', period: 'annual', limit: 4 });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toBeDefined();
  });

  test('returns error object when fmpApi throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('[FMP API] network error'));

    const raw = await getFmpBalanceSheets.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toBeDefined();
  });
});

// ===========================================================================
// getFmpCashFlowStatements
// ===========================================================================

describe('getFmpCashFlowStatements', () => {
  let mockGet: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockGet = spyOn(fmpApi, 'get').mockResolvedValue(CASHFLOW_STUB);
  });

  test('returns cash flow data for a valid ticker', async () => {
    const raw = await getFmpCashFlowStatements.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });
    const result = parseResult(raw);

    expect(Array.isArray(result.data)).toBe(true);
    const first = (result.data as Record<string, unknown>[])[0];
    expect(first.operatingCashFlow).toBe(1_200_000_000);
    expect(first.freeCashFlow).toBe(400_000_000);
  });

  test('calls /cash-flow-statement/{ticker}', async () => {
    await getFmpCashFlowStatements.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });

    expect(mockGet).toHaveBeenCalledWith('/cash-flow-statement/VWS.CO', expect.any(Object));
  });

  test('strips redundant fields', async () => {
    const raw = await getFmpCashFlowStatements.invoke({ ticker: 'VWS.CO', period: 'annual', limit: 4 });
    const result = parseResult(raw);
    const first = (result.data as Record<string, unknown>[])[0];

    expect(first.link).toBeUndefined();
    expect(first.cik).toBeUndefined();
  });

  test('returns error object when data is empty', async () => {
    mockGet.mockResolvedValueOnce([]);

    const raw = await getFmpCashFlowStatements.invoke({ ticker: 'UNKNOWN', period: 'annual', limit: 4 });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toBeDefined();
  });

  test('maps period=quarterly to FMP period=quarter', async () => {
    await getFmpCashFlowStatements.invoke({ ticker: 'AAPL', period: 'quarterly', limit: 4 });

    expect(mockGet).toHaveBeenCalledWith(
      '/cash-flow-statement/AAPL',
      expect.objectContaining({ period: 'quarter' }),
    );
  });
});
