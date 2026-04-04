/**
 * 日本株スクリーニングツール（クライアントサイド）
 *
 * J-Quants API v2 にはサーバーサイドスクリーナーがないため、
 * /fins/summary データをクライアントサイドでフィルタリングします。
 * 自然言語クエリはLLM不要のルールベースパーサーで処理します。
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { fetchFinancialSummary } from './providers/fundamentals.js';
import { fetchCompanyMaster } from './providers/company-master.js';
import { fetchPrices } from './providers/index.js';

export const SCREEN_STOCKS_DESCRIPTION = `
日本株のスクリーニングを行います。財務条件を自然言語で指定すると、条件に合致する銘柄を返します。

## 使用すべき場面

- 財務条件でのスクリーニング（例: 「PBR1倍以下で配当利回り3%以上」）
- バリュー株・高配当株・成長株などのスクリーニング
- PER・PBR・ROE・配当利回り・自己資本比率などで絞り込み
- 東証プライム・スタンダード・グロースの銘柄を対象

## 使用しない場面

- 特定銘柄の財務データ取得（get_financials ツールを使用）
- 株価データのみ（get_stock_price を使用）

## 注意事項

- 結果取得に数十秒かかる場合があります（全銘柄を取得して絞り込むため）
- デフォルトで上位20件を返します
`.trim();

// ============================================================================
// Types
// ============================================================================

type Operator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
type Field = 'per' | 'pbr' | 'roe' | 'roa' | 'dividendYield' | 'operatingMargin' | 'equityRatio' | 'eps' | 'bps';

interface FilterItem {
  field: Field;
  operator: Operator;
  value: number;
}

interface ScreeningFilters {
  filters: FilterItem[];
  market: 'Prime' | 'Standard' | 'Growth' | 'All';
  limit: number;
  orderBy?: Field;
  orderDesc?: boolean;
}

// ============================================================================
// Rule-based natural language parser (no LLM needed)
// ============================================================================

function parseScreeningQuery(query: string): ScreeningFilters {
  const filters: FilterItem[] = [];
  let market: 'Prime' | 'Standard' | 'Growth' | 'All' = 'Prime';
  let limit = 20;
  let orderBy: Field | undefined;
  let orderDesc = false;

  // ── Market detection ──────────────────────────────────────────────────────
  if (/スタンダード|standard/i.test(query)) market = 'Standard';
  else if (/グロース|growth/i.test(query)) market = 'Growth';
  else if (/全市場|all(?:\s*市場)?/i.test(query)) market = 'All';
  else if (/プライム|prime/i.test(query)) market = 'Prime';

  // ── Limit detection ───────────────────────────────────────────────────────
  const limitMatch = query.match(/上位\s*(\d+)\s*件/);
  if (limitMatch) limit = parseInt(limitMatch[1], 10);

  // ── Order by detection ────────────────────────────────────────────────────
  if (/配当.*(?:高い順|降順|大きい順)|高配当.*順/i.test(query)) { orderBy = 'dividendYield'; orderDesc = true; }
  else if (/配当.*(?:低い順|昇順)/i.test(query)) { orderBy = 'dividendYield'; orderDesc = false; }
  else if (/pbr.*(?:低い順|昇順)|低pbr.*順/i.test(query)) { orderBy = 'pbr'; orderDesc = false; }
  else if (/per.*(?:低い順|昇順)|低per.*順/i.test(query)) { orderBy = 'per'; orderDesc = false; }
  else if (/roe.*(?:高い順|降順)/i.test(query)) { orderBy = 'roe'; orderDesc = true; }

  // ── Field definitions: [regex to find field, fieldName, implicit condition if no number] ──
  const fieldDefs: Array<{ pattern: RegExp; field: Field; implicitGte?: number; implicitLte?: number }> = [
    { pattern: /配当利回り/, field: 'dividendYield' },
    { pattern: /営業利益率/, field: 'operatingMargin' },
    { pattern: /自己資本比率/, field: 'equityRatio' },
    { pattern: /ROE|自己資本利益率/i, field: 'roe' },
    { pattern: /ROA|総資産利益率/i, field: 'roa' },
    { pattern: /PBR|株価純資産倍率/i, field: 'pbr', implicitLte: 1.0 },
    { pattern: /PER|株価収益率/i, field: 'per' },
    { pattern: /\bEPS\b/i, field: 'eps' },
    { pattern: /\bBPS\b/i, field: 'bps' },
  ];

  for (const def of fieldDefs) {
    const match = query.match(def.pattern);
    if (!match) continue;

    const idx = query.search(def.pattern);
    // Extract a window of text around the match for number/operator detection
    const pre = query.slice(Math.max(0, idx - 25), idx);
    const post = query.slice(idx + match[0].length, idx + match[0].length + 25);
    const window = pre + match[0] + post;

    const filter = extractCondition(window, def.field);
    if (filter) {
      filters.push(filter);
    } else if (def.implicitLte !== undefined && /低\w{0,4}$|割れ|以下|以内/.test(window)) {
      filters.push({ field: def.field, operator: 'lte', value: def.implicitLte });
    } else if (def.implicitGte !== undefined) {
      filters.push({ field: def.field, operator: 'gte', value: def.implicitGte });
    }
  }

  // ── Implicit keyword shortcuts ─────────────────────────────────────────────
  if (/高配当(?!利回り)/.test(query) && !filters.some((f) => f.field === 'dividendYield')) {
    filters.push({ field: 'dividendYield', operator: 'gte', value: 3.0 });
  }
  if (/低PBR(?![\d%])/.test(query) && !filters.some((f) => f.field === 'pbr')) {
    filters.push({ field: 'pbr', operator: 'lte', value: 1.0 });
  }
  if (/割安/.test(query) && !filters.some((f) => f.field === 'pbr')) {
    filters.push({ field: 'pbr', operator: 'lte', value: 1.5 });
  }

  return { filters, market, limit, orderBy, orderDesc };
}

/** テキスト断片から数値と演算子を抽出 */
function extractCondition(text: string, field: Field): FilterItem | null {
  // "3%以上", "1倍以下", "10以上", "3.5%超", "20倍未満"
  const m = text.match(/(\d+(?:\.\d+)?)\s*[%倍円]?\s*(以上|以上$|超(?:える)?|を上回る|以下|以内|未満|を下回る)/);
  if (m) {
    const value = parseFloat(m[1]);
    const opStr = m[2];
    let operator: Operator;
    if (opStr === '以上' || opStr === 'を上回る') operator = 'gte';
    else if (opStr.startsWith('超') || opStr === 'を上回る') operator = 'gt';
    else if (opStr === '以下' || opStr === '以内') operator = 'lte';
    else operator = 'lt'; // 未満
    return { field, operator, value };
  }

  // "10%を超える" or "X倍以上" patterns with field name in between
  const m2 = text.match(/(以上|以下|超|未満|以内)\s*(\d+(?:\.\d+)?)/);
  if (m2) {
    const value = parseFloat(m2[2]);
    const opStr = m2[1];
    let operator: Operator;
    if (opStr === '以上') operator = 'gte';
    else if (opStr === '超') operator = 'gt';
    else if (opStr === '以下' || opStr === '以内') operator = 'lte';
    else operator = 'lt';
    return { field, operator, value };
  }

  return null;
}

