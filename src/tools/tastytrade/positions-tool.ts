import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getFirstAccountNumber } from './utils.js';
import { ensureSessionSync } from './utils.js';
import { getCachedPositions } from './utils.js';

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
    let accountNumber = input.account_number ?? (await getFirstAccountNumber());
    if (!accountNumber) {
      return JSON.stringify({ error: 'No tastytrade account found. List accounts first or provide account_number.' });
    }
    await ensureSessionSync();
    const data = await getCachedPositions(accountNumber);
    return JSON.stringify({ account_number: accountNumber, positions: data });
  },
});
