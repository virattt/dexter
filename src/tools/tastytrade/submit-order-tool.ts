import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { submitOrder } from './api.js';
import { summarizeOrder } from './theta-helpers.js';
import {
  parseOptionSymbol,
  validateOrderAgainstPolicy,
  loadThetaPolicy,
  invalidateTastytradeCache,
} from './utils.js';

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
    let order: Record<string, unknown>;
    try {
      order = JSON.parse(input.order_json) as Record<string, unknown>;
    } catch {
      return JSON.stringify({ error: 'order_json must be valid JSON.' });
    }

    const summary = summarizeOrder(order);
    if (summary.legs.length > 0) {
      const legs = summary.legs.map((leg) => {
        const parsed = parseOptionSymbol(leg.symbol);
        return {
          underlying: parsed.underlying,
          option_type: parsed.optionType,
          action: leg.action,
          dte: parsed.dte ?? null,
        };
      });
      const underlyings = [...new Set(legs.map((l) => l.underlying))].filter((u) => u && u !== '—');
      const policy = loadThetaPolicy();
      const policyValidation = validateOrderAgainstPolicy({ underlyings, legs, policy });
      if (!policyValidation.allowed) {
        return JSON.stringify({
          error: 'Order blocked before submit: violates THETA-POLICY or zero-overlap with Hyperliquid.',
          policy_blocked: true,
          violations: policyValidation.violations,
          account_number: input.account_number,
          note: 'Do not submit. Resolve violations (e.g. remove HL-tradable underlyings, respect no-call list, DTE range) and re-run preview then submit.',
        });
      }
    }

    const res = await submitOrder(input.account_number, order);
    invalidateTastytradeCache();
    return JSON.stringify({ account_number: input.account_number, result: res.data });
  },
});
