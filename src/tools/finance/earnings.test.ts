import { describe, test, expect, spyOn, beforeEach } from 'bun:test';
import { api } from './api.js';
import { getEarnings } from './earnings.js';

function parseResult(raw: unknown): { data: unknown; sourceUrls?: string[] } {
  return JSON.parse(raw as string);
}

const MOCK_EARNINGS = {
  revenue: 124_000_000_000,
  netIncome: 36_000_000_000,
  eps: 2.31,
  revenueEstimate: 120_000_000_000,
  epsEstimate: 2.20,
};

describe('getEarnings', () => {
  beforeEach(() => {
    spyOn(api, 'get').mockResolvedValue({
      data: { earnings: MOCK_EARNINGS },
      url: 'https://api.financialdatasets.ai/earnings',
    });
  });

  test('tool name is get_earnings', () => {
    expect(getEarnings.name).toBe('get_earnings');
  });

  test('returns earnings data from API', async () => {
    const result = await getEarnings.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect((parsed.data as typeof MOCK_EARNINGS).revenue).toBe(124_000_000_000);
    expect((parsed.data as typeof MOCK_EARNINGS).eps).toBe(2.31);
  });

  test('normalizes ticker to uppercase', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { earnings: MOCK_EARNINGS },
      url: 'https://api.financialdatasets.ai/earnings',
    });
    await getEarnings.invoke({ ticker: 'aapl' });
    expect(spy).toHaveBeenCalledWith('/earnings', { ticker: 'AAPL' });
  });

  test('returns empty object when earnings field is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/earnings',
    });
    const result = await getEarnings.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual({});
  });

  test('returns empty object when earnings is null', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { earnings: null },
      url: 'https://api.financialdatasets.ai/earnings',
    });
    const result = await getEarnings.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual({});
  });

  test('includes sourceUrls in response', async () => {
    const result = await getEarnings.invoke({ ticker: 'AAPL' });
    const parsed = parseResult(result);
    expect(parsed.sourceUrls).toEqual(['https://api.financialdatasets.ai/earnings']);
  });
});
