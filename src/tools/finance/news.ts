import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';
import { validateLimit, validateTicker } from './validation.js';
import { TTL_15M } from './utils.js';

const CompanyNewsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch company news for. For example, 'AAPL' for Apple."),
  limit: z
    .number()
    .default(5)
    .describe('Maximum number of news articles to return (default: 5, max: 10).'),
});

export const getCompanyNews = new DynamicStructuredTool({
  name: 'get_company_news',
  description:
    'Retrieves recent company news headlines for a stock ticker, including title, source, publication date, and URL. Use for company catalysts, price move explanations, press releases, and recent announcements.',
  schema: CompanyNewsInputSchema,
  func: async (input) => {
    const ticker = validateTicker(input.ticker);
    const limit = validateLimit(input.limit, { fieldName: 'limit', min: 1, max: 10 });

    const params: Record<string, string | number | undefined> = {
      ticker,
      limit,
    };
    const { data, url } = await api.get('/news', params, { cacheable: true, ttlMs: TTL_15M });
    return formatToolResult((data.news as unknown[]) || [], [url]);
  },
});
