import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { edinetDb } from '../../../utils/edinetdb.js';
import { formatToolResult } from '../../types.js';

export const JP_ANALYSIS_DESCRIPTION = `
日本企業の財務健全性分析を取得する。
ヘルススコア(0-100)・主要指標サマリー・業種ベンチマーク・AI所見。
`.trim();

const schema = z.object({
  edinet_code: z
    .string()
    .describe('EDINETコード（例: E02144）。jp_search_companyで取得可能'),
});

export const jpAnalysis = new DynamicStructuredTool({
  name: 'jp_analysis',
  description: JP_ANALYSIS_DESCRIPTION,
  schema,
  func: async (input) => {
    const code = input.edinet_code.trim();
    const { data, url } = await edinetDb.get(`/v1/companies/${code}/analysis`);
    return formatToolResult(data, [url]);
  },
});
