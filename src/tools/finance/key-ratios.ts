/**
 * J-Quants v2 を使った投資指標計算ツール。
 * /fins/summary と /equities/bars/daily を組み合わせてPER・PBR・ROE・ROA・配当利回りを算出。
 * TSE（東証）のPBR改革（PBR>1倍要求）に特に注目。
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { jquantsApi } from './jquants-api.js';
import { formatToolResult } from '../types.js';

const KeyRatiosInputSchema = z.object({
  code: z
    .string()
    .describe("銘柄の証券コード（4桁）。例: '7203' はトヨタ自動車。"),
});

/** 直近の価格を取得（フリーティアは最大2年前まで対応） */
async function fetchLatestPrice(code: string): Promise<{ price: number | null; priceUrl: string }> {
  // Try rolling back up to 6 months to find a valid price window
  const offsets = [0, 3, 6]; // months back
  for (const monthsBack of offsets) {
    const to = new Date();
    to.setMonth(to.getMonth() - monthsBack);
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    try {
      const { data, url } = await jquantsApi.get('/equities/bars/daily', {
        code,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      });
      const quotes = (data.data as Record<string, unknown>[] | undefined) ?? [];
      if (quotes.length > 0) {
        const lq = quotes[quotes.length - 1];
        return { price: Number(lq.AdjC ?? lq.C), priceUrl: url };
      }
    } catch { /* try next offset */ }
  }
  return { price: null, priceUrl: '' };
}

export const getKeyRatios = new DynamicStructuredTool({
  name: 'get_key_ratios',
  description:
    '日本株の主要投資指標スナップショットを取得します。PER・PBR・ROE・ROA・配当利回り・自己資本比率などを含みます。東証PBR改革の観点からPBRに特に注目。',
  schema: KeyRatiosInputSchema,
  func: async (input) => {
    const code = input.code.trim().padStart(4, '0');

    // Fetch latest annual financial summary
    const { data: finData, url: finUrl } = await jquantsApi.get(
      '/fins/summary',
      { code },
      { cacheable: true },
    );

    let records = (finData.data as Record<string, unknown>[] | undefined) ?? [];
    records = records
      .filter((s) => {
        const t = String(s.CurPerType ?? '');
        return t === 'FY' || t === '4Q' || t === 'Annual';
      })
      .sort((a, b) =>
        String(b.CurFYEn ?? b.DiscDate ?? '').localeCompare(String(a.CurFYEn ?? a.DiscDate ?? '')),
      );

    const latest = records[0];
    if (!latest) {
      return formatToolResult({ error: `証券コード ${code} の財務データが見つかりません` }, [finUrl]);
    }

    // Fetch latest stock price
    const { price, priceUrl } = await fetchLatestPrice(code);

    // Extract financial data
    const eps = Number(latest.EPS ?? 0);
    const bps = Number(latest.BPS ?? 0);
    const divAnn = Number(latest.DivAnn ?? 0);
    const netIncome = Number(latest.NP ?? 0);
    const equity = Number(latest.Eq ?? 0);
    const totalAssets = Number(latest.TA ?? 0);
    const sales = Number(latest.Sales ?? 0);
    const opProfit = Number(latest.OP ?? 0);
    const eqAR = Number(latest.EqAR ?? 0);

    // Calculate ratios
    const per = price && eps > 0 ? price / eps : null;
    const pbr = price && bps > 0 ? price / bps : null;
    const dividendYield = price && divAnn > 0 ? (divAnn / price) * 100 : null;
    const roe = equity > 0 ? (netIncome / equity) * 100 : null;
    const roa = totalAssets > 0 ? (netIncome / totalAssets) * 100 : null;
    const operatingMargin = sales > 0 ? (opProfit / sales) * 100 : null;
    const equityRatio = eqAR ? eqAR * 100 : null;

    const ratios = {
      code,
      fiscalYearEnd: latest.CurFYEn,
      disclosureDate: latest.DiscDate,
      price: price ? Math.round(price) : null,
      per: per ? Math.round(per * 10) / 10 : null,
      pbr: pbr ? Math.round(pbr * 100) / 100 : null,
      dividendYield: dividendYield ? Math.round(dividendYield * 100) / 100 : null,
      roe: roe ? Math.round(roe * 10) / 10 : null,
      roa: roa ? Math.round(roa * 10) / 10 : null,
      operatingMargin: operatingMargin ? Math.round(operatingMargin * 10) / 10 : null,
      equityRatio: equityRatio ? Math.round(equityRatio * 10) / 10 : null,
      eps: Math.round(eps * 10) / 10,
      bps: bps ? Math.round(bps) : null,
      dividendPerShare: divAnn,
      // TSE reform flag: TSEはPBR1倍割れ企業に改善要求
      pbrBelowOne: pbr !== null && pbr < 1.0,
    };

    const urls = [finUrl, priceUrl].filter(Boolean);
    return formatToolResult(ratios, urls);
  },
});

const HistoricalKeyRatiosInputSchema = z.object({
  code: z
    .string()
    .describe("銘柄の証券コード（4桁）。例: '7203' はトヨタ自動車。"),
  period: z
    .enum(['annual', 'quarterly'])
    .default('annual')
    .describe("'annual' は通期、'quarterly' は四半期。"),
  limit: z
    .number()
    .default(5)
    .describe('取得する期数の上限（デフォルト5）。'),
});

export const getHistoricalKeyRatios = new DynamicStructuredTool({
  name: 'get_historical_key_ratios',
  description: '日本株の過去の投資指標推移を取得します。EPS・BPS・配当・ROE・利益率などの時系列データ。',
  schema: HistoricalKeyRatiosInputSchema,
  func: async (input) => {
    const code = input.code.trim().padStart(4, '0');
    const { data, url } = await jquantsApi.get('/fins/summary', { code }, { cacheable: true });

    let records = (data.data as Record<string, unknown>[] | undefined) ?? [];

    if (input.period === 'annual') {
      records = records.filter((s) => {
        const t = String(s.CurPerType ?? '');
        return t === 'FY' || t === '4Q' || t === 'Annual';
      });
    }

    const result = records
      .sort((a, b) =>
        String(b.CurFYEn ?? b.DiscDate ?? '').localeCompare(String(a.CurFYEn ?? a.DiscDate ?? '')),
      )
      .slice(0, input.limit)
      .map((s) => {
        const netIncome = Number(s.NP ?? 0);
        const equity = Number(s.Eq ?? 0);
        const totalAssets = Number(s.TA ?? 0);
        const sales = Number(s.Sales ?? 0);
        const opProfit = Number(s.OP ?? 0);
        return {
          fiscalYearEnd: s.CurFYEn,
          period: s.CurPerType,
          eps: s.EPS,
          bps: s.BPS,
          dividendPerShare: s.DivAnn,
          roe: equity > 0 ? Math.round((netIncome / equity) * 1000) / 10 : null,
          roa: totalAssets > 0 ? Math.round((netIncome / totalAssets) * 1000) / 10 : null,
          operatingMargin: sales > 0 ? Math.round((opProfit / sales) * 1000) / 10 : null,
          equityRatio: s.EqAR ? Math.round(Number(s.EqAR) * 1000) / 10 : null,
          netSales: s.Sales,
          operatingProfit: s.OP,
          ordinaryProfit: s.OdP,
          netIncome: s.NP,
        };
      });

    return formatToolResult(result, [url]);
  },
});
