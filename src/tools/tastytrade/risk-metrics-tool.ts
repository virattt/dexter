import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  getFirstAccountNumber,
  getCachedPositions,
  getCachedBalances,
  ensureSessionSync,
  normalizePositions,
  totalEquityFromBalances,
  availableBuyingPowerFromBalances,
} from './utils.js';

/** Herfindahl-Hirschman index (sum of squared weights). 0 = diversified, 1 = single position. */
function herfindahl(weights: number[]): number {
  if (weights.length === 0) return 0;
  return weights.reduce((sum, w) => sum + w * w, 0);
}

export const tastytradeRiskMetricsTool = new DynamicStructuredTool({
  name: 'tastytrade_risk_metrics',
  description:
    'Portfolio risk scorecard: concentration (Herfindahl, top-5 weight %), theta/delta exposure, buying power utilization %. Use when the user asks "portfolio risk", "concentration", "how much theta/delta", "buying power used", or "risk metrics".',
  schema: z.object({
    account_number: z.string().optional().describe('Tastytrade account number. If omitted, uses the first linked account.'),
  }),
  func: async (input) => {
    const accountNumber = input.account_number ?? (await getFirstAccountNumber());
    if (!accountNumber) {
      return JSON.stringify({ error: 'No tastytrade account found. Provide account_number or link an account.' });
    }
    await ensureSessionSync();
    const [positionsData, balancesData] = await Promise.all([
      getCachedPositions(accountNumber),
      getCachedBalances(accountNumber),
    ]);
    const positions = normalizePositions(positionsData);
    const totalEquity = totalEquityFromBalances(balancesData);
    const buyingPower = availableBuyingPowerFromBalances(balancesData);

    const byUnderlying = new Map<string, { value: number; theta: number; delta: number }>();
    for (const p of positions) {
      const ticker = p.underlying !== '—' ? p.underlying : p.symbol.split(/\s+/)[0] ?? p.symbol;
      if (!ticker) continue;
      const grossValue = Math.abs(Number(p.value ?? (p.mark ?? 0) * p.quantity * 100) || 0);
      const prev = byUnderlying.get(ticker) ?? { value: 0, theta: 0, delta: 0 };
      byUnderlying.set(ticker, {
        value: prev.value + grossValue,
        theta: prev.theta + (p.theta != null ? p.theta * Math.abs(p.quantity) : 0),
        delta: prev.delta + (p.delta != null ? p.delta * p.quantity * 100 : 0),
      });
    }

    const weights = [...byUnderlying.entries()]
      .map(([, v]) => (totalEquity > 0 ? v.value / totalEquity : 0))
      .filter((w) => w > 0);
    const sortedWeights = [...weights].sort((a, b) => b - a);
    const top5Pct = sortedWeights.slice(0, 5).reduce((s, w) => s + w, 0) * 100;
    const herfindahlIndex = herfindahl(weights);

    let portfolioTheta = 0;
    let portfolioDelta = 0;
    for (const [, v] of byUnderlying.entries()) {
      portfolioTheta += v.theta;
      portfolioDelta += v.delta;
    }

    const buyingPowerUtilPct =
      totalEquity > 0 && totalEquity >= buyingPower
        ? Math.min(100, Math.max(0, ((totalEquity - buyingPower) / totalEquity) * 100))
        : null;

    const concentrationRows = [...byUnderlying.entries()]
      .map(([underlying, v]) => ({
        underlying,
        value: Number(v.value.toFixed(2)),
        weight_pct: totalEquity > 0 ? Number(((v.value / totalEquity) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return JSON.stringify({
      account_number: accountNumber,
      total_equity: totalEquity,
      buying_power: buyingPower,
      buying_power_utilization_pct: buyingPowerUtilPct != null ? Number(buyingPowerUtilPct.toFixed(2)) : null,
      concentration: {
        herfindahl_index: Number(herfindahlIndex.toFixed(4)),
        top_5_weight_pct: Number(top5Pct.toFixed(2)),
        by_underlying: concentrationRows,
      },
      portfolio_theta: Number(portfolioTheta.toFixed(4)),
      portfolio_delta: Number(portfolioDelta.toFixed(4)),
      portfolio_beta: null,
      max_drawdown: null,
      note_beta: 'Use financial_search for per-symbol beta and weighted portfolio beta if needed.',
      note_drawdown: 'Historical max drawdown requires transaction history (tastytrade_transactions).',
    });
  },
});
