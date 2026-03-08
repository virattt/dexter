import { describe, expect, test } from 'bun:test';
import { tastytradeThetaScanTool } from './theta-scan-tool.js';

describe('tastytrade theta scan (hard-block)', () => {
  test('tool has expected name and schema', () => {
    expect(tastytradeThetaScanTool.name).toBe('tastytrade_theta_scan');
    expect(tastytradeThetaScanTool.schema).toBeDefined();
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
