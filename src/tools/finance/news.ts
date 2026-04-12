import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';
import { TTL_15M } from './utils.js';

const CompanyNewsInputSchema = z.object({
  ticker: z
    .string()
    .optional()
    .describe("The stock ticker symbol (e.g., 'AAPL'). Omit for broad market news."),
  limit: z
    .number()
    .default(5)
    .describe('Maximum number of news articles to return (default: 5, max: 10).'),
});

export const getCompanyNews = new DynamicStructuredTool({
  name: 'get_company_news',
  description:
    'Retrieves recent news headlines, including title, source, publication date, and URL. Pass a ticker for company-specific news, or omit the ticker for broad market news covering macro, rates, earnings, geopolitics, and more. Also useful when trying to explain broad price moves — omit the ticker to check for market-wide catalysts.',
  schema: CompanyNewsInputSchema,
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker?.trim().toUpperCase(),
      limit: Math.min(input.limit, 10),
    };
    const { data, url } = await api.get('/news', params, { cacheable: true, ttlMs: TTL_15M });
    return formatToolResult((data.news as unknown[]) || [], [url]);
  },
});
