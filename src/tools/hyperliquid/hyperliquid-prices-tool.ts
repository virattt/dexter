import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import {
  getHip3DexName,
  getMetaAndAssetCtxs,
  getAllMids,
  type Meta,
  type AssetCtx,
} from './hyperliquid-api.js';

export const HYPERLIQUID_PRICES_DESCRIPTION = `
Fetch current prices for Hyperliquid (HIP-3) assets. Use when computing HL portfolio or basket returns, or for pre-IPO names (OPENAI, SPACEX, ANTHROPIC) which have no Financial Datasets data.

## When to Use

- User asks for Hyperliquid portfolio performance, HL basket return, or on-chain portfolio prices
- User asks for OPENAI, SPACEX, or ANTHROPIC price (pre-IPO; no FD)
- Quarterly report or heartbeat needs portfolio_hl or hl_basket and HL-native prices are preferred

## When NOT to Use

- Regular US equity prices (use financial_search / get_stock_price with FD)
- Crypto spot (BTC, ETH) for non-HL context — FD or HL both work; HL gives perp mid

## Input

- symbols: list of HL symbols, e.g. ["NVDA", "TSLA", "OPENAI", "GLD"]. Can be plain ("NVDA") or prefixed ("xyz:NVDA").
`.trim();

const schema = z.object({
  symbols: z
    .array(z.string())
    .min(1)
    .max(50)
    .describe(
      'HL symbols to fetch prices for, e.g. ["NVDA", "TSLA", "OPENAI"]. Plain or prefixed (xyz:NVDA).',
    ),
});

function extractUnderlying(apiName: string): string {
  if (apiName.includes(':')) {
    return apiName.split(':')[1] ?? apiName;
  }
  return apiName;
}

function buildSymbolToPrice(
  meta: Meta,
  assetCtxs: AssetCtx[],
  mids: Record<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < meta.universe.length; i++) {
    const name = meta.universe[i]?.name;
    const ctx = assetCtxs[i];
    if (!name) continue;
    const price =
      ctx?.markPx ?? ctx?.midPx ?? (mids[name] ?? ctx?.oraclePx ?? ctx?.prevDayPx);
    if (price) {
      map.set(name, price);
      const underlying = extractUnderlying(name);
      if (underlying !== name && !map.has(underlying)) {
        map.set(underlying, price);
      }
    }
  }
  for (const [k, v] of Object.entries(mids)) {
    if (!map.has(k)) map.set(k, v);
    const u = extractUnderlying(k);
    if (u !== k && !map.has(u)) map.set(u, v);
  }
  return map;
}

export const hyperliquidPricesTool = new DynamicStructuredTool({
  name: 'hyperliquid_prices',
  description:
    'Fetch current prices for Hyperliquid (HIP-3) assets. Use for HL portfolio/basket returns or pre-IPO (OPENAI, SPACEX, ANTHROPIC).',
  schema,
  func: async (input) => {
    const symbols = input.symbols.map((s) => s.trim()).filter(Boolean);
    if (symbols.length === 0) {
      return formatToolResult({ prices: [], error: 'No symbols provided' });
    }
    try {
      const hip3Dex = await getHip3DexName();
      if (!hip3Dex) {
        return formatToolResult({
          prices: [],
          error: 'HIP-3 dex not found; cannot fetch HL prices.',
        });
      }
      const [[meta, assetCtxs], mids] = await Promise.all([
        getMetaAndAssetCtxs(hip3Dex),
        getAllMids(hip3Dex),
      ]);
      const symbolToPrice = buildSymbolToPrice(meta, assetCtxs, mids);
      const prices: { symbol: string; price: string; source: string }[] = [];
      const seen = new Set<string>();
      for (const sym of symbols) {
        const normalized = sym.toUpperCase();
        const price =
          symbolToPrice.get(sym) ??
          symbolToPrice.get(normalized) ??
          symbolToPrice.get(`${hip3Dex}:${sym}`) ??
          symbolToPrice.get(`${hip3Dex}:${normalized}`);
        if (price && !seen.has(normalized)) {
          seen.add(normalized);
          prices.push({ symbol: normalized, price, source: 'hyperliquid' });
        }
      }
      return formatToolResult(
        { prices, dex: hip3Dex },
        [`https://api.hyperliquid.xyz/info`],
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return formatToolResult({
        prices: [],
        error: `Hyperliquid prices failed: ${message}`,
      });
    }
  },
});
