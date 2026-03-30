import { describe, test, expect, spyOn, beforeEach } from 'bun:test';
import { api } from './api.js';
import { getInsiderTrades } from './insider_trades.js';

function parseResult(raw: unknown): { data: unknown; sourceUrls?: string[] } {
  return JSON.parse(raw as string);
}

const MOCK_TRADES = [
  {
    issuer: 'Apple Inc.',
    owner: 'Tim Cook',
    transaction_type: 'P-Purchase',
    shares: 100_000,
    price: 185.50,
    value: 18_550_000,
    filing_date: '2025-01-10',
  },
  {
    issuer: 'Apple Inc.',
    owner: 'Luca Maestri',
    transaction_type: 'S-Sale',
    shares: 50_000,
    price: 190.00,
    value: 9_500_000,
    filing_date: '2025-01-08',
  },
];

describe('getInsiderTrades', () => {
  beforeEach(() => {
    spyOn(api, 'get').mockResolvedValue({
      data: { insider_trades: MOCK_TRADES },
      url: 'https://api.financialdatasets.ai/insider-trades/',
    });
  });

  test('tool name is get_insider_trades', () => {
    expect(getInsiderTrades.name).toBe('get_insider_trades');
  });

  test('returns insider trade data', async () => {
    const result = await getInsiderTrades.invoke({ ticker: 'AAPL', limit: 10 });
    const parsed = parseResult(result);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect((parsed.data as typeof MOCK_TRADES).length).toBe(2);
  });

  test('strips the issuer field from each trade', async () => {
    const result = await getInsiderTrades.invoke({ ticker: 'AAPL', limit: 10 });
    const parsed = parseResult(result) as { data: Record<string, unknown>[] };
    for (const trade of parsed.data) {
      expect(trade.issuer).toBeUndefined();
    }
    // Other fields are preserved
    expect(parsed.data[0].owner).toBe('Tim Cook');
    expect(parsed.data[0].shares).toBe(100_000);
  });

  test('normalizes ticker to uppercase', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { insider_trades: [] },
      url: 'https://api.financialdatasets.ai/insider-trades/',
    });
    spy.mockClear();
    await getInsiderTrades.invoke({ ticker: 'aapl', limit: 10 });
    const params = spy.mock.calls[0][1] as { ticker: string };
    expect(params.ticker).toBe('AAPL');
  });

  test('passes date filters to API', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { insider_trades: [] },
      url: 'https://api.financialdatasets.ai/insider-trades/',
    });
    spy.mockClear();
    await getInsiderTrades.invoke({
      ticker: 'AAPL',
      limit: 5,
      filing_date_gte: '2025-01-01',
      filing_date_lte: '2025-01-31',
    });
    const params = spy.mock.calls[0][1] as Record<string, string | number>;
    expect(params.filing_date_gte).toBe('2025-01-01');
    expect(params.filing_date_lte).toBe('2025-01-31');
  });

  test('returns empty array when insider_trades is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/insider-trades/',
    });
    const result = await getInsiderTrades.invoke({ ticker: 'AAPL', limit: 10 });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual([]);
  });
});
