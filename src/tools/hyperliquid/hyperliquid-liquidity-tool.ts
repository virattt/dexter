import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import {
  getHip3DexName,
  getMetaAndAssetCtxs,
  type Meta,
  type AssetCtx,
} from './hyperliquid-api.js';

export const HYPERLIQUID_LIQUIDITY_DESCRIPTION = `
Get Hyperliquid underlyings ranked by 24h notional volume. Use when suggesting or rebalancing PORTFOLIO-HYPERLIQUID to prefer liquid names (better execution, tighter spreads).

## When to Use

- User asks to suggest a Hyperliquid portfolio or on-chain (HIP-3) portfolio
- User asks for rebalance of PORTFOLIO-HYPERLIQUID.md
- You want live volume ranking instead of the static list in docs/PRD-HYPERLIQUID-PORTFOLIO.md §2.1

## When NOT to Use

- Main portfolio (default) suggestion — use thesis and FD data
- General stock research — use financial_search
`.trim();

function extractUnderlying(apiName: string): string {
  if (apiName.includes(':')) {
    return apiName.split(':')[1] ?? apiName;
  }
  return apiName;
}

const schema = z.object({
  dex: z
    .string()
    .optional()
    .describe(
      'Perp dex name (e.g. "xyz" for HIP-3). Omit to auto-detect HIP-3 dex.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Max number of underlyings to return (default 20).'),
});

export const hyperliquidLiquidityTool = new DynamicStructuredTool({
  name: 'hyperliquid_liquidity',
  description:
    'Get HL underlyings ranked by 24h volume. Use when suggesting or rebalancing PORTFOLIO-HYPERLIQUID to prefer liquid names.',
  schema,
  func: async (input) => {
    try {
      const dex =
        input.dex?.trim() ?? (await getHip3DexName()) ?? '';
      if (!dex) {
        return formatToolResult({
          ranked: [],
          error: 'HIP-3 dex not found; cannot fetch volume ranking.',
        });
      }
      const [meta, assetCtxs] = await getMetaAndAssetCtxs(dex);
      const byUnderlying: Map<
        string,
        { dayNtlVlm: number; openInterest: number }
      > = new Map();
      for (let i = 0; i < meta.universe.length; i++) {
        const asset = meta.universe[i];
        const ctx = assetCtxs[i];
        if (!asset?.name || asset.isDelisted) continue;
        const underlying = extractUnderlying(asset.name);
        const dayNtlVlm = ctx?.dayNtlVlm ? parseFloat(ctx.dayNtlVlm) : 0;
        const openInterest = ctx?.openInterest
          ? parseFloat(ctx.openInterest)
          : 0;
        const existing = byUnderlying.get(underlying);
        if (existing) {
          existing.dayNtlVlm += dayNtlVlm;
          existing.openInterest += openInterest;
        } else {
          byUnderlying.set(underlying, { dayNtlVlm, openInterest });
        }
      }
      const ranked = Array.from(byUnderlying.entries())
        .map(([underlying, agg]) => ({
          underlying,
          dayNtlVlm: Math.round(agg.dayNtlVlm * 100) / 100,
          openInterest: Math.round(agg.openInterest * 100) / 100,
        }))
        .sort((a, b) => b.dayNtlVlm - a.dayNtlVlm)
        .slice(0, input.limit);
      return formatToolResult(
        { ranked, dex },
        [`https://api.hyperliquid.xyz/info`],
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return formatToolResult({
        ranked: [],
        error: `Hyperliquid liquidity failed: ${message}`,
      });
    }
  },
});
