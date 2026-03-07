import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { orderDryRun } from './api.js';

export const tastytradeOrderDryRunTool = new DynamicStructuredTool({
  name: 'tastytrade_order_dry_run',
  description: 'Validate an order without submitting. Returns buying power effect and fees.',
  schema: z.object({
    account_number: z.string().describe('Tastytrade account number (e.g. 5WX01234).'),
    order_json: z
      .string()
      .describe(
        'Order as JSON. Must include time_in_force (Day/GTC), order_type (Limit/Market), legs (array of { symbol, quantity, action, instrument_type }), price (negative=debit, positive=credit). See developer.tastytrade.com order submission.'
      ),
  }),
  func: async (input) => {
    let order: unknown;
    try {
      order = JSON.parse(input.order_json);
    } catch {
      return JSON.stringify({ error: 'order_json must be valid JSON.' });
    }
    const res = await orderDryRun(input.account_number, order);
    return JSON.stringify({ account_number: input.account_number, dry_run_result: res.data });
  },
});
