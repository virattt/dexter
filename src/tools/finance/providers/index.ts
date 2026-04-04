/**
 * 株価プロバイダー抽象層
 *
 * STOCK_PROVIDER env var で切替:
 *   auto    - J-Quantsを試して失敗/空ならstooqへフォールバック（デフォルト）
 *   jquants - J-Quants API v2のみ
 *   stooq   - stooq.com のみ（無料・APIキー不要）
 */
import { jquantsApi } from '../jquants-api.js';
import { fetchStooqPrices, type QuoteRecord } from './stooq.js';

export interface PriceResult {
  records: QuoteRecord[];
  url: string;
  provider: 'jquants' | 'stooq';
}

function getProvider(): 'jquants' | 'stooq' | 'auto' {
  const p = (process.env.STOCK_PROVIDER ?? 'auto').toLowerCase();
  if (p === 'stooq') return 'stooq';
  if (p === 'jquants') return 'jquants';
  return 'auto';
}

async function fetchJQuantsPrices(
  code: string,
  from: string,
  to: string,
): Promise<{ records: QuoteRecord[]; url: string }> {
  const { data, url } = await jquantsApi.get('/equities/bars/daily', { code, from, to });
  const quotes = (data.data as Record<string, unknown>[] | undefined) ?? [];
  const records: QuoteRecord[] = quotes.map((q) => ({
    date: String(q.Date ?? ''),
    open: q.O != null ? Number(q.O) : null,
    high: q.H != null ? Number(q.H) : null,
    low: q.L != null ? Number(q.L) : null,
    close: q.C != null ? Number(q.C) : null,
    volume: q.Vo != null ? Number(q.Vo) : null,
    adjustmentClose: q.AdjC != null ? Number(q.AdjC) : null,
  }));
  return { records, url };
}

/** 株価データ取得。STOCK_PROVIDER に応じてプロバイダーを選択 */
export async function fetchPrices(code: string, from: string, to: string): Promise<PriceResult> {
  const provider = getProvider();

  if (provider === 'stooq') {
    const { records, url } = await fetchStooqPrices(code, from, to);
    return { records, url, provider: 'stooq' };
  }

  if (provider === 'jquants') {
    const { records, url } = await fetchJQuantsPrices(code, from, to);
    return { records, url, provider: 'jquants' };
  }

  // auto: J-Quantsを試して失敗か空ならstooqへ
  try {
    const { records, url } = await fetchJQuantsPrices(code, from, to);
    if (records.length > 0) return { records, url, provider: 'jquants' };
  } catch { /* fall through to stooq */ }

  const { records, url } = await fetchStooqPrices(code, from, to);
  return { records, url, provider: 'stooq' };
}

/** 最新株価を取得（直近→3ヶ月前→6ヶ月前とウィンドウをスライド） */
export async function fetchLatestPrice(
  code: string,
): Promise<{ price: number | null; url: string; provider: 'jquants' | 'stooq' }> {
  for (const monthsBack of [0, 3, 6]) {
    const to = new Date();
    to.setMonth(to.getMonth() - monthsBack);
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    try {
      const result = await fetchPrices(
        code,
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10),
      );
      if (result.records.length > 0) {
        const lq = result.records[result.records.length - 1];
        return { price: lq.adjustmentClose ?? lq.close, url: result.url, provider: result.provider };
      }
    } catch { /* try next window */ }
  }
  return { price: null, url: '', provider: 'jquants' };
}
