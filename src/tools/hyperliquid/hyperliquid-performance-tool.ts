import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { formatToolResult } from '../types.js';
import { callApi } from '../finance/api.js';
import {
  getFDTicker,
  HL_BASKET_SYMBOLS,
  PRE_IPO,
} from './hl-fd-mapping.js';
import {
  getHip3DexName,
  getMetaAndAssetCtxs,
  getAllMids,
  type Meta,
  type AssetCtx,
} from './hyperliquid-api.js';
import { parsePortfolioMarkdown } from '../../utils/portfolio-parse.js';

export const HYPERLIQUID_PERFORMANCE_DESCRIPTION = `
Compute Hyperliquid basket return and optional user HL portfolio return for a period. Use before calling performance_history record_quarter with hl_basket and portfolio_hl.

## Input
- period: e.g. "2026-Q1" (calendar quarter) or "7d" (last 7 days)
- portfolio_path (optional): path to PORTFOLIO-HYPERLIQUID.md; default ~/.dexter/PORTFOLIO-HYPERLIQUID.md

## Output
- hl_basket: equal-weight return of the HL benchmark basket (decimal)
- portfolio_hl (if file exists): weighted return of the user's HL portfolio (decimal)
- period, startDate, endDate

Requires FINANCIAL_DATASETS_API_KEY for historical prices. Pre-IPO names use HL end price only (start = end for that leg).
`.trim();

/** Parse period string to { startDate, endDate } in YYYY-MM-DD. */
function parsePeriod(period: string): { startDate: string; endDate: string } {
  const trimmed = period.trim();
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  const format = (date: Date) =>
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0');

  const ndMatch = trimmed.match(/^(\d+)d$/i);
  if (ndMatch) {
    const n = Math.min(365, Math.max(1, parseInt(ndMatch[1]!, 10)));
    const end = new Date(y, m, d);
    const start = new Date(y, m, d - n);
    return { startDate: format(start), endDate: format(end) };
  }

  const qMatch = trimmed.match(/^(\d{4})-Q([1-4])$/i);
  if (qMatch) {
    const year = parseInt(qMatch[1]!, 10);
    const q = parseInt(qMatch[2]!, 10);
    const startMonth = (q - 1) * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0);
    const endToday = new Date(y, m, d);
    const end = endDate > endToday ? endToday : endDate;
    return { startDate: format(startDate), endDate: format(end) };
  }

  throw new Error(
    `Invalid period "${period}". Use "YYYY-Q1|Q2|Q3|Q4" (e.g. 2026-Q1) or "Nd" (e.g. 7d).`,
  );
}

interface PricePoint {
  date: string;
  close: number;
}

/** Fetch FD historical prices and return start and end close for a ticker. */
async function getFDStartEndClose(
  ticker: string,
  startDate: string,
  endDate: string,
): Promise<{ startClose: number; endClose: number } | null> {
  const params = {
    ticker: ticker.toUpperCase(),
    interval: 'day',
    start_date: startDate,
    end_date: endDate,
  };
  const { data } = await callApi('/prices/', params);
  const prices = (data?.prices as unknown[]) ?? [];
  if (prices.length === 0) return null;

  const withClose = prices
    .map((p: unknown) => {
      const r = p as Record<string, unknown>;
      const close = typeof r.close === 'number' ? r.close : parseFloat(String(r.close ?? NaN));
      const date =
        typeof r.date === 'string'
          ? r.date
          : typeof r.time === 'string'
            ? (r.time as string).slice(0, 10)
            : '';
      return { date, close };
    })
    .filter((x) => x.date && !Number.isNaN(x.close)) as PricePoint[];

  if (withClose.length === 0) return null;
  withClose.sort((a, b) => a.date.localeCompare(b.date));
  const first = withClose[0]!;
  const last = withClose[withClose.length - 1]!;
  return { startClose: first.close, endClose: last.close };
}

/** Build symbol -> price map from HL meta + assetCtxs + mids. */
function buildHLPriceMap(
  meta: Meta,
  assetCtxs: AssetCtx[],
  mids: Record<string, string>,
): Map<string, number> {
  const map = new Map<string, number>();
  const extract = (apiName: string) =>
    apiName.includes(':') ? (apiName.split(':')[1] ?? apiName) : apiName;
  for (let i = 0; i < meta.universe.length; i++) {
    const name = meta.universe[i]?.name;
    const ctx = assetCtxs[i];
    if (!name) continue;
    const raw =
      ctx?.markPx ?? ctx?.midPx ?? (mids[name] ?? ctx?.oraclePx ?? ctx?.prevDayPx);
    const price = raw != null ? parseFloat(String(raw)) : NaN;
    if (!Number.isNaN(price)) {
      map.set(name, price);
      const u = extract(name);
      if (u !== name && !map.has(u)) map.set(u, price);
    }
  }
  for (const [k, v] of Object.entries(mids)) {
    const num = parseFloat(v);
    if (!Number.isNaN(num) && !map.has(k)) map.set(k, num);
    const u = extract(k);
    if (u !== k && !map.has(u)) map.set(u, num);
  }
  return map;
}

