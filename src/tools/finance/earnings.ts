/**
 * J-Quants v2 決算発表カレンダーツール
 * /equities/earnings-calendar で決算発表予定日・企業を取得。
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { jquantsApi } from './jquants-api.js';
import { formatToolResult } from '../types.js';

const EarningsInputSchema = z.object({
  code: z
    .string()
    .optional()
    .describe("銘柄の証券コード（4桁）。省略すると近日中の決算発表一覧を返します。"),
});

export const getEarnings = new DynamicStructuredTool({
  name: 'get_earnings',
  description:
    '日本株の決算発表予定・最新決算情報を取得します。特定銘柄の決算日、または近日中の決算発表スケジュールを確認できます。',
  schema: EarningsInputSchema,
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {};
    if (input.code) {
      params.code = input.code.trim().padStart(4, '0');
    }

    const { data, url } = await jquantsApi.get('/equities/earnings-calendar', params);
    const announcements = (data.data as Record<string, unknown>[] | undefined) ?? [];

    const result = announcements.map((a) => ({
      date: a.Date,
      code: a.Code,
      companyName: a.CoName,
      fiscalYearEnd: a.FY,
      fiscalQuarter: a.FQ,
      sector: a.SectorNm,
      market: a.Section,
    }));

    return formatToolResult(result, [url]);
  },
});
