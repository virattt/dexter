/**
 * Hyperliquid account API: read-only clearinghouse state (positions, margin).
 *
 * Phase 9 scope: live position sync only. No order submission or private-key
 * signing; clearinghouseState is public by address.
 */

const DEFAULT_BASE = 'https://api.hyperliquid.xyz';

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export interface HLAssetPositionRaw {
  position?: {
    coin?: string;
    szi?: string;
    entryPx?: string;
    positionValue?: string;
    unrealizedPnl?: string;
    marginUsed?: string;
    liquidationPx?: string;
  };
  type?: string;
}

export interface HLClearinghouseStateRaw {
  marginSummary?: { accountValue?: string; totalRawUsd?: string; totalNtlPos?: string; totalMarginUsed?: string };
  crossMarginSummary?: { accountValue?: string };
  withdrawable?: string;
  assetPositions?: HLAssetPositionRaw[];
  time?: number;
}

export interface HLNormalizedPosition {
  symbol: string;
  size: number;
  entryPx: number;
  positionValue: number;
  weightPct: number;
}

export interface HLAccountState {
  accountAddress: string;
  accountValue: number;
  withdrawable: number;
  positions: HLNormalizedPosition[];
  time: number;
}

function getBaseUrl(): string {
  return process.env.HYPERLIQUID_API_URL ?? DEFAULT_BASE;
}

/**
 * Get account address from env. Safe: no private key, only public address.
 */
export function getHLAccountAddress(): string | null {
  const raw = process.env.HYPERLIQUID_ACCOUNT_ADDRESS?.trim();
  if (!raw) return null;
  return ETH_ADDRESS_REGEX.test(raw) ? raw : null;
}

/**
 * Check if HL account is configured (address present).
 */
export function isHLAccountConfigured(): boolean {
  return getHLAccountAddress() != null;
}

/**
 * POST to Hyperliquid Info API with a user-scoped request (e.g. clearinghouseState).
 */
export async function postInfoUser(
  type: string,
  user: string,
  dex?: string,
): Promise<unknown> {
  const body: Record<string, string> = { type, user };
  if (dex !== undefined && dex !== '') body.dex = dex;
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
 * Fetch clearinghouse state for an address (positions + margin summary).
 */
export async function getClearinghouseState(userAddress: string): Promise<HLClearinghouseStateRaw> {
  const raw = await postInfoUser('clearinghouseState', userAddress);
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Hyperliquid clearinghouseState: unexpected response');
  }
  return raw as HLClearinghouseStateRaw;
}

/**
 * Normalize clearinghouse state to a single internal shape (symbol, size, value, weight).
 */
export function normalizeClearinghouseState(
  state: HLClearinghouseStateRaw,
  accountAddress: string,
): HLAccountState {
  const accountValue = Math.max(
    0,
    parseFloat(state.marginSummary?.accountValue ?? state.crossMarginSummary?.accountValue ?? '0') || 0,
  );
  const withdrawable = Math.max(0, parseFloat(state.withdrawable ?? '0') || 0);
  const positions: HLNormalizedPosition[] = [];
  const rawPositions = state.assetPositions ?? [];

  for (const ap of rawPositions) {
    const pos = ap?.position;
    if (!pos?.coin) continue;
    const symbol = String(pos.coin).trim();
    const size = parseFloat(pos.szi ?? '0') || 0;
    const entryPx = parseFloat(pos.entryPx ?? '0') || 0;
    const positionValue = Math.abs(parseFloat(pos.positionValue ?? '0') || 0);
    const weightPct = accountValue > 0 ? (positionValue / accountValue) * 100 : 0;
    positions.push({ symbol, size, entryPx, positionValue, weightPct });
  }

  return {
    accountAddress,
    accountValue,
    withdrawable,
    positions,
    time: state.time ?? 0,
  };
}

/**
 * Fetch live account state for the configured HL address. Returns null if not configured.
 */
export async function getLiveAccountState(): Promise<HLAccountState | null> {
  const address = getHLAccountAddress();
  if (!address) return null;
  const state = await getClearinghouseState(address);
  return normalizeClearinghouseState(state, address);
}
