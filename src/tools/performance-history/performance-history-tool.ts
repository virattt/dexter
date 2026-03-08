import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

const PERFORMANCE_HISTORY_PATH = join(homedir(), '.dexter', 'performance-history.json');

interface QuarterRecord {
  period: string;
  portfolio: number;
  btc: number;
  spy: number;
  gld: number;
  /** Hyperliquid basket benchmark return (optional) */
  hl_basket?: number;
  /** Hyperliquid portfolio return (optional) */
  portfolio_hl?: number;
}

export const PERFORMANCE_HISTORY_TOOL_DESCRIPTION = `
Manage performance history (~/.dexter/performance-history.json) for YTD and since-inception tracking.

## When to Use

- After writing a quarterly report: call record_quarter to append the quarter's returns
- When writing a quarterly report: call view, summary, ytd, or since_inception to get history or computed returns for the report

## Actions

- view: Show all recorded quarters (raw JSON)
- summary: Structured summary with quarters plus computed ytd and optionally since_inception (includes portfolio_hl, hl_basket when present)
- ytd: Compounded YTD returns for the current year (portfolio, btc, spy, gld, portfolio_hl, hl_basket)
- since_inception: Compounded returns from first quarter or from inception_year (e.g. 2024). Optional inception_year for filtering.
- record_quarter: Append a quarter. period: "YYYY-QN" (e.g. 2026-Q1). Required: portfolio, btc, spy, gld. Optional: hl_basket, portfolio_hl.
`.trim();

function compound(returns: number[]): number {
  if (returns.length === 0) return 0;
  let prod = 1;
  for (const r of returns) prod *= 1 + r;
  return prod - 1;
}

function getYearFromPeriod(period: string): number {
  const m = period.match(/^(\d{4})/);
  return m ? parseInt(m[1]!, 10) : 0;
}

const performanceHistorySchema = z.object({
  action: z.enum(['view', 'summary', 'ytd', 'since_inception', 'record_quarter']),
  period: z.string().optional().describe('Quarter identifier, e.g. 2026-Q1 (required for record_quarter)'),
  portfolio: z.number().optional().describe('Portfolio return as decimal, e.g. -0.058 for -5.8%'),
  btc: z.number().optional().describe('BTC return as decimal'),
  spy: z.number().optional().describe('SPY return as decimal'),
  gld: z.number().optional().describe('GLD return as decimal'),
  hl_basket: z.number().optional().describe('Hyperliquid basket benchmark return as decimal (optional)'),
  portfolio_hl: z.number().optional().describe('Hyperliquid portfolio return as decimal (optional)'),
  inception_year: z.number().optional().describe('First year to include for since_inception (e.g. 2024)'),
});

