import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { runFinanceProviderChain } from './providers/fallback.js';
import { fdNews } from './providers/financialdatasets.js';
import { fmpNews } from './providers/fmp.js';
import { avNews } from './providers/alphavantage.js';

const NewsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch news for. For example, 'AAPL' for Apple."),
  start_date: z
    .string()
    .optional()
    .describe('The start date to fetch news from (YYYY-MM-DD).'),
  end_date: z.string().optional().describe('The end date to fetch news to (YYYY-MM-DD).'),
  limit: z
    .number()
    .default(10)
    .describe('The number of news articles to retrieve. Max is 100.'),
});

export const getNews = new DynamicStructuredTool({
  name: 'get_news',
  description: `Retrieves recent news articles for a given company ticker, covering financial announcements, market trends, and other significant events. Useful for staying up-to-date with market-moving information and investor sentiment.`,
  schema: NewsInputSchema,
  func: async (input) => {
    const result = await runFinanceProviderChain('get_news', [
      {
        provider: 'financialdatasets',
        run: async () => {
          const { data, url } = await fdNews({
            ticker: input.ticker,
            limit: input.limit,
            start_date: input.start_date,
            end_date: input.end_date,
          });
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'fmp',
        run: async () => {
          const { data, url } = await fmpNews({
            ticker: input.ticker,
            limit: input.limit,
            start_date: input.start_date,
            end_date: input.end_date,
          });
          return { data, sourceUrls: [url] };
        },
      },
      {
        provider: 'alphavantage',
        run: async () => {
          const { data, url } = await avNews({
            ticker: input.ticker,
            limit: input.limit,
            start_date: input.start_date,
            end_date: input.end_date,
          });
          return { data, sourceUrls: [url] };
        },
      },
    ]);

    return formatToolResult(result.data, result.sourceUrls);
  },
});
