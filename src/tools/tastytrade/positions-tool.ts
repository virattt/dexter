import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { tastytradeRequest } from './api.js';

export const tastytradePositionsTool = new DynamicStructuredTool({
  name: 'tastytrade_positions',
  description: 'Fetch current positions (stocks, options, futures) for a tastytrade account.',
  schema: z.object({
    account_number: z
      .string()
      .optional()
      .describe(
        'Account number (e.g. 5ABC123). If omitted, uses the first account returned by tastytrade_accounts.'
      ),
  }),
  func: async (input) => {
    let accountNumber = input.account_number;
    if (!accountNumber) {
      const accountsRes = await tastytradeRequest<unknown>('/customers/me/accounts');
      const data = accountsRes.data;
      const list = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data ?? (data as { items?: unknown[] })?.items ?? [];
      const first = list[0] as { 'account-number'?: string } | undefined;
      accountNumber = first?.['account-number'];
      if (!accountNumber) {
        return JSON.stringify({ error: 'No tastytrade account found. List accounts first or provide account_number.' });
      }
    }
    const res = await tastytradeRequest<unknown>(`/accounts/${encodeURIComponent(accountNumber)}/positions`);
    return JSON.stringify({ account_number: accountNumber, positions: res.data });
  },
});
