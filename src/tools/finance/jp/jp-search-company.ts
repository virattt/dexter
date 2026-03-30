import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { edinetDb } from '../../../utils/edinetdb.js';
import { formatToolResult } from '../../types.js';

export const JP_SEARCH_COMPANY_DESCRIPTION = `
企業検索ツール。企業名（日本語OK）、証券コード（4桁）、EDINETコードで日本企業を検索する。
他の日本株ツール（jp_financials, jp_earnings等）で使うedinet_codeを取得するために最初に使う。
`.trim();

const schema = z.object({
  query: z
    .string()
    .describe('検索クエリ。企業名（例: トヨタ）、証券コード（例: 7203）、EDINETコード（例: E02144）'),
});

export const jpSearchCompany = new DynamicStructuredTool({
  name: 'jp_search_company',
  description: JP_SEARCH_COMPANY_DESCRIPTION,
  schema,
  func: async (input) => {
    const { data, url } = await edinetDb.get('/v1/search', { q: input.query.trim() });
    return formatToolResult(data, [url]);
  },
});