export const performanceHistoryTool = new DynamicStructuredTool({
  name: 'performance_history',
  description: 'View or record quarterly performance for YTD and since-inception tracking.',
  schema: performanceHistorySchema,
  func: async (input) => {
    const dir = join(homedir(), '.dexter');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let quarters: QuarterRecord[] = [];
    if (existsSync(PERFORMANCE_HISTORY_PATH)) {
      quarters = JSON.parse(readFileSync(PERFORMANCE_HISTORY_PATH, 'utf-8')).quarters ?? [];
    }

    if (input.action === 'view') {
      if (quarters.length === 0) {
        return 'No performance history yet. Use record_quarter after writing a quarterly report.';
      }
      return `Performance history:\n${JSON.stringify({ quarters }, null, 2)}`;
    }

    const currentYear = new Date().getFullYear();
    if (input.action === 'summary') {
      if (quarters.length === 0) {
        return JSON.stringify({ quarters: [], ytd: null, since_inception: null });
      }
      const ytdQuarters = quarters.filter((q) => getYearFromPeriod(q.period) === currentYear);
      const ytd =
        ytdQuarters.length === 0
          ? null
          : {
              portfolio: compound(ytdQuarters.map((q) => q.portfolio)),
              btc: compound(ytdQuarters.map((q) => q.btc)),
              spy: compound(ytdQuarters.map((q) => q.spy)),
              gld: compound(ytdQuarters.map((q) => q.gld)),
              ...(ytdQuarters.some((q) => q.portfolio_hl != null)
                ? { portfolio_hl: compound(ytdQuarters.map((q) => q.portfolio_hl ?? 0)) }
                : {}),
              ...(ytdQuarters.some((q) => q.hl_basket != null)
                ? { hl_basket: compound(ytdQuarters.map((q) => q.hl_basket ?? 0)) }
                : {}),
            };
      const sinceInception = {
        portfolio: compound(quarters.map((q) => q.portfolio)),
        btc: compound(quarters.map((q) => q.btc)),
        spy: compound(quarters.map((q) => q.spy)),
        gld: compound(quarters.map((q) => q.gld)),
        ...(quarters.some((q) => q.portfolio_hl != null)
          ? { portfolio_hl: compound(quarters.map((q) => q.portfolio_hl ?? 0)) }
          : {}),
        ...(quarters.some((q) => q.hl_basket != null)
          ? { hl_basket: compound(quarters.map((q) => q.hl_basket ?? 0)) }
          : {}),
      };
      return JSON.stringify({ quarters, ytd, since_inception: sinceInception });
    }

    if (input.action === 'ytd') {
      if (quarters.length === 0) return JSON.stringify({ error: 'No quarters recorded' });
      const ytdQuarters = quarters.filter((q) => getYearFromPeriod(q.period) === currentYear);
      if (ytdQuarters.length === 0) {
        return JSON.stringify({ year: currentYear, message: 'No quarters for current year yet', ytd: null });
      }
      const ytd = {
        portfolio: compound(ytdQuarters.map((q) => q.portfolio)),
        btc: compound(ytdQuarters.map((q) => q.btc)),
        spy: compound(ytdQuarters.map((q) => q.spy)),
        gld: compound(ytdQuarters.map((q) => q.gld)),
        ...(ytdQuarters.some((q) => q.portfolio_hl != null)
          ? { portfolio_hl: compound(ytdQuarters.map((q) => q.portfolio_hl ?? 0)) }
          : {}),
        ...(ytdQuarters.some((q) => q.hl_basket != null)
          ? { hl_basket: compound(ytdQuarters.map((q) => q.hl_basket ?? 0)) }
          : {}),
      };
      return JSON.stringify({ year: currentYear, ytd });
    }

    if (input.action === 'since_inception') {
      if (quarters.length === 0) return JSON.stringify({ error: 'No quarters recorded' });
      const startYear = input.inception_year ?? getYearFromPeriod(quarters[0]!.period);
      const fromQuarters = quarters.filter((q) => getYearFromPeriod(q.period) >= startYear);
      if (fromQuarters.length === 0) {
        return JSON.stringify({ inception_year: startYear, message: 'No quarters from that year', since_inception: null });
      }
      const sinceInception = {
        portfolio: compound(fromQuarters.map((q) => q.portfolio)),
        btc: compound(fromQuarters.map((q) => q.btc)),
        spy: compound(fromQuarters.map((q) => q.spy)),
        gld: compound(fromQuarters.map((q) => q.gld)),
        ...(fromQuarters.some((q) => q.portfolio_hl != null)
          ? { portfolio_hl: compound(fromQuarters.map((q) => q.portfolio_hl ?? 0)) }
          : {}),
        ...(fromQuarters.some((q) => q.hl_basket != null)
          ? { hl_basket: compound(fromQuarters.map((q) => q.hl_basket ?? 0)) }
          : {}),
      };
      return JSON.stringify({ inception_year: startYear, since_inception: sinceInception });
    }

    if (input.action === 'record_quarter') {
      if (input.period == null || input.portfolio == null || input.btc == null || input.spy == null || input.gld == null) {
        return 'Error: period, portfolio, btc, spy, gld are all required for record_quarter.';
      }
      const record: QuarterRecord = {
        period: input.period,
        portfolio: input.portfolio,
        btc: input.btc,
        spy: input.spy,
        gld: input.gld,
      };
      if (input.hl_basket != null) record.hl_basket = input.hl_basket;
      if (input.portfolio_hl != null) record.portfolio_hl = input.portfolio_hl;
      quarters.push(record);
      quarters.sort((a, b) => a.period.localeCompare(b.period));
      writeFileSync(PERFORMANCE_HISTORY_PATH, JSON.stringify({ quarters }, null, 2), 'utf-8');
      return `Recorded ${input.period}. Total quarters: ${quarters.length}.`;
    }

    return 'Unknown action.';
  },
});
