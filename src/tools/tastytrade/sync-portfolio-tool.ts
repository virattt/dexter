import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPositions, getBalances } from './api.js';
import { getFirstAccountNumber, normalizePositions, totalEquityFromBalances } from './utils.js';
import { getPortfolioPath, writePortfolioContent } from '../portfolio/portfolio-tool.js';

export const tastytradeSyncPortfolioTool = new DynamicStructuredTool({
  name: 'tastytrade_sync_portfolio',
  description: 'Fetch tastytrade positions and balances, build portfolio table, optionally write to PORTFOLIO.md.',
  schema: z.object({
    account_number: z.string().optional().describe('Account number. If omitted, uses the first account.'),
    write_to_portfolio: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, write the generated table to ~/.dexter/PORTFOLIO.md. Otherwise return markdown only.'),
  }),
  func: async (input) => {
    let accountNumber: string | null | undefined = input.account_number;
    if (!accountNumber) {
      accountNumber = await getFirstAccountNumber();
      if (!accountNumber) {
        return JSON.stringify({ error: 'No tastytrade account found. Provide account_number or link an account.' });
      }
    }
    const acc = accountNumber as string;

    const [posRes, balRes] = await Promise.all([getPositions(acc), getBalances(acc)]);
    const positions = normalizePositions(posRes.data);
    const totalEquity = totalEquityFromBalances(balRes.data);

    const byTicker = new Map<string, { quantity: number; value: number }>();
    for (const p of positions) {
      const ticker = p.underlying !== '—' ? p.underlying : p.symbol.split(/\s+/)[0] ?? p.symbol;
      if (!ticker) continue;
      const prev = byTicker.get(ticker) ?? { quantity: 0, value: 0 };
      byTicker.set(ticker, { quantity: prev.quantity + p.quantity, value: prev.value + p.value });
    }

    const rows: { ticker: string; weight: number; quantity: number; value: number }[] = [];
    for (const [ticker, { quantity, value }] of byTicker.entries()) {
      const weight = totalEquity > 0 ? (value / totalEquity) * 100 : 0;
      rows.push({ ticker, weight, quantity, value });
    }
    rows.sort((a, b) => b.value - a.value);

    const header = '| Ticker | Weight | Layer | Tier |';
    const sep = '| --- | --- | --- | --- |';
    const body = rows.map((r) => `| ${r.ticker} | ${r.weight.toFixed(2)}% | — | — |`).join('\n');
    const markdown = [header, sep, body].join('\n');

    if (input.write_to_portfolio) {
      writePortfolioContent('default', markdown);
    }

    return JSON.stringify({
      account_number: acc,
      total_equity: totalEquity,
      position_count: positions.length,
      ticker_count: rows.length,
      markdown,
      written_to_file: input.write_to_portfolio ? getPortfolioPath('default') : null,
    });
  },
});
