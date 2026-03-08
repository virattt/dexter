/**
 * Authenticated Hyperliquid execution client (Phase 10).
 * Sign and submit orders, query working/recent orders, cancel. Requires HYPERLIQUID_ORDER_ENABLED and HYPERLIQUID_PRIVATE_KEY.
 */

import { Wallet } from 'ethers';
import { Hyperliquid } from '@hyper-d3x/hyperliquid-ts-sdk';
import type { HLExecutionIntent } from './hyperliquid-execution-types.js';

const DEFAULT_BASE = 'https://api.hyperliquid.xyz';
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

let sdkInstance: Hyperliquid | null = null;
let sdkWalletAddress: string | null = null;

function getBaseUrl(): string {
  return process.env.HYPERLIQUID_API_URL ?? DEFAULT_BASE;
}

function isOrderEnabled(): boolean {
  return process.env.HYPERLIQUID_ORDER_ENABLED === 'true';
}

/**
 * Read signer private key from env. Only when HYPERLIQUID_ORDER_ENABLED=true.
 */
export function getHLPrivateKey(): string | null {
  if (!isOrderEnabled()) return null;
  const raw = process.env.HYPERLIQUID_PRIVATE_KEY?.trim();
  if (!raw) return null;
  if (raw.startsWith('0x') && raw.length === 66) return raw;
  if (raw.length === 64 && /^[a-fA-F0-9]+$/.test(raw)) return '0x' + raw;
  return null;
}

/**
 * Check if live HL order execution is configured (env flag + private key).
 */
export function isHLOrderExecutionConfigured(): boolean {
  return isOrderEnabled() && getHLPrivateKey() != null;
}

/**
 * Get or create authenticated SDK instance. Call connect() before place/cancel.
 */
export async function getHLExecutionClient(): Promise<Hyperliquid | null> {
  const pk = getHLPrivateKey();
  if (!pk) return null;
  if (sdkInstance) return sdkInstance;
  const wallet = new Wallet(pk);
  sdkWalletAddress = (await wallet.getAddress()).toLowerCase();
  const testnet = getBaseUrl().toLowerCase().includes('testnet');
  sdkInstance = new Hyperliquid(wallet, testnet);
  await sdkInstance.connect();
  return sdkInstance;
}

/**
 * Submit a single order from an execution intent. Uses limit IOC for market-like fill.
 * Returns { success, orderId?, error? }. Client order ID (cloid) can be passed for idempotency.
 */
export async function submitOrder(
  intent: HLExecutionIntent,
  cloid?: string,
): Promise<{ success: boolean; orderId?: number; error?: string }> {
  const client = await getHLExecutionClient();
  if (!client) {
    return { success: false, error: 'HL order execution not configured (HYPERLIQUID_ORDER_ENABLED and HYPERLIQUID_PRIVATE_KEY)' };
  }
  try {
    const price = intent.orderType === 'market' ? (intent.limitPx ?? 0) : (intent.limitPx ?? 0);
    if (price <= 0 && intent.orderType === 'limit') {
      return { success: false, error: 'Limit order requires limitPx' };
    }
    const tif = intent.timeInForce === 'GTC' ? 'Gtc' : intent.timeInForce === 'ALO' ? 'Alo' : 'Ioc';
    const order = {
      coin: intent.marketSymbol,
      is_buy: intent.side === 'buy',
      sz: intent.size,
      limit_px: price,
      order_type: { limit: { tif: tif as 'Gtc' | 'Ioc' | 'Alo' } },
      reduce_only: intent.reduceOnly,
      ...(cloid ? { cloid } : {}),
    };
    const res = await client.exchange.placeOrder(order);
    if (res.status !== 'ok') {
      return { success: false, error: typeof res.response === 'string' ? res.response : JSON.stringify(res.response) };
    }
    const data = res.response as { statuses?: Array<{ resting?: { oid: number }; filled?: { oid: number }; error?: string }> };
    const first = data?.statuses?.[0];
    if (first?.error) return { success: false, error: first.error };
    const oid = first?.resting?.oid ?? first?.filled?.oid;
    return { success: true, orderId: oid };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Fetch open (working) orders for the configured account.
 */
export async function getOpenOrders(): Promise<
  { coin: string; oid: number; side: string; sz: string; limitPx: string; reduceOnly: boolean }[]
> {
  const client = await getHLExecutionClient();
  if (!client) return [];
  try {
    if (!sdkWalletAddress) return [];
    const raw = await client.info.getUserOpenOrders(sdkWalletAddress);
    if (!Array.isArray(raw)) return [];
    return raw.map((o: { coin: string; oid: number; side: string; sz: string; limitPx: string; reduceOnly?: boolean }) => ({
      coin: o.coin,
      oid: o.oid,
      side: o.side,
      sz: o.sz,
      limitPx: o.limitPx,
      reduceOnly: o.reduceOnly ?? false,
    }));
  } catch {
    return [];
  }
}

/**
 * Cancel an order by asset (coin) and order id.
 */
export async function cancelOrder(
  coin: string,
  orderId: number,
): Promise<{ success: boolean; error?: string }> {
  const client = await getHLExecutionClient();
  if (!client) {
    return { success: false, error: 'HL order execution not configured' };
  }
  try {
    const res = await client.exchange.cancelOrder({ coin, o: orderId });
    if (res.status !== 'ok') {
      return { success: false, error: typeof res.response === 'string' ? res.response : JSON.stringify(res.response) };
    }
    const data = res.response as { statuses?: Array<{ error?: string }> };
    const first = data?.statuses?.[0];
    if (first?.error) return { success: false, error: first.error };
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Cancel by client order ID (idempotent).
 */
export async function cancelOrderByCloid(coin: string, cloid: string): Promise<{ success: boolean; error?: string }> {
  const client = await getHLExecutionClient();
  if (!client) {
    return { success: false, error: 'HL order execution not configured' };
  }
  try {
    await client.exchange.cancelOrderByCloid(coin, cloid);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Post-trade reconciliation: fetch current open orders and return a short receipt.
 * Call after submit/cancel; optionally run hyperliquid_sync_portfolio to refresh positions file.
 */
export async function postTradeReconcile(): Promise<{
  openOrders: { coin: string; oid: number; side: string; sz: string; limitPx: string; reduceOnly: boolean }[];
  message: string;
}> {
  const orders = await getOpenOrders();
  return {
    openOrders: orders,
    message: `Reconciled: ${orders.length} open order(s). Run hyperliquid_sync_portfolio with write_to_file=true to refresh PORTFOLIO-HYPERLIQUID.md.`,
  };
}
