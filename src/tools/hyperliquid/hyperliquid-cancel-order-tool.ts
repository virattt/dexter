import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { cancelOrder, cancelOrderByCloid, postTradeReconcile, isHLOrderExecutionConfigured } from './hyperliquid-execution-api.js';

export const HYPERLIQUID_CANCEL_ORDER_DESCRIPTION = `
Cancel an open Hyperliquid order by order id or by client order id (cloid). **Requires explicit user confirmation.** Get order ids from hyperliquid_live_orders. Requires HYPERLIQUID_ORDER_ENABLED=true and HYPERLIQUID_PRIVATE_KEY.
`.trim();

const schema = z.object({
  coin: z.string().describe('Market symbol (e.g. xyz:NVDA) for the order'),
  order_id: z.number().int().optional().describe('Order id from hyperliquid_live_orders'),
  cloid: z.string().optional().describe('Client order id (if order was submitted with preview_token)'),
});

export const hyperliquidCancelOrderTool = new DynamicStructuredTool({
  name: 'hyperliquid_cancel_order',
  description: 'Cancel an open HL order by order_id or cloid. Requires approval.',
  schema,
  func: async (input) => {
    if (!isHLOrderExecutionConfigured()) {
      return formatToolResult({
        success: false,
        error: 'HL order execution not configured. Set HYPERLIQUID_ORDER_ENABLED=true and HYPERLIQUID_PRIVATE_KEY.',
      });
    }
    if (input.cloid != null) {
      const result = await cancelOrderByCloid(input.coin, input.cloid);
      if (result.success) {
        const reconcile = await postTradeReconcile();
        return formatToolResult({ ...result, reconcile: reconcile.openOrders, receipt: reconcile.message });
      }
      return formatToolResult(result);
    }
    if (input.order_id != null) {
      const result = await cancelOrder(input.coin, input.order_id);
      if (result.success) {
        const reconcile = await postTradeReconcile();
        return formatToolResult({ ...result, reconcile: reconcile.openOrders, receipt: reconcile.message });
      }
      return formatToolResult(result);
    }
    return formatToolResult({ success: false, error: 'Provide order_id or cloid' });
  },
});
