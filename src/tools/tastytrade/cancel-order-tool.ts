import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { cancelOrder } from './api.js';

export const tastytradeCancelOrderTool = new DynamicStructuredTool({
  name: 'tastytrade_cancel_order',
  description: 'Cancel an open order by order id. Get order ids from tastytrade_live_orders.',
  schema: z.object({
    account_number: z.string().describe('Tastytrade account number.'),
    order_id: z.string().describe('Order id (e.g. from tastytrade_live_orders).'),
  }),
  func: async (input) => {
    const res = await cancelOrder(input.account_number, input.order_id);
    return JSON.stringify({ account_number: input.account_number, order_id: input.order_id, result: res.data });
  },
});
