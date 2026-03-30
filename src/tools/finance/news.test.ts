import { describe, test, expect, spyOn, beforeEach } from 'bun:test';
import { api } from './api.js';
import { getCompanyNews } from './news.js';

function parseResult(raw: unknown): { data: unknown; sourceUrls?: string[] } {
  return JSON.parse(raw as string);
}

const MOCK_NEWS = [
  { title: 'Apple Reports Record Revenue', source: 'Bloomberg', date: '2025-01-28', url: 'https://bloomberg.com/apple-q1' },
  { title: 'Apple Expands AI Features', source: 'Reuters', date: '2025-01-25', url: 'https://reuters.com/apple-ai' },
];

describe('getCompanyNews', () => {
  beforeEach(() => {
    spyOn(api, 'get').mockResolvedValue({
      data: { news: MOCK_NEWS },
      url: 'https://api.financialdatasets.ai/news',
    });
  });

  test('tool name is get_company_news', () => {
    expect(getCompanyNews.name).toBe('get_company_news');
  });

  test('returns news articles from API', async () => {
    const result = await getCompanyNews.invoke({ ticker: 'AAPL', limit: 5 });
    const parsed = parseResult(result);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect((parsed.data as typeof MOCK_NEWS).length).toBe(2);
    expect((parsed.data as typeof MOCK_NEWS)[0].title).toBe('Apple Reports Record Revenue');
  });

  test('normalizes ticker to uppercase', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { news: MOCK_NEWS },
      url: 'https://api.financialdatasets.ai/news',
    });
    spy.mockClear();
    await getCompanyNews.invoke({ ticker: 'aapl', limit: 5 });
    const call = spy.mock.calls[0][1] as { ticker: string; limit: number };
    expect(call.ticker).toBe('AAPL');
  });

  test('clamps limit to 10', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { news: MOCK_NEWS },
      url: 'https://api.financialdatasets.ai/news',
    });
    spy.mockClear();
    await getCompanyNews.invoke({ ticker: 'AAPL', limit: 50 });
    const call = spy.mock.calls[0][1] as { ticker: string; limit: number };
    expect(call.limit).toBe(10);
  });

  test('passes limit below 10 unchanged', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { news: [] },
      url: 'https://api.financialdatasets.ai/news',
    });
    spy.mockClear();
    await getCompanyNews.invoke({ ticker: 'AAPL', limit: 3 });
    const call = spy.mock.calls[0][1] as { ticker: string; limit: number };
    expect(call.limit).toBe(3);
  });

  test('returns empty array when news is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/news',
    });
    const result = await getCompanyNews.invoke({ ticker: 'AAPL', limit: 5 });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual([]);
  });

  test('returns empty array when news is null', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { news: null },
      url: 'https://api.financialdatasets.ai/news',
    });
    const result = await getCompanyNews.invoke({ ticker: 'AAPL', limit: 5 });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual([]);
  });

  test('includes sourceUrls in response', async () => {
    const result = await getCompanyNews.invoke({ ticker: 'AAPL', limit: 5 });
    const parsed = parseResult(result);
    expect(parsed.sourceUrls).toContain('https://api.financialdatasets.ai/news');
  });
});
