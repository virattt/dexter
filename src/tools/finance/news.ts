import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import {
  getCompanyNews as getCompanyNewsFinnhub,
  hasFinnhubKey,
  isFdRetryableWithFallback,
} from './finnhub.js';
import { formatToolResult } from '../types.js';

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
    const ticker = input.ticker.trim().toUpperCase();
    const limit = Math.min(input.limit, 10);
    const params: Record<string, string | number | undefined> = { ticker, limit };
    try {
      const { data, url } = await callApi('/news', params);
      return formatToolResult((data.news as unknown[]) || [], [url]);
    } catch (fdError) {
      if (isFdRetryableWithFallback(fdError) && hasFinnhubKey()) {
        const to = new Date();
        const from = new Date(to);
        from.setDate(from.getDate() - 30);
        const fromStr = from.toISOString().slice(0, 10);
        const toStr = to.toISOString().slice(0, 10);
        const news = await getCompanyNewsFinnhub(ticker, fromStr, toStr, limit);
        return formatToolResult(news, ['https://finnhub.io']);
      }
      throw fdError;
    }
  },
});