/** Get current HL price for a symbol (for pre-IPO end price). */
async function getHLPrice(symbol: string): Promise<number | null> {
  const normalized = symbol.trim().toUpperCase().replace(/^[a-z]+:/i, '');
  try {
    const hip3 = await getHip3DexName();
    if (!hip3) return null;
    const [[meta, assetCtxs], mids] = await Promise.all([
      getMetaAndAssetCtxs(hip3),
      getAllMids(hip3),
    ]);
    const map = buildHLPriceMap(meta, assetCtxs, mids);
    const price =
      map.get(symbol) ??
      map.get(normalized) ??
      map.get(`${hip3}:${symbol}`) ??
      map.get(`${hip3}:${normalized}`);
    return price ?? null;
  } catch {
    return null;
  }
}

/** Result of computing HL period returns; used by hyperliquid_performance and hyperliquid_portfolio_ops. */
export interface HLPeriodReturnsResult {
  hl_basket: number | null;
  portfolio_hl?: number;
  period: string;
  startDate: string;
  endDate: string;
  error?: string;
  warning?: string;
}

/** Compute hl_basket and optional portfolio_hl for a period. Exported for use by hyperliquid_portfolio_ops. */
export async function computeHLPeriodReturns(
  period: string,
  portfolioPath: string,
): Promise<HLPeriodReturnsResult> {
  const result: HLPeriodReturnsResult = {
    hl_basket: null,
    period: period.trim(),
    startDate: '',
    endDate: '',
  };

  if (!process.env.FINANCIAL_DATASETS_API_KEY) {
    result.error =
      'HL performance unavailable: FINANCIAL_DATASETS_API_KEY is required for historical prices.';
    return result;
  }

  try {
    const parsed = parsePeriod(period.trim());
    result.startDate = parsed.startDate;
    result.endDate = parsed.endDate;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }

  const { startDate, endDate } = result;
  const basketReturns: number[] = [];
  for (const hlSym of HL_BASKET_SYMBOLS) {
    const fd = getFDTicker(hlSym);
    if (!fd) continue;
    const prices = await getFDStartEndClose(fd, startDate, endDate);
    if (!prices) continue;
    const { startClose, endClose } = prices;
    if (startClose <= 0) continue;
    const ret = (endClose - startClose) / startClose;
    basketReturns.push(ret);
  }
  if (basketReturns.length === 0) {
    result.error =
      'Could not compute hl_basket: no FD price data for basket symbols in the period.';
  } else {
    result.hl_basket = basketReturns.reduce((a, b) => a + b, 0) / basketReturns.length;
  }

  if (existsSync(portfolioPath)) {
    try {
      const content = readFileSync(portfolioPath, 'utf-8');
      const positions = parsePortfolioMarkdown(content);
      if (positions.length === 0) {
        result.warning = 'Portfolio file empty or no valid rows.';
      } else {
        const totalWeight = positions.reduce((s, p) => s + p.weight, 0);
        const scale = totalWeight > 0 ? 1 / totalWeight : 0;
        const weightedReturns: number[] = [];
        for (const { ticker, weight } of positions) {
          const w = weight * scale;
          const fd = getFDTicker(ticker);
          let ret: number;
          if (fd) {
            const prices = await getFDStartEndClose(fd, startDate, endDate);
            if (!prices || prices.startClose <= 0) continue;
            ret = (prices.endClose - prices.startClose) / prices.startClose;
          } else if (PRE_IPO.has(ticker.trim().toUpperCase())) {
            const endPx = await getHLPrice(ticker);
            if (endPx == null) continue;
            ret = 0;
          } else {
            continue;
          }
          weightedReturns.push(w * ret);
        }
        result.portfolio_hl = weightedReturns.reduce((a, b) => a + b, 0);
      }
    } catch (err) {
      result.warning =
        'Could not compute portfolio_hl: ' + (err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}

const schema = z.object({
  period: z
    .string()
    .describe('Period: "YYYY-Q1|Q2|Q3|Q4" (e.g. 2026-Q1) or "Nd" (e.g. 7d).'),
  portfolio_path: z
    .string()
    .optional()
    .describe(
      'Optional path to PORTFOLIO-HYPERLIQUID.md; default ~/.dexter/PORTFOLIO-HYPERLIQUID.md',
    ),
});

export const hyperliquidPerformanceTool = new DynamicStructuredTool({
  name: 'hyperliquid_performance',
  description:
    'Compute HL basket return and optional user HL portfolio return for a period. Use before performance_history record_quarter with hl_basket and portfolio_hl.',
  schema,
  func: async (input) => {
    const period = input.period.trim();
    const portfolioPath =
      input.portfolio_path?.trim() || join(homedir(), '.dexter', 'PORTFOLIO-HYPERLIQUID.md');
    const result = await computeHLPeriodReturns(period, portfolioPath);
    return formatToolResult(result);
  },
});
