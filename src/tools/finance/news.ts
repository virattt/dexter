import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';

export const getCompanyNews = new DynamicStructuredTool({
  name: 'get_company_news',
  description:
    'Retrieves recent news articles for a stock ticker via Polygon, including title, author, publisher, description, published date, article URL, and related tickers. Use for company catalysts, price move explanations, and recent announcements.',
  schema: z.object({
    ticker: z
      .string()
      .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
    limit: z
      .number()
      .default(5)
      .describe('Maximum number of news articles to return (default: 5, max: 10).'),
  }),
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const { data, url } = await api.get('/v2/reference/news', {
      ticker,
      limit: Math.min(input.limit, 10),
      order: 'desc',
      sort: 'published_utc',
    });
    return formatToolResult(data.results || [], [url]);
  },
});
