import { describe, expect, test } from 'bun:test';
import { validateIntentAgainstPolicy, type HLExecutionPolicy } from './hl-execution-policy.js';
import type { HLExecutionIntent } from './hyperliquid-execution-types.js';

function intent(overrides: Partial<HLExecutionIntent> = {}): HLExecutionIntent {
  return {
    symbol: 'NVDA',
    marketSymbol: 'xyz:NVDA',
    side: 'buy',
    notionalUsd: 1000,
    size: 5,
    orderType: 'market',
    timeInForce: 'IOC',
    reduceOnly: false,
    source: 'rebalance',
    reason: 'Below target',
    ...overrides,
  };
}

describe('hl-execution-policy', () => {
  describe('validateIntentAgainstPolicy', () => {
    test('no policy returns valid', () => {
      const result = validateIntentAgainstPolicy(intent(), null);
      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    test('allowedSymbols rejects symbol not in list', () => {
      const policy: HLExecutionPolicy = { allowedSymbols: ['TSLA', 'AAPL'] };
      const result = validateIntentAgainstPolicy(intent(), policy);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('NVDA') && v.includes('allowedSymbols'))).toBe(true);
    });

    test('allowedSymbols allows symbol in list', () => {
      const policy: HLExecutionPolicy = { allowedSymbols: ['NVDA', 'TSLA'] };
      const result = validateIntentAgainstPolicy(intent(), policy);
      expect(result.valid).toBe(true);
    });

    test('maxOrderNotional rejects when exceeded', () => {
      const policy: HLExecutionPolicy = { maxOrderNotional: 500 };
      const result = validateIntentAgainstPolicy(intent({ notionalUsd: 1000 }), policy);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('Notional') && v.includes('500'))).toBe(true);
    });

    test('allowMarketOrders false rejects market order', () => {
      const policy: HLExecutionPolicy = { allowMarketOrders: false };
      const result = validateIntentAgainstPolicy(intent({ orderType: 'market' }), policy);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('Market orders'))).toBe(true);
    });

    test('reduceOnlyOnly true rejects non-reduce-only', () => {
      const policy: HLExecutionPolicy = { reduceOnlyOnly: true };
      const result = validateIntentAgainstPolicy(intent({ reduceOnly: false }), policy);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('reduce-only'))).toBe(true);
    });

    test('allowOpeningPositions false rejects non-reduce-only', () => {
      const policy: HLExecutionPolicy = { allowOpeningPositions: false };
      const result = validateIntentAgainstPolicy(intent({ reduceOnly: false }), policy);
      expect(result.valid).toBe(false);
    });
  });
});
