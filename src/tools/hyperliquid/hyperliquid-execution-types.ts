/**
 * Normalized Hyperliquid execution intent (Phase 9b).
 * Data handoff object between rebalance/preview and submit; not an action by itself.
 */

export type HLOrderSource = 'rebalance' | 'manual' | 'repair';

export type HLOrderType = 'market' | 'limit';

export type HLTimeInForce = 'GTC' | 'IOC' | 'ALO';

export interface HLExecutionIntent {
  symbol: string;
  marketSymbol: string;
  side: 'buy' | 'sell';
  notionalUsd: number;
  size: number;
  orderType: HLOrderType;
  limitPx?: number;
  timeInForce: HLTimeInForce;
  reduceOnly: boolean;
  source: HLOrderSource;
  reason: string;
}

export interface HLResolvedMarket {
  marketSymbol: string;
  dex: string;
  dayNtlVlm: number;
  markPx?: number;
  szDecimals?: number;
}
