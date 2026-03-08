import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { getLiveAccountState, getHLAccountAddress } from './hyperliquid-account-api.js';

export const HYPERLIQUID_POSITIONS_DESCRIPTION = `
Fetch live Hyperliquid holdings for the configured account (HYPERLIQUID_ACCOUNT_ADDRESS).
Returns account value, withdrawable, and normalized positions with symbol, size, mark (entry) price, value, and weight.

## When to Use
- User asks for "my Hyperliquid positions", "HL holdings", "live HL portfolio".
- Before rebalance or report: use to confirm current state when live sync is enabled.

## Requirements
- HYPERLIQUID_ACCOUNT_ADDRESS must be set in env (42-char hex). If not set, tool returns not_configured.
`.trim();

export const hyperliquidPositionsTool = new DynamicStructuredTool({
  name: 'hyperliquid_positions',
  description: 'Fetch live Hyperliquid account positions and margin summary (read-only).',
  schema: z.object({}),
  func: async () => {
    const address = getHLAccountAddress();
    if (!address) {
      return formatToolResult({
        configured: false,
        error: 'HYPERLIQUID_ACCOUNT_ADDRESS not set. Set it to your wallet address (42-char hex) to use live HL positions.',
      });
    }
    try {
      const state = await getLiveAccountState();
      if (!state) {
        return formatToolResult({
          configured: true,
          accountAddress: address,
          error: 'Failed to fetch clearinghouse state.',
        });
      }
      return formatToolResult({
        configured: true,
        accountAddress: state.accountAddress,
        accountValue: state.accountValue,
        withdrawable: state.withdrawable,
        positionCount: state.positions.length,
        positions: state.positions.map((p) => ({
          symbol: p.symbol,
          size: p.size,
          entryPx: p.entryPx,
          value: p.positionValue,
          weightPct: p.weightPct,
        })),
        time: state.time,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return formatToolResult({
        configured: true,
        accountAddress: address,
        error: message,
      });
    }
  },
});
