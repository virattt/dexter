import { describe, test, expect, mock, spyOn, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock ./fmp.js BEFORE importing wacc-inputs.js
// ---------------------------------------------------------------------------

const mockFmpGet = mock(async <T>(_path: string, _params: unknown): Promise<T> =>
  [] as unknown as T,
);
mock.module('./fmp.js', () => ({
  fmpApi: { get: mockFmpGet },
}));

import { api } from './api.js';
import { waccInputsTool } from './wacc-inputs.js';

function parseResult(raw: unknown): { data: Record<string, unknown>; sourceUrls?: string[] } {
  return JSON.parse(raw as string) as { data: Record<string, unknown>; sourceUrls?: string[] };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_SNAPSHOT = {
  beta: 1.25,
  debt_to_equity: 1.87,
  sector: 'Technology',
};

describe('waccInputsTool — beta resolution', () => {
  beforeEach(() => {
    mockFmpGet.mockClear();
    delete process.env.FMP_API_KEY;
  });

  test('tool name is wacc_inputs', () => {
    expect(waccInputsTool.name).toBe('wacc_inputs');
  });

  test('uses beta from Financial Datasets snapshot', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: BASE_SNAPSHOT },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(parsed.data.betaSource).toBe('Financial Datasets snapshot');
    expect(parsed.data.beta).toBe(1.25);
  });

  test('falls back to FMP when snapshot has no beta', async () => {
    process.env.FMP_API_KEY = 'test-fmp-key';
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: { debt_to_equity: 1.5, sector: 'Technology' } }, // no beta
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    mockFmpGet.mockResolvedValueOnce([{ beta: 1.45, sector: 'Technology' }]);

    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(parsed.data.betaSource).toBe('FMP company profile');
    expect(Number(parsed.data.beta)).toBeCloseTo(1.45, 2);
    expect(mockFmpGet).toHaveBeenCalled();
  });

  test('uses sector median beta when both snapshot and FMP lack beta', async () => {
    delete process.env.FMP_API_KEY;
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: { sector: 'Technology' } }, // no beta, no D/E
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(String(parsed.data.betaSource)).toContain('sector median');
    expect(typeof parsed.data.beta).toBe('number');
  });

  test('uses sector median beta when FMP also has no beta', async () => {
    process.env.FMP_API_KEY = 'test-fmp-key';
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: { sector: 'Energy' } },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    mockFmpGet.mockResolvedValueOnce([{ beta: null }]); // FMP returns no beta

    const result = await waccInputsTool.invoke({ ticker: 'XOM' });
    const parsed = parseResult(result);
    expect(String(parsed.data.betaSource)).toContain('sector median');
  });

  test('handles snapshot API failure gracefully (falls through to sector estimate)', async () => {
    delete process.env.FMP_API_KEY;
    spyOn(api, 'get').mockRejectedValue(new Error('API unavailable'));
    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(String(parsed.data.betaSource)).toContain('sector median');
    expect(typeof parsed.data.wacc).toBe('number');
  });
});

describe('waccInputsTool — D/E ratio resolution', () => {
  beforeEach(() => {
    delete process.env.FMP_API_KEY;
  });

  test('reads debt_to_equity from snapshot', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: { beta: 1.2, debt_to_equity: 0.5, sector: 'Technology' } },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(Number(parsed.data.deRatio)).toBeCloseTo(0.5, 2);
  });

  test('reads debtToEquity (camelCase) from snapshot', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: { beta: 1.2, debtToEquity: 0.75, sector: 'Technology' } },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(Number(parsed.data.deRatio)).toBeCloseTo(0.75, 2);
  });

  test('reads debt_equity_ratio from snapshot', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: { beta: 1.2, debt_equity_ratio: 0.4, sector: 'Technology' } },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(Number(parsed.data.deRatio)).toBeCloseTo(0.4, 2);
  });

  test('uses debt_to_equity override when provided', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: { beta: 1.2, debt_to_equity: 2.0, sector: 'Technology' } },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'AAPL', debt_to_equity: 0.25 });
    const parsed = parseResult(result);
    expect(Number(parsed.data.deRatio)).toBeCloseTo(0.25, 2);
  });

  test('defaults D/E to 0.3 when not in snapshot and no override', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: { beta: 1.2, sector: 'Technology' } }, // no D/E
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(Number(parsed.data.deRatio)).toBeCloseTo(0.3, 2);
  });
});

describe('waccInputsTool — WACC computation', () => {
  beforeEach(() => {
    delete process.env.FMP_API_KEY;
  });

  test('returns all expected WACC output fields', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: BASE_SNAPSHOT },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    const expected = ['ticker', 'sector', 'betaSource', 'beta', 'rfr', 'erp', 'ke',
      'deRatio', 'costOfDebt', 'taxRate', 'kdAfterTax', 'equityWeight', 'debtWeight', 'wacc', 'waccPct', 'note'];
    for (const field of expected) {
      expect(parsed.data).toHaveProperty(field);
    }
  });

  test('wacc is between 0 and 1 (sanity check)', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: BASE_SNAPSHOT },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    const wacc = Number(parsed.data.wacc);
    expect(wacc).toBeGreaterThan(0);
    expect(wacc).toBeLessThan(1);
  });

  test('waccPct ends with %', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: BASE_SNAPSHOT },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(String(parsed.data.waccPct)).toEndWith('%');
  });

  test('note string describes WACC decomposition', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: BASE_SNAPSHOT },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(String(parsed.data.note)).toContain('WACC');
    expect(String(parsed.data.note)).toContain('Ke');
    expect(String(parsed.data.note)).toContain('Kd');
  });

  test('higher beta produces higher WACC', async () => {
    const lowBetaSnapshot = { beta: 0.5, debt_to_equity: 0.3, sector: 'Utilities' };
    const highBetaSnapshot = { beta: 2.0, debt_to_equity: 0.3, sector: 'Technology' };

    spyOn(api, 'get')
      .mockResolvedValueOnce({ data: { snapshot: lowBetaSnapshot }, url: 'https://example.com' })
      .mockResolvedValueOnce({ data: { snapshot: highBetaSnapshot }, url: 'https://example.com' });

    const r1 = parseResult(await waccInputsTool.invoke({ ticker: 'XLU' }));
    const r2 = parseResult(await waccInputsTool.invoke({ ticker: 'NVDA' }));

    expect(Number(r2.data.wacc)).toBeGreaterThan(Number(r1.data.wacc));
  });

  test('ticker is normalized to uppercase and included in output', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: BASE_SNAPSHOT },
      url: 'https://api.financialdatasets.ai/financial-metrics/snapshot/',
    });
    const result = await waccInputsTool.invoke({ ticker: 'aapl' });
    const parsed = parseResult(result);
    expect(parsed.data.ticker).toBe('AAPL');
  });
});
