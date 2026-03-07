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
}

export const PERFORMANCE_HISTORY_TOOL_DESCRIPTION = `
Manage performance history (~/.dexter/performance-history.json) for YTD and since-inception tracking.

## When to Use

- After writing a quarterly report: call record_quarter to append the quarter's returns
- When writing a quarterly report: call view to get history, then compute YTD and since-inception for the report

## Actions

- view: Show all recorded quarters (for computing YTD, since-inception)
- record_quarter: Append a quarter. period: "YYYY-QN" (e.g. 2026-Q1). Returns as decimals (e.g. -0.058 for -5.8%).
`.trim();

const performanceHistorySchema = z.object({
  action: z.enum(['view', 'record_quarter']),
  period: z.string().optional().describe('Quarter identifier, e.g. 2026-Q1 (required for record_quarter)'),
  portfolio: z.number().optional().describe('Portfolio return as decimal, e.g. -0.058 for -5.8%'),
  btc: z.number().optional().describe('BTC return as decimal'),
  spy: z.number().optional().describe('SPY return as decimal'),
  gld: z.number().optional().describe('GLD return as decimal'),
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

    if (input.action === 'record_quarter') {
      if (input.period == null || input.portfolio == null || input.btc == null || input.spy == null || input.gld == null) {
        return 'Error: period, portfolio, btc, spy, gld are all required for record_quarter.';
      }
      quarters.push({
        period: input.period,
        portfolio: input.portfolio,
        btc: input.btc,
        spy: input.spy,
        gld: input.gld,
      });
      quarters.sort((a, b) => a.period.localeCompare(b.period));
      writeFileSync(PERFORMANCE_HISTORY_PATH, JSON.stringify({ quarters }, null, 2), 'utf-8');
      return `Recorded ${input.period}. Total quarters: ${quarters.length}.`;
    }

    return 'Unknown action.';
  },
});
