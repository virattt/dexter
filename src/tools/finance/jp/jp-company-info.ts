import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { edinetDb } from '../../../utils/edinetdb.js';
import { formatToolResult } from '../../types.js';

export const JP_COMPANY_INFO_DESCRIPTION = `
日本企業の詳細情報を取得する。社名、業種、会計基準、証券コード、最新決算短信サマリーなど。
edinet_codeが必要。jp_search_companyで事前に取得すること。
`.trim();

const schema = z.object({
  edinet_code: z
    .string()
    .describe('EDINETコード（例: E02144）。jp_search_companyで取得可能'),
});

export const jpCompanyInfo = new DynamicStructuredTool({
  name: 'jp_company_info',
  description: JP_COMPANY_INFO_DESCRIPTION,
  schema,
  func: async (input) => {
    const code = input.edinet_code.trim();
    const { data, url } = await edinetDb.get(`/v1/companies/${code}`);
    return formatToolResult(data, [url]);
  },
});
