import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { submitOrder } from './api.js';

export const tastytradeSubmitOrderTool = new DynamicStructuredTool({
  name: 'tastytrade_submit_order',
  description: 'Submit an order to the market. Use only after user confirmation (e.g. after dry_run).',
  schema: z.object({
    account_number: z.string().describe('Tastytrade account number.'),
    order_json: z
      .string()
      .describe(
        'Order as JSON (same format as order_dry_run). time_in_force, order_type, legs, price/value. See developer.tastytrade.com order submission.'
      ),
  }),
  func: async (input) => {
    let order: unknown;
    try {
      order = JSON.parse(input.order_json);
    } catch {
      return JSON.stringify({ error: 'order_json must be valid JSON.' });
    }
    const res = await submitOrder(input.account_number, order);
    return JSON.stringify({ account_number: input.account_number, result: res.data });
  },
});
