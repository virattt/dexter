import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getUpcomingEarningsDates } from './utils.js';
import { loadThetaPolicy } from './utils.js';
import { getFirstAccountNumber, getCachedPositions, normalizePositions } from './utils.js';

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export const tastytradeEarningsCalendarTool = new DynamicStructuredTool({
  name: 'tastytrade_earnings_calendar',
  description:
    'Show upcoming earnings dates for tickers. Use when the user asks "when is X earnings", "earnings calendar", "which holdings have earnings soon", or to avoid theta trades before earnings. Defaults to THETA-POLICY allowed underlyings plus current positions when include_positions is true.',
  schema: z.object({
    tickers_csv: z
      .string()
      .optional()
      .describe('Comma-separated tickers. If omitted, uses THETA-POLICY allowed underlyings.'),
    include_positions: z
      .boolean()
      .optional()
      .default(false)
      .describe('When true and tickers_csv omitted, add current tastytrade position underlyings to the list.'),
    within_days: z.number().optional().default(14).describe('Only include earnings within this many days.'),
  }),
  func: async (input) => {
    let tickers: string[];
    if (input.tickers_csv?.trim()) {
      tickers = input.tickers_csv
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
    } else {
      const policy = loadThetaPolicy();
      tickers = [...policy.allowedUnderlyings];
      if (input.include_positions) {
        const acc = await getFirstAccountNumber();
        if (acc) {
          try {
            const positionsData = await getCachedPositions(acc);
            const positions = normalizePositions(positionsData);
            const underlyings = new Set(tickers);
            for (const p of positions) {
              if (p.underlying && p.underlying !== '—') underlyings.add(p.underlying);
            }
            tickers = [...underlyings];
          } catch {
            // keep policy list only
          }
        }
      }
    }
    const withinDays = Math.max(0, input.within_days ?? 14);
    const results: { ticker: string; next_earnings: string | null; days_until: number | null; within_7_days: boolean }[] = [];
    for (const ticker of tickers) {
      const dates = await getUpcomingEarningsDates(ticker);
      const next = dates[0];
      const nextStr = next ? next.toISOString().slice(0, 10) : null;
      const days = next != null ? daysUntil(next) : null;
      results.push({
        ticker,
        next_earnings: nextStr,
        days_until: days,
        within_7_days: days != null && days >= 0 && days <= 7,
      });
    }
    results.sort((a, b) => {
      const da = a.days_until;
      const db = b.days_until;
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
    const withEarnings = results.filter((r) => r.next_earnings != null && r.days_until != null && r.days_until >= 0 && r.days_until <= withinDays);
    return JSON.stringify({
      tickers_checked: tickers.length,
      within_days: withinDays,
      earnings: withEarnings,
      all: results.filter((r) => r.next_earnings != null),
    });
  },
});
