import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { getOpenOrders, isHLOrderExecutionConfigured } from './hyperliquid-execution-api.js';

export const HYPERLIQUID_LIVE_ORDERS_DESCRIPTION = `
List working (open) orders on Hyperliquid for the configured account. Requires HYPERLIQUID_ORDER_ENABLED=true and HYPERLIQUID_PRIVATE_KEY. Use before/after submit or cancel to confirm state.
`.trim();

export const hyperliquidLiveOrdersTool = new DynamicStructuredTool({
  name: 'hyperliquid_live_orders',
  description: 'List working open orders on Hyperliquid. Requires order execution enabled.',
  schema: z.object({}),
  func: async () => {
    if (!isHLOrderExecutionConfigured()) {
      return formatToolResult({
        orders: [],
        error: 'HL order execution not configured. Set HYPERLIQUID_ORDER_ENABLED=true and HYPERLIQUID_PRIVATE_KEY.',
      });
    }
    const orders = await getOpenOrders();
    return formatToolResult({ orders });
  },
});
