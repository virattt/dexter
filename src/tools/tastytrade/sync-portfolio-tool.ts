import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  getFirstAccountNumber,
  normalizePositions,
  totalEquityFromBalances,
  getCachedPositions,
  getCachedBalances,
  ensureSessionSync,
  isTickerTradableOnHyperliquid,
} from './utils.js';
import { getPortfolioPath, writePortfolioContent } from '../portfolio/portfolio-tool.js';

const PORTFOLIO_MD_PATH = join(homedir(), '.dexter', 'PORTFOLIO.md');

function readExistingTargetsAndMeta(): Map<string, { target: number; layer: string; tier: string }> {
  const out = new Map<string, { target: number; layer: string; tier: string }>();
  if (!existsSync(PORTFOLIO_MD_PATH)) return out;
  try {
    const content = readFileSync(PORTFOLIO_MD_PATH, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().startsWith('|'));
    const headerCells = lines[0]?.split('|').map((s) => s.trim().toLowerCase()) ?? [];
    const tickerIdx = headerCells.indexOf('ticker');
    const targetIdx = headerCells.indexOf('target');
    const actualIdx = headerCells.indexOf('actual');
    const weightIdx = headerCells.indexOf('weight');
    const layerIdx = headerCells.indexOf('layer');
    const tierIdx = headerCells.indexOf('tier');
    const weightCol = targetIdx >= 0 ? targetIdx : weightIdx;
    if (tickerIdx < 0 || weightCol < 0) return out;
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split('|').map((s) => s.trim());
      if (cells.some((c) => c === '---')) continue;
      const ticker = cells[tickerIdx]?.replace(/%$/, '').trim().toUpperCase();
      const weightStr = (cells[weightCol] ?? cells[actualIdx] ?? '').replace(/%$/, '').trim();
      const target = weightStr === '—' || weightStr === '' ? NaN : Number(weightStr);
      const layer = layerIdx >= 0 ? (cells[layerIdx] ?? '—') : '—';
      const tier = tierIdx >= 0 ? (cells[tierIdx] ?? '—') : '—';
      if (ticker) out.set(ticker, { target: Number.isFinite(target) ? target : 0, layer, tier });
    }
  } catch {
    // ignore
  }
  return out;
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
    await ensureSessionSync();
    const [positionsData, balancesData] = await Promise.all([getCachedPositions(acc), getCachedBalances(acc)]);
    const positions = normalizePositions(positionsData);
    const totalEquity = totalEquityFromBalances(balancesData);

    const byTicker = new Map<string, { quantity: number; value: number }>();
    for (const p of positions) {
      const ticker = p.underlying !== '—' ? p.underlying : p.symbol.split(/\s+/)[0] ?? p.symbol;
      if (!ticker) continue;
      const prev = byTicker.get(ticker) ?? { quantity: 0, value: 0 };
      byTicker.set(ticker, { quantity: prev.quantity + p.quantity, value: prev.value + p.value });
    }

    const existing = readExistingTargetsAndMeta();
    const excludedByHlOverlap: string[] = [];
    const rows: { ticker: string; actual: number; target: number; gap: number; layer: string; tier: string; quantity: number; value: number }[] = [];
    for (const [ticker, { quantity, value }] of byTicker.entries()) {
      if (isTickerTradableOnHyperliquid(ticker)) {
        excludedByHlOverlap.push(ticker);
        continue;
      }
      const actual = totalEquity > 0 ? (value / totalEquity) * 100 : 0;
      const meta = existing.get(ticker) ?? { target: 0, layer: '—', tier: '—' };
      const target = meta.target;
      const gap = actual - target;
      rows.push({
        ticker,
        actual,
        target,
        gap,
        layer: meta.layer,
        tier: meta.tier,
        quantity,
        value,
      });
    }
    rows.sort((a, b) => b.value - a.value);

    const header = '| Ticker | Target | Actual | Gap | Layer | Tier |';
    const sep = '| --- | --- | --- | --- | --- | --- |';
    const body = rows.map((r) => {
      const targetStr = r.target > 0 ? `${r.target.toFixed(2)}%` : '—';
      const gapStr = r.target > 0 ? `${r.gap >= 0 ? '+' : ''}${r.gap.toFixed(2)}%` : '—';
      return `| ${r.ticker} | ${targetStr} | ${r.actual.toFixed(2)}% | ${gapStr} | ${r.layer} | ${r.tier} |`;
    });
    const markdown = [header, sep, ...body].join('\n');

    if (input.write_to_portfolio) {
      writePortfolioContent('default', markdown);
    }

    return JSON.stringify({
      account_number: acc,
      total_equity: totalEquity,
      position_count: positions.length,
      ticker_count: rows.length,
      excluded_by_hl_overlap: excludedByHlOverlap.length > 0 ? excludedByHlOverlap : undefined,
      markdown,
      written_to_file: input.write_to_portfolio ? getPortfolioPath('default') : null,
    });
  },
});
