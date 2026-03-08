/**
 * Resolves underlying symbol (e.g. NVDA) to the best tradable Hyperliquid market
 * (API symbol with highest 24h volume). Used for execution planning (Phase 9b).
 */

import { getHip3DexName, getMetaAndAssetCtxs, type Meta, type AssetCtx } from './hyperliquid-api.js';
import type { HLResolvedMarket } from './hyperliquid-execution-types.js';

function extractUnderlying(apiName: string): string {
  if (apiName.includes(':')) {
    return apiName.split(':')[1] ?? apiName;
  }
  return apiName;
}

/**
 * Resolve an underlying symbol (e.g. NVDA, TSLA) to the most liquid market on HIP-3.
 * Returns the API market symbol (e.g. xyz:NVDA), dex name, and 24h volume, or null if not found.
 */
export async function resolveUnderlyingToMarket(
  underlying: string,
): Promise<HLResolvedMarket | null> {
  const normalized = underlying.trim().toUpperCase();
  if (!normalized) return null;

  const dex = await getHip3DexName();
  if (!dex) return null;

  const [meta, assetCtxs] = await getMetaAndAssetCtxs(dex);
  let best: { name: string; dayNtlVlm: number; markPx?: string; szDecimals?: number } | null = null;

  for (let i = 0; i < meta.universe.length; i++) {
    const asset = meta.universe[i];
    const ctx = assetCtxs[i];
    if (!asset?.name || asset.isDelisted) continue;
    const u = extractUnderlying(asset.name);
    if (u.toUpperCase() !== normalized) continue;
    const dayNtlVlm = ctx?.dayNtlVlm ? parseFloat(ctx.dayNtlVlm) : 0;
    if (best == null || dayNtlVlm > best.dayNtlVlm) {
      best = {
        name: asset.name,
        dayNtlVlm,
        markPx: ctx?.markPx,
        szDecimals: asset.szDecimals,
      };
    }
  }

  if (!best) return null;
  return {
    marketSymbol: best.name,
    dex,
    dayNtlVlm: best.dayNtlVlm,
    markPx: best.markPx != null ? parseFloat(best.markPx) : undefined,
    szDecimals: best.szDecimals,
  };
}

/**
 * Resolve multiple underlyings to markets. Returns a map of underlying -> resolved market;
 * missing entries mean resolution failed for that symbol.
 */
export async function resolveUnderlyingsToMarkets(
  underlyings: string[],
): Promise<Map<string, HLResolvedMarket>> {
  const out = new Map<string, HLResolvedMarket>();
  const unique = [...new Set(underlyings.map((u) => u.trim().toUpperCase()).filter(Boolean))];
  await Promise.all(
    unique.map(async (u) => {
      const resolved = await resolveUnderlyingToMarket(u);
      if (resolved) out.set(u, resolved);
    }),
  );
  return out;
}
