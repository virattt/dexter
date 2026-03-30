import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { edinetDb } from '../../../utils/edinetdb.js';
import { formatToolResult } from '../../types.js';

export const JP_EARNINGS_DESCRIPTION = `
日本企業の決算短信（TDNet）データを取得する。
直近の四半期/通期速報値・前年同期比・業績予想修正など。
`.trim();

const schema = z.object({
  edinet_code: z
    .string()
    .describe('EDINETコード（例: E02144）。jp_search_companyで取得可能'),
});

export const jpEarnings = new DynamicStructuredTool({
  name: 'jp_earnings',
  description: JP_EARNINGS_DESCRIPTION,
  schema,
  func: async (input) => {
    const code = input.edinet_code.trim();
    const { data, url } = await edinetDb.get(`/v1/companies/${code}/earnings`);
    return formatToolResult(data, [url]);
  },
});
