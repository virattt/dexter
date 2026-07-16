import { describe, test, expect } from 'bun:test';
import { stripFieldsDeep } from './api.js';

type ApiModule = typeof import('./api.js');

/**
 * resolveSource() reads its control env vars at module-load time, so each
 * scenario sets the env and re-imports the module with a cache-busting query
 * to get a fresh evaluation.
 */
function setEnv(overrides: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

async function loadApi(bust: string): Promise<ApiModule> {
  return import(`./api.js?bust=${bust}`) as Promise<ApiModule>;
}

const CLEAR = { FUTU_BRIDGE_URL: undefined, FMP_API_KEY: undefined, USE_SEC_EDGAR: undefined };

describe('resolveSource routing', () => {
  test('falls back to financialdatasets when no alt source is configured', async () => {
    setEnv(CLEAR);
    const { resolveSource } = await loadApi('none');
    expect(resolveSource('/prices/snapshot/')).toBe('financialdatasets');
    expect(resolveSource('/crypto/prices/')).toBe('financialdatasets');
    expect(resolveSource('/filings/')).toBe('financialdatasets');
    expect(resolveSource('/financials/income-statements/')).toBe('financialdatasets');
    expect(resolveSource('/insider-trades/')).toBe('financialdatasets');
    expect(resolveSource('/stock-screener/')).toBe('financialdatasets');
  });

  test('routes market data to futu when FUTU_BRIDGE_URL is set', async () => {
    setEnv({ ...CLEAR, FUTU_BRIDGE_URL: 'http://127.0.0.1:8765' });
    const { resolveSource } = await loadApi('futu');
    expect(resolveSource('/prices/snapshot/')).toBe('futu');
    expect(resolveSource('/prices/')).toBe('futu');
    expect(resolveSource('/prices/snapshot/tickers/')).toBe('futu');
    expect(resolveSource('/crypto/prices/snapshot')).toBe('futu');
    expect(resolveSource('/crypto/prices/')).toBe('futu');
    // non-market categories stay on financialdatasets
    expect(resolveSource('/filings/')).toBe('financialdatasets');
    expect(resolveSource('/financials/income-statements/')).toBe('financialdatasets');
  });

  test('routes filings to secedgar when USE_SEC_EDGAR=true', async () => {
    setEnv({ ...CLEAR, USE_SEC_EDGAR: 'true' });
    const { resolveSource } = await loadApi('edgar');
    expect(resolveSource('/filings/')).toBe('secedgar');
    expect(resolveSource('/filings/items/')).toBe('secedgar');
    // market data is unaffected by SEC EDGAR
    expect(resolveSource('/prices/snapshot/')).toBe('financialdatasets');
  });

  test('routes fundamentals to fmp when FMP_API_KEY is set', async () => {
    setEnv({ ...CLEAR, FMP_API_KEY: 'dummy' });
    const { resolveSource } = await loadApi('fmp');
    expect(resolveSource('/financials/income-statements/')).toBe('fmp');
    expect(resolveSource('/financial-metrics/')).toBe('fmp');
    expect(resolveSource('/earnings')).toBe('fmp');
    expect(resolveSource('/news')).toBe('fmp');
    expect(resolveSource('/institutional-holdings/')).toBe('fmp');
    // unrelated endpoints stay on financialdatasets
    expect(resolveSource('/insider-trades/')).toBe('financialdatasets');
    expect(resolveSource('/stock-screener/')).toBe('financialdatasets');
  });

  test('does not misroute /financial-metrics as /financials', async () => {
    setEnv({ ...CLEAR, FMP_API_KEY: 'dummy' });
    const { resolveSource } = await loadApi('fmp2');
    expect(resolveSource('/financial-metrics/')).toBe('fmp');
    expect(resolveSource('/financials/')).toBe('fmp');
  });
});

describe('stripFieldsDeep', () => {
  test('removes listed top-level fields', () => {
    const out = stripFieldsDeep({ a: 1, b: 2, c: 3 }, ['b']) as Record<string, unknown>;
    expect(out).toEqual({ a: 1, c: 3 });
  });

  test('removes fields nested in objects', () => {
    const out = stripFieldsDeep({ a: { b: 1, c: 2 }, d: 3 }, ['b']) as Record<string, unknown>;
    expect(out).toEqual({ a: { c: 2 }, d: 3 });
  });

  test('removes fields inside arrays of objects', () => {
    const out = stripFieldsDeep(
      [
        { a: 1, secret: 9 },
        { a: 2, secret: 8 },
      ],
      ['secret'],
    );
    expect(out).toEqual([{ a: 1 }, { a: 2 }]);
  });

  test('returns primitives untouched', () => {
    expect(stripFieldsDeep(42, ['x'])).toBe(42);
    expect(stripFieldsDeep('s', ['x'])).toBe('s');
    expect(stripFieldsDeep(null, ['x'])).toBe(null);
  });

  test('clones structure but strips nothing when field list is empty', () => {
    const input = { a: { b: 1 }, c: [1, 2] };
    const out = stripFieldsDeep(input, []) as Record<string, unknown>;
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });
});
