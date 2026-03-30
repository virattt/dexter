import { describe, test, expect, spyOn, beforeEach } from 'bun:test';
import { api } from './api.js';
import { getCryptoPriceSnapshot, getCryptoPrices, getCryptoTickers } from './crypto.js';

function parseResult(raw: unknown): { data: unknown; sourceUrls?: string[] } {
  return JSON.parse(raw as string);
}

describe('getCryptoPriceSnapshot', () => {
  test('tool name is get_crypto_price_snapshot', () => {
    expect(getCryptoPriceSnapshot.name).toBe('get_crypto_price_snapshot');
  });

  test('returns snapshot data', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: { price: 65_000, volume: 28_000_000_000 } },
      url: 'https://api.financialdatasets.ai/crypto/prices/snapshot/',
    });
    const result = await getCryptoPriceSnapshot.invoke({ ticker: 'BTC-USD' });
    const parsed = parseResult(result);
    expect((parsed.data as { price: number }).price).toBe(65_000);
  });

  test('returns empty object when snapshot is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/crypto/prices/snapshot/',
    });
    const result = await getCryptoPriceSnapshot.invoke({ ticker: 'BTC-USD' });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual({});
  });

  test('passes ticker param to API', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { snapshot: {} },
      url: 'https://api.financialdatasets.ai/crypto/prices/snapshot/',
    });
    await getCryptoPriceSnapshot.invoke({ ticker: 'ETH-USD' });
    expect(spy).toHaveBeenCalledWith('/crypto/prices/snapshot/', { ticker: 'ETH-USD' });
  });
});

describe('getCryptoPrices', () => {
  test('tool name is get_crypto_prices', () => {
    expect(getCryptoPrices.name).toBe('get_crypto_prices');
  });

  test('returns price array from API', async () => {
    const prices = [
      { date: '2025-01-01', open: 93_000, close: 94_500 },
      { date: '2025-01-02', open: 94_500, close: 96_000 },
    ];
    spyOn(api, 'get').mockResolvedValue({
      data: { prices },
      url: 'https://api.financialdatasets.ai/crypto/prices/',
    });
    const result = await getCryptoPrices.invoke({
      ticker: 'BTC-USD',
      interval: 'day',
      start_date: '2025-01-01',
      end_date: '2025-01-31',
    });
    const parsed = parseResult(result);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect((parsed.data as typeof prices).length).toBe(2);
  });

  test('returns empty array when prices is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/crypto/prices/',
    });
    const result = await getCryptoPrices.invoke({
      ticker: 'BTC-USD',
      interval: 'day',
      start_date: '2025-01-01',
      end_date: '2025-01-31',
    });
    const parsed = parseResult(result);
    expect(parsed.data).toEqual([]);
  });

  test('passes cacheable=true for past date range', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { prices: [] },
      url: 'https://api.financialdatasets.ai/crypto/prices/',
    });
    spy.mockClear();
    await getCryptoPrices.invoke({
      ticker: 'BTC-USD',
      interval: 'day',
      start_date: '2020-01-01',
      end_date: '2020-12-31',
    });
    const opts = spy.mock.calls[0][2] as { cacheable: boolean } | undefined;
    expect(opts?.cacheable).toBe(true);
  });

  test('passes cacheable=false for future/current end date', async () => {
    const spy = spyOn(api, 'get').mockResolvedValue({
      data: { prices: [] },
      url: 'https://api.financialdatasets.ai/crypto/prices/',
    });
    spy.mockClear();
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    await getCryptoPrices.invoke({
      ticker: 'BTC-USD',
      interval: 'day',
      start_date: '2025-01-01',
      end_date: futureDate.toISOString().slice(0, 10),
    });
    const opts = spy.mock.calls[0][2] as { cacheable: boolean } | undefined;
    expect(opts?.cacheable).toBe(false);
  });
});

describe('getCryptoTickers', () => {
  test('tool name is get_available_crypto_tickers', () => {
    expect(getCryptoTickers.name).toBe('get_available_crypto_tickers');
  });

  test('returns tickers array', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: { tickers: ['BTC-USD', 'ETH-USD', 'SOL-USD'] },
      url: 'https://api.financialdatasets.ai/crypto/prices/tickers/',
    });
    const result = await getCryptoTickers.invoke({});
    const parsed = parseResult(result);
    expect(parsed.data).toEqual(['BTC-USD', 'ETH-USD', 'SOL-USD']);
  });

  test('returns empty array when tickers is missing', async () => {
    spyOn(api, 'get').mockResolvedValue({
      data: {},
      url: 'https://api.financialdatasets.ai/crypto/prices/tickers/',
    });
    const result = await getCryptoTickers.invoke({});
    const parsed = parseResult(result);
    expect(parsed.data).toEqual([]);
  });
});
