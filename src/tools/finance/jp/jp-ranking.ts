import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { edinetDb } from '../../../utils/edinetdb.js';
import { formatToolResult } from '../../types.js';

const VALID_METRICS = [
  'roe', 'operating-margin', 'net-margin', 'roa', 'equity-ratio',
  'per', 'eps', 'dividend-yield', 'payout-ratio', 'revenue',
  'health-score', 'revenue-growth', 'ni-growth', 'eps-growth',
  'revenue-cagr-3y', 'oi-cagr-3y', 'ni-cagr-3y', 'eps-cagr-3y',
] as const;

export const JP_RANKING_DESCRIPTION = `
日本企業のランキングを取得する。18指標に対応。
指標: roe, operating-margin, net-margin, roa, equity-ratio, per, eps,
dividend-yield, payout-ratio, revenue, health-score, revenue-growth,
ni-growth, eps-growth, revenue-cagr-3y, oi-cagr-3y, ni-cagr-3y, eps-cagr-3y
`.trim();

const schema = z.object({
  metric: z
    .enum(VALID_METRICS)
    .describe('ランキング指標（例: roe, dividend-yield, revenue-cagr-3y）'),
  limit: z
    .number()
    .default(20)
    .describe('取得件数（デフォルト: 20）'),
});

export const jpRanking = new DynamicStructuredTool({
  name: 'jp_ranking',
  description: JP_RANKING_DESCRIPTION,
  schema,
  func: async (input) => {
    const { data, url } = await edinetDb.get(`/v1/rankings/${input.metric}`, {
      limit: input.limit,
    });
    return formatToolResult(data, [url]);
  },
});
