import { describe, expect, it } from 'bun:test';
import { resolveFinanceProvider } from './providers.js';

describe('resolveFinanceProvider', () => {
  it('uses auto order when preferred provider is auto', () => {
    const resolved = resolveFinanceProvider('auto', {
      FINANCIAL_DATASETS_API_KEY: '',
      ALPHAVANTAGE_API_KEY: 'alpha-key',
    });

    expect(resolved).toBe('alphavantage');
  });

  it('honors preferred provider when key exists', () => {
    const resolved = resolveFinanceProvider('alphavantage', {
      FINANCIAL_DATASETS_API_KEY: 'fd-key',
      ALPHAVANTAGE_API_KEY: 'alpha-key',
    });

    expect(resolved).toBe('alphavantage');
  });

  it('falls back to auto order when preferred provider key is missing', () => {
    const resolved = resolveFinanceProvider('alphavantage', {
      FINANCIAL_DATASETS_API_KEY: 'fd-key',
      ALPHAVANTAGE_API_KEY: '',
    });

    expect(resolved).toBe('financialdatasets');
  });

  it('returns null when no provider key exists', () => {
    const resolved = resolveFinanceProvider('auto', {
      FINANCIAL_DATASETS_API_KEY: '',
      ALPHAVANTAGE_API_KEY: '',
    });

    expect(resolved).toBeNull();
  });
});
