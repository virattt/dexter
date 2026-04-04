import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockJQuantsFetch = vi.fn();
const mockTseFetchAll = vi.fn();

vi.mock('../../jquants-api.js', () => ({
  jquantsApi: { get: mockJQuantsFetch },
}));

vi.mock('../tse-master.js', () => ({
  TseMasterProvider: vi.fn().mockImplementation(() => ({
    fetchAll: mockTseFetchAll,
    parseMarket: (s: string) => {
      if (s.includes('プライム')) return 'Prime';
      if (s.includes('スタンダード')) return 'Standard';
      if (s.includes('グロース')) return 'Growth';
      return 'Other';
    },
  })),
}));

import { fetchCompanyMaster } from '../company-master.js';
import { TseMasterProvider } from '../tse-master.js';

const SAMPLE_COMPANIES = [
  { code: '7203', name: 'トヨタ自動車', market: 'Prime' as const },
  { code: '9984', name: 'ソフトバンクグループ', market: 'Prime' as const },
];

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.FINANCE_PROVIDER;
  delete process.env.JQUANTS_API_KEY;
});

describe('TseMasterProvider.parseMarket', () => {
  test.each([
    ['東証プライム', 'Prime'],
    ['プライム', 'Prime'],
    ['東証スタンダード', 'Standard'],
    ['東証グロース', 'Growth'],
    ['札幌', 'Other'],
    ['', 'Other'],
  ])('市場名 "%s" → "%s"', (input, expected) => {
    const provider = new TseMasterProvider();
    expect(provider.parseMarket(input)).toBe(expected);
  });
});

describe('fetchCompanyMaster', () => {
  test('FINANCE_PROVIDER=yahoo → TSE CSVを使う', async () => {
    process.env.FINANCE_PROVIDER = 'yahoo';
    mockTseFetchAll.mockResolvedValue({ companies: SAMPLE_COMPANIES, source: 'tse-csv' });

    const result = await fetchCompanyMaster();

    expect(mockTseFetchAll).toHaveBeenCalledOnce();
    expect(mockJQuantsFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('tse-csv');
    expect(result.companies).toHaveLength(2);
  });

  test('FINANCE_PROVIDER=auto, APIキーなし → TSE CSVにフォールバック', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    mockTseFetchAll.mockResolvedValue({ companies: SAMPLE_COMPANIES, source: 'tse-csv' });

    const result = await fetchCompanyMaster();

    expect(mockJQuantsFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('tse-csv');
  });

  test('FINANCE_PROVIDER=auto, J-Quants成功 → J-Quantsを使う', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    process.env.JQUANTS_API_KEY = 'test-key';
    mockJQuantsFetch.mockResolvedValue({
      data: {
        data: [
          { Code: '72030', Name: 'トヨタ自動車', MktNm: 'プライム' },
          { Code: '99840', Name: 'ソフトバンクグループ', MktNm: 'プライム' },
        ],
      },
      url: 'https://jquants',
    });

    const result = await fetchCompanyMaster();

    expect(mockJQuantsFetch).toHaveBeenCalledOnce();
    expect(mockTseFetchAll).not.toHaveBeenCalled();
    expect(result.source).toBe('jquants');
    expect(result.companies[0]?.code).toBe('7203');
  });

  test('FINANCE_PROVIDER=auto, J-Quants失敗 → TSE CSVにフォールバック', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    process.env.JQUANTS_API_KEY = 'test-key';
    mockJQuantsFetch.mockRejectedValue(new Error('403 Forbidden'));
    mockTseFetchAll.mockResolvedValue({ companies: SAMPLE_COMPANIES, source: 'tse-csv' });

    const result = await fetchCompanyMaster();

    expect(mockTseFetchAll).toHaveBeenCalledOnce();
    expect(result.source).toBe('tse-csv');
  });
});
