import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  getWatchlists,
  getWatchlist,
  createWatchlist,
  updateWatchlist,
  deleteWatchlist,
  getQuotes,
} from './api.js';
import { loadThetaPolicy } from './utils.js';

function extractEntries(data: unknown): Array<{ symbol: string; 'instrument-type': string }> {
  const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const raw = obj?.['watchlist-entries'] ?? obj?.watchlist_entries;
  if (!Array.isArray(raw)) return [];
  const out: Array<{ symbol: string; 'instrument-type': string }> = [];
  for (const e of raw) {
    const s = (e && typeof e === 'object' ? (e as Record<string, unknown>).symbol : null) ?? (e as Record<string, unknown>)?.symbol;
    const t = (e && typeof e === 'object' ? (e as Record<string, unknown>)['instrument-type'] : null) ?? (e as Record<string, unknown>)?.['instrument-type'];
    if (typeof s === 'string') out.push({ symbol: s.trim().toUpperCase(), 'instrument-type': typeof t === 'string' ? t : 'Equity' });
  }
  return out;
}

function extractWatchlistList(data: unknown): Array<{ name: string }> {
  const arr = Array.isArray(data) ? data : (data && typeof data === 'object' && (data as Record<string, unknown>).data) ? (data as Record<string, unknown>).data : null;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      const name = (item && typeof item === 'object' ? (item as Record<string, unknown>).name : null) ?? (item as Record<string, unknown>)?.name;
      return typeof name === 'string' ? { name } : null;
    })
    .filter((x): x is { name: string } => x != null);
}

export const tastytradeWatchlistTool = new DynamicStructuredTool({
  name: 'tastytrade_watchlist',
  description:
    'List, create, update, or delete tastytrade watchlists; or scan a watchlist for quotes. Use for "my watchlists", "add AAPL to watchlist X", "create watchlist", "watchlist scan", "delete watchlist".',
  schema: z.object({
    action: z
      .enum(['list', 'create', 'add_symbols', 'remove_symbols', 'delete', 'scan'])
      .describe('Action: list watchlists, create, add_symbols, remove_symbols, delete, or scan (quotes).'),
    name: z.string().optional().describe('Watchlist name (required for create, add_symbols, remove_symbols, delete, scan).'),
    symbols_csv: z.string().optional().describe('Comma-separated symbols (for create, add_symbols, remove_symbols).'),
  }),
  func: async (input) => {
    const { action, name, symbols_csv } = input;
    const symbols = symbols_csv
      ? symbols_csv
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : [];

    if (action === 'list') {
      const res = await getWatchlists();
      const data = (res.data as Record<string, unknown>)?.data ?? res.data;
      const list = extractWatchlistList(data);
      return JSON.stringify({ watchlists: list });
    }

    if (!name?.trim()) {
      return JSON.stringify({ error: 'name is required for this action.' });
    }

    if (action === 'create') {
      const entries = symbols.map((s) => ({ symbol: s, 'instrument-type': 'Equity' as const }));
      await createWatchlist({ name: name.trim(), 'watchlist-entries': entries });
      return JSON.stringify({ created: name, symbols: entries.length ? symbols : [] });
    }

    if (action === 'delete') {
      await deleteWatchlist(name.trim());
      return JSON.stringify({ deleted: name });
    }

    const getRes = await getWatchlist(name.trim());
    const raw = (getRes.data as Record<string, unknown>)?.data ?? getRes.data;
    let entries = extractEntries(raw);

    if (action === 'add_symbols') {
      const existing = new Set(entries.map((e) => e.symbol));
      for (const s of symbols) {
        if (!existing.has(s)) {
          entries.push({ symbol: s, 'instrument-type': 'Equity' });
          existing.add(s);
        }
      }
      await updateWatchlist(name.trim(), { 'watchlist-entries': entries });
      return JSON.stringify({ updated: name, added: symbols, total_symbols: entries.length });
    }

    if (action === 'remove_symbols') {
      const toRemove = new Set(symbols);
      entries = entries.filter((e) => !toRemove.has(e.symbol));
      await updateWatchlist(name.trim(), { 'watchlist-entries': entries });
      return JSON.stringify({ updated: name, removed: symbols, total_symbols: entries.length });
    }

    if (action === 'scan') {
      if (entries.length === 0) {
        return JSON.stringify({ watchlist: name, symbols: [], message: 'Watchlist is empty.' });
      }
      const syms = entries.map((e) => e.symbol);
      const quotesRes = await getQuotes(syms);
      const items = (quotesRes.data as { data?: { items?: unknown[] }; items?: unknown[] })?.data?.items ?? (quotesRes.data as { items?: unknown[] })?.items ?? [];
      const policy = loadThetaPolicy();
      const inPolicy = new Set(policy.allowedUnderlyings.map((u) => u.toUpperCase()));
      const rows = (Array.isArray(items) ? items : []).map((q: unknown) => {
        const o = q && typeof q === 'object' ? (q as Record<string, unknown>) : {};
        const inst = o.instrument as Record<string, unknown> | undefined;
        const sym = (o.symbol ?? inst?.symbol) as string | undefined;
        const last = (o.last ?? o.mark) as number | undefined;
        const prev = (o.previous_close ?? o['previous-close']) as number | undefined;
        const change = last != null && prev != null ? last - prev : null;
        const changePct = last != null && prev != null && prev !== 0 ? ((last - prev) / prev) * 100 : null;
        return {
          symbol: sym ?? '—',
          last,
          change,
          change_pct: changePct != null ? `${changePct.toFixed(2)}%` : null,
          in_theta_policy: sym ? inPolicy.has(String(sym).toUpperCase()) : false,
        };
      });
      return JSON.stringify({ watchlist: name, symbols: syms, quotes: rows });
    }

    return JSON.stringify({ error: 'Unknown action.' });
  },
});
