import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { edinetDb } from '../../../utils/edinetdb.js';
import { formatToolResult } from '../../types.js';

export const JP_FINANCIALS_DESCRIPTION = `
日本企業の財務時系列データを取得する（最大6年分）。
売上高・営業利益・純利益・ROE・PER・PBR・EPS・配当利回り・自己資本比率など69指標。
period=quarterlyで四半期データも取得可能。
`.trim();

const schema = z.object({
  edinet_code: z
    .string()
    .describe('EDINETコード（例: E02144）。jp_search_companyで取得可能'),
  period: z
    .enum(['annual', 'quarterly'])
    .default('annual')
    .describe("取得期間。'annual'=通期、'quarterly'=四半期"),
});

export const jpFinancials = new DynamicStructuredTool({
  name: 'jp_financials',
  description: JP_FINANCIALS_DESCRIPTION,
  schema,
  func: async (input) => {
    const code = input.edinet_code.trim();
    const params: Record<string, string | undefined> = {};
    if (input.period === 'quarterly') {
      params.period = 'quarterly';
    }
    const { data, url } = await edinetDb.get(`/v1/companies/${code}/financials`, params);
    return formatToolResult(data, [url]);
  },
});