// ============================================================================
// Tool definition
// ============================================================================

const ScreenStocksInputSchema = z.object({
  query: z.string().describe('スクリーニング条件を自然言語で記述'),
});

export function createScreenStocks(_model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'stock_screener',
    description: `日本株のスクリーニング。自然言語で財務条件を指定すると条件に合致する銘柄を返します。使用例:
- PBR1倍以下の東証プライム銘柄
- 配当利回り3%以上でROE10%以上の銘柄
- 営業利益率15%以上の銘柄`,
    schema: ScreenStocksInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // Step 1: Parse query with rule-based parser (no LLM)
      const filters = parseScreeningQuery(input.query);

      if (filters.filters.length === 0) {
        return formatToolResult(
          { error: 'スクリーニング条件を認識できませんでした。例: 「PBR1倍以下でROE10%以上」のように指定してください。', parsed: filters },
          [],
        );
      }

      onProgress?.(`条件を解析しました: ${filters.filters.map((f) => `${f.field} ${f.operator} ${f.value}`).join(', ')} (${filters.market}市場)`);

      // Step 2: Fetch listed companies via /equities/master
      onProgress?.('上場企業一覧を取得中...');
      let listedCodes: string[];
      try {
        const { companies } = await fetchCompanyMaster();
        listedCodes = companies
          .filter((c) => filters.market === 'All' || c.market === filters.market)
          .map((c) => c.code);
        listedCodes = [...new Set(listedCodes)];
      } catch (error) {
        return formatToolResult(
          { error: '上場企業一覧の取得に失敗しました', details: error instanceof Error ? error.message : String(error) },
          [],
        );
      }

      // Step 3: Fetch financial summaries (batch, cached)
      onProgress?.(`財務データを取得中（対象${listedCodes.length}社）...`);
      const BATCH = 20;
      const results: Record<string, unknown>[] = [];
      const codeList = listedCodes.slice(0, 500);
      const needsPrice = filters.filters.some((f) => ['per', 'pbr', 'dividendYield'].includes(f.field));

      for (let i = 0; i < codeList.length; i += BATCH) {
        const batch = codeList.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (code) => {
            try {
              const { records } = await fetchFinancialSummary(code, 'annual', 1);
              const latest = records[0];
              if (!latest) return;

              const eps = latest.eps ?? 0;
              const bps = latest.bps ?? 0;
              const divAnn = latest.dividendPerShare ?? 0;
              const netIncome = latest.netIncome ?? 0;
              const equity = latest.equity ?? 0;
              const totalAssets = latest.totalAssets ?? 0;
              const sales = latest.netSales ?? 0;
              const opProfit = latest.operatingProfit ?? 0;
              const eqAR = latest.equityToAssetRatio != null ? latest.equityToAssetRatio / 100 : 0;

              let price: number | null = null;
              if (needsPrice) {
                for (const monthsBack of [0, 3, 6]) {
                  const to = new Date();
                  to.setMonth(to.getMonth() - monthsBack);
                  const from = new Date(to);
                  from.setDate(from.getDate() - 30);
                  try {
                    const { records: priceRecords } = await fetchPrices(
                      code,
                      from.toISOString().slice(0, 10),
                      to.toISOString().slice(0, 10),
                    );
                    if (priceRecords.length > 0) {
                      const last = priceRecords[priceRecords.length - 1]!;
                      price = last.adjustmentClose ?? last.close;
                      break;
                    }
                  } catch { /* try next offset */ }
                }
              }

              const metrics: Record<string, number | null> = {
                per: price && eps > 0 ? Math.round((price / eps) * 10) / 10 : null,
                pbr: price && bps > 0 ? Math.round((price / bps) * 100) / 100 : null,
                roe: equity > 0 ? Math.round((netIncome / equity) * 1000) / 10 : null,
                roa: totalAssets > 0 ? Math.round((netIncome / totalAssets) * 1000) / 10 : null,
                dividendYield: price && divAnn > 0 ? Math.round((divAnn / price) * 10000) / 100 : null,
                operatingMargin: sales > 0 ? Math.round((opProfit / sales) * 1000) / 10 : null,
                equityRatio: eqAR ? Math.round(eqAR * 1000) / 10 : null,
                eps,
                bps,
              };

              const passes = filters.filters.every((f) => {
                const v = metrics[f.field];
                if (v === null || v === undefined) return false;
                switch (f.operator) {
                  case 'gt': return v > f.value;
                  case 'gte': return v >= f.value;
                  case 'lt': return v < f.value;
                  case 'lte': return v <= f.value;
                  case 'eq': return v === f.value;
                  default: return false;
                }
              });

              if (passes) {
                results.push({ code, fiscalYearEnd: latest.fiscalYearEnd, price, ...metrics });
              }
            } catch { /* skip */ }
          }),
        );
        if (i % 100 === 0 && i > 0) {
          onProgress?.(`財務データを取得中... ${i}/${codeList.length}社`);
        }
      }

      // Sort
      if (filters.orderBy) {
        const field = filters.orderBy;
        const desc = filters.orderDesc ?? false;
        results.sort((a, b) => {
          const av = a[field] as number | null;
          const bv = b[field] as number | null;
          if (av === null) return 1;
          if (bv === null) return -1;
          return desc ? bv - av : av - bv;
        });
      }

      const limited = results.slice(0, filters.limit);
      return formatToolResult({ count: results.length, results: limited, filters: filters.filters }, []);
    },
  });
}
