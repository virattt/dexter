import { describe, expect, test } from 'bun:test';
import { buildThetaScanTableSummary, tastytradeThetaScanTool } from './theta-scan-tool.js';
import type { ThetaScanCandidate } from './theta-scan-tool.js';

describe('tastytrade theta scan (hard-block)', () => {
  test('tool has expected name and schema', () => {
    expect(tastytradeThetaScanTool.name).toBe('tastytrade_theta_scan');
    expect(tastytradeThetaScanTool.schema).toBeDefined();
  });

  test('buildThetaScanTableSummary returns markdown table with headers and rows', () => {
    const candidates: ThetaScanCandidate[] = [
      {
        underlying: 'AMAT',
        strategy_type: 'credit_spread',
        expiration_date: '2025-04-18',
        dte: 41,
        estimated_credit: 1.25,
        max_loss: 375,
        buying_power_estimate: 500,
        short_delta: 0.15,
        policy_ok: true,
        policy_notes: [],
        legs: [
          { symbol: 'AMAT  250418P00120000', action: 'Sell to Open', quantity: 1, instrument_type: 'equity_option', strike: 120 },
          { symbol: 'AMAT  250418P00115000', action: 'Buy to Open', quantity: 1, instrument_type: 'equity_option', strike: 115 },
        ],
        order_json: '{}',
        score: 0.8,
      },
    ];
    const table = buildThetaScanTableSummary(candidates, 5);
    expect(table).toContain('| Underlying | Strategy | Strike(s) | Credit | APR-like | Prob (ITM) | DTE | Max loss |');
    expect(table).toContain('AMAT');
    expect(table).toContain('credit spread');
    expect(table).toContain('120/115');
    expect(table).toContain('$1.25');
    expect(table).toContain('41');
    expect(table).toContain('$375');
    expect(table).toContain('15.0%');
    expect(table).toMatch(/\d+\.\d+%/);
  });

  test('buildThetaScanTableSummary returns empty string for no candidates', () => {
    expect(buildThetaScanTableSummary([], 5)).toBe('');
  });

  test('when tastytrade not authenticated, returns setup_required or error', async () => {
    const saved = {
      clientId: process.env.TASTYTRADE_CLIENT_ID,
      clientSecret: process.env.TASTYTRADE_CLIENT_SECRET,
    };
    try {
      delete process.env.TASTYTRADE_CLIENT_ID;
      delete process.env.TASTYTRADE_CLIENT_SECRET;
      const out = await tastytradeThetaScanTool.invoke({
        strategy_type: 'credit_spread',
        min_credit: 0.5,
      });
      const parsed = JSON.parse(typeof out === 'string' ? out : JSON.stringify(out));
      expect(parsed.setup_required === true || parsed.error != null).toBe(true);
    } finally {
      if (saved.clientId !== undefined) process.env.TASTYTRADE_CLIENT_ID = saved.clientId;
      if (saved.clientSecret !== undefined) process.env.TASTYTRADE_CLIENT_SECRET = saved.clientSecret;
    }
  });
});
