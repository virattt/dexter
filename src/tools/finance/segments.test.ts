import { describe, test, expect, spyOn, beforeEach } from 'bun:test';
import { api } from './api.js';
import { getSegmentedRevenues } from './segments.js';

function parseResult(raw: unknown): { data: unknown; sourceUrls?: string[] } {
  return JSON.parse(raw as string);
}

const MOCK_SEGMENTS = [
  {
    period: '2024',
    segments: { iPhone: 201_183_000_000, Services: 96_169_000_000, Mac: 29_984_000_000 },
  },
];

describe('getSegmentedRevenues', () => {
  beforeEach(() => {
    spyOn(api, 'get').mockResolvedValue({
      data: { segmented_revenues: MOCK_SEGMENTS },
      url: 'https://api.financialdatasets.ai/financials/segmented-revenues/',
    });
  });

  test('tool name is get_segmented_revenues', () => {
    expect(getSegmentedRevenues.name).toBe('get_segmented_revenues');
  });

  test('returns segmented revenue data', async () => {
    const result = await getSegmentedRevenues.invoke({ ticker: 'AAPL', period: 'annual', limit: 4 });
    const parsed = parseResult(result);
    // 'period' is stripped by REDUNDANT_FINANCIAL_FIELDS; check a preserved field instead
    expect((parsed.data as typeof MOCK_SEGMENTS)[0].segments).toBeDefined();
  });

  test('strips redundant fields from response', async () => {
    const withRedundant = [
      {
        ...MOCK_SEGMENTS[0],
        accession_number: '0000320193-24-000123',
        currency: 'USD',
        period: '2024',
      },
    ];
    spyOn(api, 'get').mockResolvedValue({
      data: { segmented_revenues: withRedundant },
      url: 'https://api.financialdatasets.ai/financials/segmented-revenues/',
    });
    const result = await getSegmentedRevenues.invoke({ ticker: 'AAPL', period: 'annual', limit: 4 });
    const parsed = parseResult(result) as { data: Record<string, unknown>[] };
    expect(parsed.data[0].accession_number).toBeUndefined();
    expect(parsed.data[0].currency).toBeUndefined();
  });

  test('returns empty object when segmented_revenues is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/financials/segmented-revenues/',
    });
    const result = await getSegmentedRevenues.invoke({ ticker: 'AAPL', period: 'annual', limit: 4 });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual({});
  });

  test('passes correct params to API', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { segmented_revenues: [] },
      url: 'https://api.financialdatasets.ai/financials/segmented-revenues/',
    });
    spy.mockClear();
    await getSegmentedRevenues.invoke({ ticker: 'MSFT', period: 'quarterly', limit: 8 });
    const params = spy.mock.calls[0][1] as { ticker: string; period: string; limit: number };
    expect(params.ticker).toBe('MSFT');
    expect(params.period).toBe('quarterly');
    expect(params.limit).toBe(8);
  });
});
