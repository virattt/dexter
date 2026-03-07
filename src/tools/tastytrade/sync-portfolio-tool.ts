import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { getPositions, getBalances } from './api.js';
import { tastytradeRequest } from './api.js';

const DEXTER_DIR = join(homedir(), '.dexter');
const PORTFOLIO_MD_PATH = join(DEXTER_DIR, 'PORTFOLIO.md');

async function getFirstAccountNumber(): Promise<string | null> {
  const res = await tastytradeRequest<unknown>('/customers/me/accounts');
  const data = res.data;
  const list = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data ?? (data as { items?: unknown[] })?.items ?? [];
  const first = list[0] as { 'account-number'?: string } | undefined;
  return first?.['account-number'] ?? null;
}

/** Extract underlying ticker from tastytrade symbol (equity or OCC option symbol). */
function underlyingTicker(symbol: string): string {
  const s = (symbol ?? '').trim();
  if (!s) return '—';
  const parts = s.split(/\s+/);
  const root = parts[0];
  if (!root) return '—';
  return root;
}

/** Normalize positions response to array of { symbol, quantity, value }. */
function normalizePositions(data: unknown): { symbol: string; quantity: number; value: number }[] {
  const raw = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data ?? (data as { items?: unknown[] })?.items ?? [];
  const out: { symbol: string; quantity: number; value: number }[] = [];
  for (const p of raw) {
    const pos = p as Record<string, unknown>;
    const symbol = (pos.symbol ?? pos['underlying-symbol'] ?? pos.underlying_symbol ?? '') as string;
    const qty = Number(pos.quantity ?? pos['quantity'] ?? 0) || 0;
    const val = Number(pos.equity ?? pos['equity'] ?? pos.market_value ?? pos['market-value'] ?? pos.value ?? 0) || 0;
    if (symbol) out.push({ symbol, quantity: qty, value: val });
  }
  return out;
}

/** Extract total equity from balances response. */
function totalEquityFromBalances(data: unknown): number {
  const raw = Array.isArray(data) ? data : (data as { data?: unknown })?.data;
  const item = Array.isArray(raw) ? raw[0] : raw;
  if (!item || typeof item !== 'object') return 0;
  const o = item as Record<string, unknown>;
  return Number(o.net_liquidating_value ?? o['net-liquidating-value'] ?? o.equity ?? o.account_value ?? 0) || 0;
}

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
      const ticker = underlyingTicker(p.symbol);
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
      if (!existsSync(DEXTER_DIR)) mkdirSync(DEXTER_DIR, { recursive: true });
      writeFileSync(PORTFOLIO_MD_PATH, markdown, 'utf-8');
    }

    return JSON.stringify({
      account_number: acc,
      total_equity: totalEquity,
      position_count: positions.length,
      ticker_count: rows.length,
      markdown,
      written_to_file: input.write_to_portfolio ? PORTFOLIO_MD_PATH : null,
    });
  },
});
