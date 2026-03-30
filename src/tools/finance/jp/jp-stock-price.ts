import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { jquants } from '../../../utils/jquants.js';
import { formatToolResult } from '../../types.js';

export const JP_STOCK_PRICE_DESCRIPTION = `
日本株の日次株価データを取得する（J-Quants API）。
終値・出来高・前日比・移動平均（5日/25日/75日）を算出。
銘柄コードは4桁数字（例: 7203=トヨタ）。
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

/**
 * Calculate simple moving averages for the given close prices.
 */
function calcMovingAverages(
  prices: Array<{ Date: string; Close: number; [k: string]: unknown }>,
): Array<Record<string, unknown>> {
  return prices.map((p, i) => {
    const sma = (window: number) => {
      if (i < window - 1) return null;
      const slice = prices.slice(i - window + 1, i + 1);
      return Math.round((slice.reduce((sum, x) => sum + x.Close, 0) / window) * 100) / 100;
    };

    const prevClose = i > 0 ? prices[i - 1]!.Close : null;
    const change = prevClose !== null ? Math.round((p.Close - prevClose) * 100) / 100 : null;
    const changePct = prevClose !== null && prevClose !== 0
      ? Math.round(((p.Close - prevClose) / prevClose) * 10000) / 100
      : null;

    return {
      ...p,
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
    const { data, url } = await jquants.get('/v1/prices/daily_quotes', {
      code,
      from: input.from,
      to: input.to,
    });

    const quotes = (data as { daily_quotes?: unknown[] }).daily_quotes || [];
    const enriched = calcMovingAverages(
      quotes as Array<{ Date: string; Close: number }>,
    );

    return formatToolResult(enriched, [url]);
  },
});
