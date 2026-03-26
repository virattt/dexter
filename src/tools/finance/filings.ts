import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';

const FilingsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  filing_type: z
    .array(z.enum(['10-K', '10-Q', '8-K']))
    .optional()
    .describe(
      "Optional list of filing types to filter by. If omitted, returns most recent filings of any type."
    ),
  limit: z
    .number()
    .default(10)
    .describe('Maximum number of filings to return (default: 10).'),
});

export const getFilings = new DynamicStructuredTool({
  name: 'get_filings',
  description: `Retrieves SEC filing metadata for a company via Polygon, including filing type, filing date, accession number, and document URLs. Use to find filings and their EDGAR links. This tool returns metadata only — follow the source URLs to read actual filing content.`,
  schema: FilingsInputSchema,
  func: async (input) => {
    const params: Record<string, string | number | string[] | undefined> = {
      ticker: input.ticker.trim().toUpperCase(),
      limit: input.limit,
      type: input.filing_type?.join(','),
      order: 'desc',
      sort: 'filing_date',
    };
    const { data, url } = await api.get('/vX/reference/filings', params);
    return formatToolResult(data.results || [], [url]);
  },
});
