/**
 * Low-level client for Hyperliquid Info API.
 * POST https://api.hyperliquid.xyz/info — no auth required.
 * Used for HIP-3 (on-chain stocks/indices/commodities) prices and liquidity.
 */

const DEFAULT_BASE = 'https://api.hyperliquid.xyz';
const CACHE_TTL_MS = 60_000;

export interface PerpDex {
  name: string;
  fullName?: string;
  deployer?: string;
}

export interface UniverseAsset {
  name: string;
  szDecimals?: number;
  maxLeverage?: number;
  marginTableId?: number;
  onlyIsolated?: boolean;
  marginMode?: string;
  isDelisted?: boolean;
}

export interface Meta {
  universe: UniverseAsset[];
  marginTables?: unknown[];
  collateralToken?: number;
}

export interface AssetCtx {
  dayNtlVlm?: string;
  funding?: string;
  markPx?: string;
  midPx?: string;
  openInterest?: string;
  oraclePx?: string;
  prevDayPx?: string;
  premium?: string | null;
  impactPxs?: string[] | null;
  dayBaseVlm?: string;
}

let cache: { key: string; data: unknown; ts: number } | null = null;

function getBaseUrl(): string {
  return process.env.HYPERLIQUID_API_URL ?? DEFAULT_BASE;
}

function cacheGet<T>(key: string): T | undefined {
  if (!cache || cache.key !== key) return undefined;
  if (Date.now() - cache.ts > CACHE_TTL_MS) {
    cache = null;
    return undefined;
  }
  return cache.data as T;
}

function cacheSet(key: string, data: unknown): void {
  cache = { key, data, ts: Date.now() };
}

/**
 * Generic POST to Hyperliquid Info API.
 */
export async function postInfo(
  type: string,
  dex?: string,
): Promise<unknown> {
  const body: Record<string, string> = { type };
  if (dex !== undefined && dex !== '') {
    body.dex = dex;
  }
  const url = `${getBaseUrl()}/info`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Hyperliquid API ${type} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * List all perpetual dexes (first = main, HIP-3 often "xyz").
 */
export async function getPerpDexs(): Promise<PerpDex[]> {
  const cacheKey = 'perpDexs';
  const cached = cacheGet<PerpDex[]>(cacheKey);
  if (cached) return cached;
  const raw = await postInfo('perpDexs');
  const arr = Array.isArray(raw) ? raw : [];
  const dexes: PerpDex[] = arr
    .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
    .map((x) => ({
      name: String(x.name ?? ''),
      fullName: x.fullName != null ? String(x.fullName) : undefined,
      deployer: x.deployer != null ? String(x.deployer) : undefined,
    }))
    .filter((d) => d.name !== '');
  cacheSet(cacheKey, dexes);
  return dexes;
}

/**
 * Metadata + asset contexts (dayNtlVlm, openInterest, markPx, prevDayPx) for a dex.
 * Response: [meta, assetCtxs] — assetCtxs[i] corresponds to meta.universe[i].
 */
export async function getMetaAndAssetCtxs(
  dex?: string,
): Promise<[Meta, AssetCtx[]]> {
  const cacheKey = `metaAndAssetCtxs:${dex ?? ''}`;
  const cached = cacheGet<[Meta, AssetCtx[]]>(cacheKey);
  if (cached) return cached;
  const raw = await postInfo('metaAndAssetCtxs', dex);
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error('Hyperliquid metaAndAssetCtxs: unexpected response shape');
  }
  const [metaRaw, ctxRaw] = raw;
  const meta: Meta = {
    universe: Array.isArray(metaRaw?.universe)
      ? metaRaw.universe.map((a: Record<string, unknown>) => ({
          name: String(a.name ?? ''),
          szDecimals: typeof a.szDecimals === 'number' ? a.szDecimals : undefined,
          maxLeverage: typeof a.maxLeverage === 'number' ? a.maxLeverage : undefined,
          marginTableId:
            typeof a.marginTableId === 'number' ? a.marginTableId : undefined,
          onlyIsolated: a.onlyIsolated === true,
          marginMode: a.marginMode != null ? String(a.marginMode) : undefined,
          isDelisted: a.isDelisted === true,
        }))
      : [],
    marginTables: metaRaw?.marginTables,
    collateralToken: metaRaw?.collateralToken,
  };
  const assetCtxs: AssetCtx[] = Array.isArray(ctxRaw)
    ? ctxRaw.map((c: Record<string, unknown>) => ({
        dayNtlVlm: c.dayNtlVlm != null ? String(c.dayNtlVlm) : undefined,
        funding: c.funding != null ? String(c.funding) : undefined,
        markPx: c.markPx != null ? String(c.markPx) : undefined,
        midPx: c.midPx != null ? String(c.midPx) : undefined,
        openInterest: c.openInterest != null ? String(c.openInterest) : undefined,
        oraclePx: c.oraclePx != null ? String(c.oraclePx) : undefined,
        prevDayPx: c.prevDayPx != null ? String(c.prevDayPx) : undefined,
        premium: c.premium != null ? String(c.premium) : null,
        impactPxs: Array.isArray(c.impactPxs) ? (c.impactPxs as string[]) : null,
        dayBaseVlm: c.dayBaseVlm != null ? String(c.dayBaseVlm) : undefined,
      }))
    : [];
  const result: [Meta, AssetCtx[]] = [meta, assetCtxs];
  cacheSet(cacheKey, result);
  return result;
}

/**
 * Mid prices for all coins on a dex. allMids returns Record<coinName, priceString>.
 */
export async function getAllMids(dex?: string): Promise<Record<string, string>> {
  const cacheKey = `allMids:${dex ?? ''}`;
  const cached = cacheGet<Record<string, string>>(cacheKey);
  if (cached) return cached;
  const raw = await postInfo('allMids', dex);
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out[k] = v;
  }
  cacheSet(cacheKey, out);
  return out;
}

/**
 * Find the HIP-3 dex name (e.g. "xyz") by checking which dex has HIP-3-style asset names (prefix:xxx).
 */
export async function getHip3DexName(): Promise<string | null> {
  const dexes = await getPerpDexs();
  for (const d of dexes) {
    if (!d.name || d.name === '') continue;
    try {
      const [meta] = await getMetaAndAssetCtxs(d.name);
      const hasPrefixed = meta.universe.some(
        (a) => a.name.includes(':') && /^[a-z]+:[A-Z0-9]+$/i.test(a.name),
      );
      if (hasPrefixed) return d.name;
    } catch {
      continue;
    }
  }
  return null;
}
