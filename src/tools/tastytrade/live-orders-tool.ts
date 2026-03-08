import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getLiveOrders } from './api.js';
import { tastytradeRequest } from './api.js';

async function getFirstAccountNumber(): Promise<string | null> {
  const res = await tastytradeRequest<unknown>('/customers/me/accounts');
  const data = res.data;
  const list = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data ?? (data as { items?: unknown[] })?.items ?? [];
  const first = list[0] as { account?: { 'account-number'?: string }; 'account-number'?: string } | undefined;
  return first?.account?.['account-number'] ?? first?.['account-number'] ?? null;
}

export const tastytradeLiveOrdersTool = new DynamicStructuredTool({
  name: 'tastytrade_live_orders',
  description: 'List live and recent orders for a tastytrade account.',
  schema: z.object({
    account_number: z
      .string()
      .optional()
      .describe('Account number. If omitted, uses the first account.'),
  }),
  func: async (input) => {
    let accountNumber: string | null | undefined = input.account_number;
    if (!accountNumber) {
      accountNumber = await getFirstAccountNumber();
      if (!accountNumber) {
        return JSON.stringify({ error: 'No tastytrade account found. Provide account_number or link an account.' });
      }
    }
    const acc = accountNumber as string;
    const res = await getLiveOrders(acc);
    return JSON.stringify({ account_number: acc, orders: res.data });
  },
});
