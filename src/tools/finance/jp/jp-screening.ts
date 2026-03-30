import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { edinetDb } from '../../../utils/edinetdb.js';
import { formatToolResult } from '../../types.js';
import { logger } from '../../../utils/logger.js';

export const JP_SCREENING_DESCRIPTION = `
日本株スクリーニングツール。複数の財務条件で銘柄を絞り込む。
例: 「PBR1倍以下 & ROE10%以上 & 配当利回り3%以上」
企業一覧はキャッシュされるので、2回目以降は高速。
APIリクエスト数を節約するために、可能な限りjp_rankingツールの利用を検討すること。
`.trim();

// Cached company list (fetched once per session)
let companyListCache: Array<Record<string, unknown>> | null = null;

const schema = z.object({
  conditions: z
    .array(
      z.object({
        field: z.string().describe('フィルタするフィールド名（例: pbr, roe, dividend_yield, per, equity_ratio, operating_margin）'),
        operator: z.enum(['>', '>=', '<', '<=', '==']).describe('比較演算子'),
        value: z.number().describe('閾値'),
      }),
    )
    .describe('スクリーニング条件の配列'),
  sort_by: z
    .string()
    .optional()
    .describe('ソートするフィールド名（例: roe）。降順でソートされる'),
  limit: z
    .number()
    .default(20)
    .describe('結果件数（デフォルト: 20）'),
});

async function getCompanyList(): Promise<Array<Record<string, unknown>>> {
  if (companyListCache) return companyListCache;

  logger.info('[JP Screening] fetching company list (one-time, will be cached)');
  const { data } = await edinetDb.get('/v1/companies', { per_page: 5000 });
  const companies = (data as { companies?: unknown[] }).companies || (data as unknown[]);
  companyListCache = companies as Array<Record<string, unknown>>;
  return companyListCache;
}

function compareValue(actual: unknown, operator: string, threshold: number): boolean {
  if (actual === null || actual === undefined) return false;
  const num = Number(actual);
  if (isNaN(num)) return false;

  switch (operator) {
    case '>': return num > threshold;
    case '>=': return num >= threshold;
    case '<': return num < threshold;
    case '<=': return num <= threshold;
    case '==': return num === threshold;
    default: return false;
  }
}

export const jpScreening = new DynamicStructuredTool({
  name: 'jp_screening',
  description: JP_SCREENING_DESCRIPTION,
  schema,
  func: async (input) => {
    const companies = await getCompanyList();

    // Filter
    let filtered = companies.filter((company) =>
      input.conditions.every((cond) =>
        compareValue(company[cond.field], cond.operator, cond.value),
      ),
    );

    // Sort
    if (input.sort_by) {
      const sortField = input.sort_by;
      filtered.sort((a, b) => {
        const va = Number(a[sortField]) || 0;
        const vb = Number(b[sortField]) || 0;
        return vb - va; // Descending
      });
    }

    // Limit
    filtered = filtered.slice(0, input.limit);

    return formatToolResult(
      { count: filtered.length, companies: filtered },
      ['https://edinetdb.jp/v1/companies'],
    );
  },
});
