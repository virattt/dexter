import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { jquants } from '../../../utils/jquants.js';
import { formatToolResult } from '../../types.js';

export const JP_STOCK_PRICE_DESCRIPTION = `
日本株の日次株価データを取得する（J-Quants API v2）。
終値・出来高・前日比・移動平均（5日/25日/75日）を算出。
銘柄コードは4桁数字（例: 7203=トヨタ）。
Freeプランのデータ範囲は約2年分。最新の株価はWeb検索で補完すること。
`.trim();

const schema = z.object({
  code: z
    .string()
    .describe('銘柄コード（4桁数字、例: 7203）'),
  from: z
    .string()
    .describe('開始日（YYYYMMDD形式、例: 20250101）'),
  to: z
    .string()
    .describe('終了日（YYYYMMDD形式、例: 20250331）'),
});

/** V2 API response row (short column names) */
interface V2Bar {
  Date: string;
  Code: string;
  O: number;
  H: number;
  L: number;
  C: number;
  Vo: number;
  Va: number;
  AdjO: number;
  AdjH: number;
  AdjL: number;
  AdjC: number;
  AdjVo: number;
  AdjFactor: number;
  [k: string]: unknown;
}

/**
 * Normalize V2 short column names to readable names and calculate indicators.
 */
function enrichPrices(bars: V2Bar[]): Array<Record<string, unknown>> {
  return bars.map((bar, i) => {
    const close = bar.AdjC ?? bar.C;

    const sma = (window: number) => {
      if (i < window - 1) return null;
      const slice = bars.slice(i - window + 1, i + 1);
      const avg = slice.reduce((sum, x) => sum + (x.AdjC ?? x.C), 0) / window;
      return Math.round(avg * 100) / 100;
    };

    const prevClose = i > 0 ? (bars[i - 1]!.AdjC ?? bars[i - 1]!.C) : null;
    const change = prevClose !== null ? Math.round((close - prevClose) * 100) / 100 : null;
    const changePct = prevClose !== null && prevClose !== 0
      ? Math.round(((close - prevClose) / prevClose) * 10000) / 100
      : null;

    return {
      date: bar.Date,
      code: bar.Code,
      open: bar.O,
      high: bar.H,
      low: bar.L,
      close: bar.C,
      volume: bar.Vo,
      turnover: bar.Va,
      adj_close: bar.AdjC,
      adj_factor: bar.AdjFactor,
      change,
      change_pct: changePct,
      sma_5: sma(5),
      sma_25: sma(25),
      sma_75: sma(75),
    };
  });
}

export const jpStockPrice = new DynamicStructuredTool({
  name: 'jp_stock_price',
  description: JP_STOCK_PRICE_DESCRIPTION,
  schema,
  func: async (input) => {
    const code = input.code.trim();
    const { data, url } = await jquants.get('/v2/equities/bars/daily', {
      code,
      from: input.from,
      to: input.to,
    });

    // V2 returns { data: [...] }
    const bars = (data as { data?: V2Bar[] }).data || [];
    const enriched = enrichPrices(bars);

    return formatToolResult(enriched, [url]);
  },
});
