import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { edinetDb } from '../../../utils/edinetdb.js';
import { formatToolResult } from '../../types.js';

export const JP_TEXT_BLOCKS_DESCRIPTION = `
日本企業の有価証券報告書テキスト全文を取得する。
事業の内容・リスク情報・MD&A（経営者による財政状態、経営成績及びキャッシュ・フローの状況の分析）など。
`.trim();

const schema = z.object({
  edinet_code: z
    .string()
    .describe('EDINETコード（例: E02144）。jp_search_companyで取得可能'),
});

export const jpTextBlocks = new DynamicStructuredTool({
  name: 'jp_text_blocks',
  description: JP_TEXT_BLOCKS_DESCRIPTION,
  schema,
  func: async (input) => {
    const code = input.edinet_code.trim();
    const { data, url } = await edinetDb.get(`/v1/companies/${code}/text-blocks`);
    return formatToolResult(data, [url]);
  },
});
