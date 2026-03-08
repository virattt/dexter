import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { submitOrder, postTradeReconcile, isHLOrderExecutionConfigured } from './hyperliquid-execution-api.js';
import type { HLExecutionIntent, HLOrderType, HLTimeInForce } from './hyperliquid-execution-types.js';

export const HYPERLIQUID_SUBMIT_ORDER_DESCRIPTION = `
Submit a single order to Hyperliquid. **Requires explicit user confirmation** before use. Always run hyperliquid_order_preview first and only submit after the user confirms. Requires HYPERLIQUID_ORDER_ENABLED=true and HYPERLIQUID_PRIVATE_KEY.

Use preview_token (or cloid) for idempotency: pass the same value to avoid duplicate submits.
`.trim();

const schema = z.object({
  market_symbol: z.string().describe('Resolved market symbol (e.g. xyz:NVDA) from order_preview'),
  side: z.enum(['buy', 'sell']),
  size: z.number().positive(),
  limit_px: z.number().positive().describe('Limit price (for market orders use current mark or slippage-bound price)'),
  order_type: z.enum(['market', 'limit']),
  time_in_force: z.enum(['GTC', 'IOC', 'ALO']).default('IOC'),
  reduce_only: z.boolean().default(false),
  reason: z.string().optional().describe('Reason from preview (e.g. rebalance trim/add)'),
  preview_token: z
    .string()
    .optional()
    .describe('Optional idempotency key (e.g. from order_preview); passed as client order ID'),
});

export const hyperliquidSubmitOrderTool = new DynamicStructuredTool({
  name: 'hyperliquid_submit_order',
  description:
    'Submit one HL order. Use only after user explicitly confirms (e.g. after hyperliquid_order_preview). Requires approval.',
  schema,
  func: async (input) => {
    if (!isHLOrderExecutionConfigured()) {
      return formatToolResult({
        success: false,
        error: 'HL order execution not configured. Set HYPERLIQUID_ORDER_ENABLED=true and HYPERLIQUID_PRIVATE_KEY.',
      });
    }
    const intent: HLExecutionIntent = {
      symbol: input.market_symbol.split(':').pop() ?? input.market_symbol,
      marketSymbol: input.market_symbol,
      side: input.side as 'buy' | 'sell',
      notionalUsd: input.size * input.limit_px,
      size: input.size,
      orderType: input.order_type as HLOrderType,
      limitPx: input.limit_px,
      timeInForce: input.time_in_force as HLTimeInForce,
      reduceOnly: input.reduce_only,
      source: 'rebalance',
      reason: input.reason ?? 'Submitted via Dexter',
    };
    const cloid = input.preview_token ?? undefined;
    const result = await submitOrder(intent, cloid);
    if (result.success) {
      const reconcile = await postTradeReconcile();
      return formatToolResult({ ...result, reconcile: reconcile.openOrders, receipt: reconcile.message });
    }
    return formatToolResult(result);
  },
});
