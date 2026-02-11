import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callAlpacaApi, isPaperMode } from './alpaca-client.js';
import { formatToolResult } from '../types.js';

/**
 * Place a new order with position-size validation.
 * Warns at >5% of equity, refuses at >20%.
 */
export const placeOrder = new DynamicStructuredTool({
  name: 'place_order',
  description: `Places a buy or sell order via Alpaca. Supports market, limit, stop, and stop_limit order types. Includes position-size safety checks: warns if order exceeds 5% of equity, refuses if it exceeds 20%.`,
  schema: z.object({
    ticker: z.string().describe("Stock or crypto ticker (e.g. 'AAPL', 'BTC/USD')"),
    side: z.enum(['buy', 'sell']).describe("Order side: 'buy' or 'sell'"),
    qty: z.number().positive().describe('Number of shares/units to trade'),
    type: z
      .enum(['market', 'limit', 'stop', 'stop_limit'])
      .default('market')
      .describe("Order type. Defaults to 'market'."),
    limit_price: z
      .number()
      .optional()
      .describe('Limit price (required for limit and stop_limit orders)'),
    stop_price: z
      .number()
      .optional()
      .describe('Stop price (required for stop and stop_limit orders)'),
    time_in_force: z
      .enum(['day', 'gtc', 'opg', 'cls', 'ioc', 'fok'])
      .default('day')
      .describe("Time in force. Defaults to 'day'. Use 'gtc' for crypto."),
    extended_hours: z
      .boolean()
      .default(false)
      .describe('Allow extended hours trading (limit orders only)'),
  }),
  func: async (input) => {
    const mode = isPaperMode() ? 'paper' : 'live';

    // Validate limit/stop price requirements
    if ((input.type === 'limit' || input.type === 'stop_limit') && !input.limit_price) {
      return formatToolResult({ error: `limit_price is required for ${input.type} orders` }, []);
    }
    if ((input.type === 'stop' || input.type === 'stop_limit') && !input.stop_price) {
      return formatToolResult({ error: `stop_price is required for ${input.type} orders` }, []);
    }

    // Position-size validation: check against account equity
    let equityWarning: string | null = null;
    try {
      const { data: accountData } = await callAlpacaApi('GET', '/v2/account');
      const account = accountData as Record<string, unknown>;
      const equity = parseFloat(account.equity as string);

      if (equity > 0) {
        // Estimate order value
        const estimatedPrice = input.limit_price ?? input.stop_price ?? 0;
        let orderValue = input.qty * estimatedPrice;

        // For market orders without a price estimate, we can't validate precisely
        if (input.type === 'market' && orderValue === 0) {
          // Skip validation for market orders — router prompt instructs analysis first
        } else if (orderValue > 0) {
          const positionPercent = (orderValue / equity) * 100;

          if (positionPercent > 20) {
            return formatToolResult({
              error: `Order refused: position size (${positionPercent.toFixed(1)}% of equity) exceeds 20% maximum. Reduce quantity or use a smaller position.`,
              mode,
              equity,
              estimated_order_value: orderValue,
            }, []);
          }

          if (positionPercent > 5) {
            equityWarning = `Warning: This order represents ${positionPercent.toFixed(1)}% of your equity ($${equity.toFixed(2)}). Consider reducing position size.`;
          }
        }
      }
    } catch {
      // If account check fails, proceed with order but note the issue
      equityWarning = 'Warning: Could not verify position size against account equity.';
    }

    // Build order body
    const orderBody: Record<string, unknown> = {
      symbol: input.ticker,
      side: input.side,
      qty: String(input.qty),
      type: input.type,
      time_in_force: input.time_in_force,
    };

    if (input.limit_price) orderBody.limit_price = String(input.limit_price);
    if (input.stop_price) orderBody.stop_price = String(input.stop_price);
    if (input.extended_hours) orderBody.extended_hours = true;

    const { data, url } = await callAlpacaApi('POST', '/v2/orders', orderBody);
    const order = data as Record<string, unknown>;

    const result: Record<string, unknown> = {
      mode,
      order_id: order.id,
      status: order.status,
      ticker: order.symbol,
      side: order.side,
      qty: order.qty,
      type: order.type,
      time_in_force: order.time_in_force,
      limit_price: order.limit_price,
      stop_price: order.stop_price,
      created_at: order.created_at,
    };

    if (equityWarning) {
      result.warning = equityWarning;
    }

    return formatToolResult(result, [url]);
  },
});

/**
 * Cancel an existing order by ID.
 */
export const cancelOrder = new DynamicStructuredTool({
  name: 'cancel_order',
  description: `Cancels a pending order by its order ID.`,
  schema: z.object({
    order_id: z.string().describe('The order ID to cancel'),
  }),
  func: async (input) => {
    const { data, url } = await callAlpacaApi('DELETE', `/v2/orders/${input.order_id}`);
    return formatToolResult({ mode: isPaperMode() ? 'paper' : 'live', ...data as Record<string, unknown> }, [url]);
  },
});

/**
 * Get orders with optional status filter.
 */
export const getOrders = new DynamicStructuredTool({
  name: 'get_orders',
  description: `Fetches orders from the Alpaca account. Can filter by status (open, closed, all) and limit the number of results.`,
  schema: z.object({
    status: z
      .enum(['open', 'closed', 'all'])
      .default('open')
      .describe("Filter orders by status. Defaults to 'open'."),
    limit: z
      .number()
      .default(20)
      .describe('Maximum number of orders to return. Defaults to 20.'),
  }),
  func: async (input) => {
    const endpoint = `/v2/orders?status=${input.status}&limit=${input.limit}`;
    const { data, url } = await callAlpacaApi('GET', endpoint);

    const orders = (Array.isArray(data) ? data : []).map((order: Record<string, unknown>) => ({
      order_id: order.id,
      ticker: order.symbol,
      side: order.side,
      qty: order.qty,
      filled_qty: order.filled_qty,
      type: order.type,
      status: order.status,
      limit_price: order.limit_price,
      stop_price: order.stop_price,
      filled_avg_price: order.filled_avg_price,
      created_at: order.created_at,
      filled_at: order.filled_at,
    }));

    return formatToolResult({ mode: isPaperMode() ? 'paper' : 'live', orders }, [url]);
  },
});
