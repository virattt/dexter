import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { tastytradeRequest } from './api.js';

function extractAccountList(response: unknown): { 'account-number': string; nickname?: string }[] {
  let items: unknown[] = [];
  if (Array.isArray(response)) {
    items = response;
  } else if (response && typeof response === 'object' && 'data' in response) {
    const inner = (response as { data: unknown }).data;
    if (Array.isArray(inner)) {
      items = inner;
    } else if (inner && typeof inner === 'object' && 'items' in (inner as object)) {
      items = ((inner as { items: unknown[] }).items) ?? [];
    }
  }
  return items.map((item: any) => {
    const acct = item?.account ?? item;
    return {
      'account-number': acct?.['account-number'] ?? '',
      nickname: acct?.nickname ?? item?.nickname,
    };
  }).filter((a) => a['account-number']);
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
