import { describe, expect, test } from 'bun:test';
import { validatePortfolioConfig } from './config.js';
import { resolveEffectiveModel } from './model-resolution.js';

describe('portfolio config validation', () => {
  test('validates a minimal portfolio config', () => {
    const result = validatePortfolioConfig(JSON.stringify({
      version: 1,
      portfolios: [
        {
          id: 'core-us',
          name: 'Core US',
          enabled: true,
          holdings: [{ ticker: 'aapl' }, { ticker: 'msft' }],
        },
      ],
    }));

    expect(result.ok).toBe(true);
    expect(result.config?.portfolios[0]?.holdings[0]?.ticker).toBe('AAPL');
  });

  test('rejects duplicate portfolio ids', () => {
    const result = validatePortfolioConfig(JSON.stringify({
      version: 1,
      portfolios: [
        { id: 'dup', name: 'One', enabled: true, holdings: [{ ticker: 'AAPL' }] },
        { id: 'dup', name: 'Two', enabled: true, holdings: [{ ticker: 'MSFT' }] },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('Duplicate portfolio id'))).toBe(true);
  });
});

describe('portfolio model resolution', () => {
  test('infers moonshot from kimi model', () => {
    const result = resolveEffectiveModel({
      cliModel: 'kimi-k2-5',
    });

    expect(result.model).toBe('kimi-k2-5');
    expect(result.provider).toBe('moonshot');
    expect(result.source).toBe('cli');
  });
});
