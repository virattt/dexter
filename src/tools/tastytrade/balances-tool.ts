import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getFirstAccountNumber, ensureSessionSync, getCachedBalances } from './utils.js';

export const tastytradeBalancesTool = new DynamicStructuredTool({
  name: 'tastytrade_balances',
  description: 'Fetch account balances (equity, cash, margin, buying power) for a tastytrade account.',
  schema: z.object({
    account_number: z
      .string()
      .optional()
      .describe(
        'Account number (e.g. 5ABC123). If omitted, uses the first account returned by tastytrade_accounts.'
      ),
  }),
  func: async (input) => {
    let accountNumber = input.account_number ?? (await getFirstAccountNumber());
    if (!accountNumber) {
      return JSON.stringify({ error: 'No tastytrade account found. List accounts first or provide account_number.' });
    }
    await ensureSessionSync();
    const data = await getCachedBalances(accountNumber);
    return JSON.stringify({ account_number: accountNumber, balances: data });
  },
});
