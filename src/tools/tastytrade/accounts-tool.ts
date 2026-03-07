import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { tastytradeRequest } from './api.js';

function extractAccountList(response: unknown): { 'account-number': string; nickname?: string }[] {
  if (Array.isArray(response)) return response as { 'account-number': string; nickname?: string }[];
  if (response && typeof response === 'object' && 'data' in response) {
    const inner = (response as { data: unknown }).data;
    if (Array.isArray(inner)) return inner as { 'account-number': string; nickname?: string }[];
    if (inner && typeof inner === 'object' && 'items' in (inner as object)) {
      return ((inner as { items: unknown }).items as { 'account-number': string; nickname?: string }[]) ?? [];
    }
  }
  return [];
}

export const tastytradeAccountsTool = new DynamicStructuredTool({
  name: 'tastytrade_accounts',
  description: 'List linked tastytrade accounts (account numbers and nicknames).',
  schema: z.object({}),
  func: async () => {
    const res = await tastytradeRequest<unknown>('/customers/me/accounts');
    const list = extractAccountList(res.data);
    if (list.length === 0) {
      return JSON.stringify({ accounts: [], message: 'No tastytrade accounts found or API returned empty list.' });
    }
    return JSON.stringify({
      accounts: list.map((a) => ({
        account_number: a['account-number'],
        nickname: a.nickname ?? null,
      })),
    });
  },
});
