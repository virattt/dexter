import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getTransactions } from './api.js';
import { getFirstAccountNumber } from './utils.js';
import { extractDataArray } from './utils.js';

function extractNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTransaction(entry: Record<string, unknown>): Record<string, unknown> {
  return {
    id: entry.id ?? entry['transaction-id'],
    date: entry.date ?? entry['executed-at'] ?? entry['created-at'],
    type: entry.type ?? entry['transaction-type'],
    symbol: entry.symbol ?? entry['instrument-symbol'] ?? entry['underlying-symbol'],
    action: entry.action ?? entry['transaction-sub-type'],
    quantity: extractNumber(entry.quantity ?? entry['value-effect']),
    price: extractNumber(entry.price ?? entry['price-effect']),
    value: extractNumber(entry.value ?? entry['value-effect'] ?? entry['amount']),
    fees: extractNumber(entry.fees ?? entry['reg-fee']),
    description: entry.description ?? entry['summary'],
  };
}

export const tastytradeTransactionsTool = new DynamicStructuredTool({
  name: 'tastytrade_transactions',
  description:
    'Fetch transaction history for a tastytrade account. Use when the user asks "what did I trade", "transaction history", "realized P&L", "win rate", or "closed trades".',
  schema: z.object({
    account_number: z.string().optional().describe('Account number. If omitted, uses the first account.'),
    start_date: z
      .string()
      .optional()
      .describe('Start date YYYY-MM-DD. Defaults to 30 days ago.'),
    end_date: z.string().optional().describe('End date YYYY-MM-DD. Defaults to today.'),
    type: z
      .string()
      .optional()
      .describe('Filter by type: Trade, Money Movement, etc. Omit for all.'),
  }),
  func: async (input) => {
    const accountNumber = input.account_number ?? (await getFirstAccountNumber());
    if (!accountNumber) {
      return JSON.stringify({ error: 'No tastytrade account found. Provide account_number or link an account.' });
    }
    const end = input.end_date ? new Date(input.end_date) : new Date();
    const start = input.start_date
      ? new Date(input.start_date)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const params: { start_date?: string; end_date?: string; type?: string } = {
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    };
    if (input.type) params.type = input.type;
    try {
      const res = await getTransactions(accountNumber, params);
      const items = extractDataArray(res.data);
      const transactions = items
        .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
        .map(normalizeTransaction);
      return JSON.stringify({
        account_number: accountNumber,
        start_date: params.start_date,
        end_date: params.end_date,
        count: transactions.length,
        transactions,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return JSON.stringify({ error: message, account_number: accountNumber });
    }
  },
});
