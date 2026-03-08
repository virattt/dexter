import { describe, expect, test } from 'bun:test';
import { tastytradeStrategyPreviewTool } from './strategy-preview-tool.js';

describe('tastytrade strategy preview (policy gate)', () => {
  test('returns policy_blocked and violations when order has disallowed underlying', async () => {
    const orderJson = JSON.stringify({
      price: 0.5,
      legs: [
        {
          symbol: 'NVDA250117C00100000',
          action: 'Sell to Open',
          quantity: 1,
          instrument_type: 'Equity Option',
        },
      ],
    });
    const out = await tastytradeStrategyPreviewTool.invoke({
      account_number: 'test-account',
      order_json: orderJson,
    });
    const parsed = JSON.parse(typeof out === 'string' ? out : JSON.stringify(out));
    expect(parsed.policy_blocked).toBe(true);
    expect(Array.isArray(parsed.violations)).toBe(true);
    expect(parsed.violations.length).toBeGreaterThan(0);
    expect(parsed.dry_run_attempted).toBe(true);
    expect(parsed.dry_run_result).toBeDefined();
    expect(parsed.note).toContain('Do not submit');
  });

  test('returns policy_blocked false and trade_memo when order is compliant', async () => {
    const orderJson = JSON.stringify({
      price: 0.5,
      legs: [
        {
          symbol: 'SPY250117C00600000',
          action: 'Sell to Open',
          quantity: 1,
          instrument_type: 'Equity Option',
        },
      ],
    });
    const out = await tastytradeStrategyPreviewTool.invoke({
      account_number: 'test-account',
      order_json: orderJson,
    });
    const parsed = JSON.parse(typeof out === 'string' ? out : JSON.stringify(out));
    expect(parsed.policy_blocked).toBe(false);
    expect(parsed.trade_memo).toBeDefined();
  });
});
