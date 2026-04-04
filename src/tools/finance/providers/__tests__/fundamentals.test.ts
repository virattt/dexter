import { describe, test, expect, vi, beforeEach } from 'vitest';

// モック設定
const mockJQuantsFetch = vi.fn();
const mockYahooFetch = vi.fn();

vi.mock('../../jquants-api.js', () => ({
  jquantsApi: { get: mockJQuantsFetch },
}));

vi.mock('../yahoo-finance.js', () => ({
  YahooFinanceProvider: vi.fn().mockImplementation(() => ({
    fetchSummary: mockYahooFetch,
  })),
}));

import { fetchFinancialSummary } from '../fundamentals.js';
import type { FinancialSummaryRecord } from '../types.js';

const SAMPLE_RECORD: FinancialSummaryRecord = {
  fiscalYearEnd: '2024-03-31',
  period: 'Annual',
  disclosureDate: null,
  netSales: 10000000,
  operatingProfit: 1000000,
  ordinaryProfit: null,
  netIncome: 800000,
  eps: 100,
  dividendPerShare: 30,
  forecastSales: null,
  forecastOperatingProfit: null,
  forecastNetIncome: null,
  totalAssets: 50000000,
  equity: 20000000,
  bps: 2500,
  equityToAssetRatio: 40.0,
  cashFlowsFromOperating: 1500000,
  cashFlowsFromInvesting: -500000,
  cashFlowsFromFinancing: -300000,
};

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.FINANCE_PROVIDER;
  delete process.env.JQUANTS_API_KEY;
});

describe('fetchFinancialSummary', () => {
  test('FINANCE_PROVIDER=yahoo → Yahooのみ使う', async () => {
    process.env.FINANCE_PROVIDER = 'yahoo';
    mockYahooFetch.mockResolvedValue({ records: [SAMPLE_RECORD], source: 'yahoo', url: 'https://yahoo' });

    const result = await fetchFinancialSummary('7203', 'annual', 1);

    expect(mockYahooFetch).toHaveBeenCalledOnce();
    expect(mockJQuantsFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('yahoo');
    expect(result.records).toHaveLength(1);
  });

  test('FINANCE_PROVIDER=auto, APIキーなし → Yahooにフォールバック', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    // JQUANTS_API_KEY は未設定
    mockYahooFetch.mockResolvedValue({ records: [SAMPLE_RECORD], source: 'yahoo', url: 'https://yahoo' });

    const result = await fetchFinancialSummary('7203', 'annual', 1);

    expect(mockJQuantsFetch).not.toHaveBeenCalled();
    expect(mockYahooFetch).toHaveBeenCalledOnce();
    expect(result.source).toBe('yahoo');
  });

  test('FINANCE_PROVIDER=auto, J-Quants成功 → J-Quantsを使う', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    process.env.JQUANTS_API_KEY = 'test-key';
    mockJQuantsFetch.mockResolvedValue({
      data: {
        data: [{
          CurFYEn: '2024-03-31', CurPerType: 'FY', DiscDate: '2024-05-10',
          Sales: 10000000, OP: 1000000, OdP: 900000, NP: 800000,
          EPS: 100, DivAnn: 30, EqAR: 0.4, TA: 50000000, Eq: 20000000, BPS: 2500,
          CFO: 1500000, CFI: -500000, CFF: -300000,
          FSales: null, FOP: null, FNP: null,
        }],
      },
      url: 'https://jquants',
    });

    const result = await fetchFinancialSummary('7203', 'annual', 1);

    expect(mockJQuantsFetch).toHaveBeenCalledOnce();
    expect(mockYahooFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('jquants');
    expect(result.records[0]?.netSales).toBe(10000000);
    expect(result.records[0]?.ordinaryProfit).toBe(900000);
  });

  test('FINANCE_PROVIDER=auto, J-Quants失敗 → Yahooにフォールバック', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    process.env.JQUANTS_API_KEY = 'test-key';
    mockJQuantsFetch.mockRejectedValue(new Error('401 Unauthorized'));
    mockYahooFetch.mockResolvedValue({ records: [SAMPLE_RECORD], source: 'yahoo', url: 'https://yahoo' });

    const result = await fetchFinancialSummary('7203', 'annual', 1);

    expect(mockJQuantsFetch).toHaveBeenCalledOnce();
    expect(mockYahooFetch).toHaveBeenCalledOnce();
    expect(result.source).toBe('yahoo');
  });
});
