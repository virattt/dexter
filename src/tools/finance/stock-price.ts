import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { fetchPrices, fetchLatestPrice } from './providers/index.js';

export const STOCK_PRICE_DESCRIPTION = `
日本株の株価データを取得します（J-Quants API v2使用）。
日次株価（始値・高値・安値・終値・出来高・調整後終値）を取得できます。
注意: フリープランは直近約2年分のデータが対象です。
`.trim();

// ============================================================================
// 現在株価スナップショット（最新の取引日）
// ============================================================================

const StockPriceInputSchema = z.object({
  code: z
    .string()
    .describe("取得する銘柄の証券コード（4桁）。例: '7203' はトヨタ自動車。"),
});

export const getStockPrice = new DynamicStructuredTool({
  name: 'get_stock_price',
  description: '日本株の最新株価スナップショットを取得します（始値・高値・安値・終値・出来高）。証券コード（4桁）で指定。',
  schema: StockPriceInputSchema,
  func: async (input) => {
    const code = input.code.trim().padStart(4, '0');
    const { price, url, provider } = await fetchLatestPrice(code);
    if (price === null) {
      return formatToolResult({ error: `証券コード ${code} の株価データが見つかりません` }, []);
    }
    return formatToolResult({ code, price, provider }, [url]);
  },
});

// ============================================================================
// 期間指定の日次株価
// ============================================================================

const StockPricesInputSchema = z.object({
  code: z
    .string()
    .describe("取得する銘柄の証券コード（4桁）。例: '7203' はトヨタ自動車。"),
  from: z.string().describe('開始日（YYYY-MM-DD形式）。'),
  to: z.string().describe('終了日（YYYY-MM-DD形式）。'),
});

export const getStockPrices = new DynamicStructuredTool({
  name: 'get_stock_prices',
  description: '日本株の期間指定の日次株価一覧を取得します（始値・高値・安値・終値・出来高・調整後終値）。',
  schema: StockPricesInputSchema,
  func: async (input) => {
    const code = input.code.trim().padStart(4, '0');
    const { records, url, provider } = await fetchPrices(code, input.from, input.to);
    return formatToolResult({ provider, quotes: records.map(mapQuote) }, [url]);
  },
});

// ============================================================================
// ヘルパー: J-Quants v2 レスポンス → 読みやすい形式
// ============================================================================

function mapQuote(q: Record<string, unknown>): Record<string, unknown> {
  return {
    date: q.Date,
    code: q.Code,
    open: q.O,
    high: q.H,
    low: q.L,
    close: q.C,
    volume: q.Vo,
    turnoverValue: q.Va,
    adjustmentClose: q.AdjC,
    adjustmentVolume: q.AdjVo,
    adjustmentFactor: q.AdjFactor,
  };
}
