import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

const NewsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch news for. For example, 'AAPL' for Apple."),
  start_date: z
    .string()
    .optional()
    .describe('The start date to fetch news from (YYYY-MM-DD). Defaults to 7 days ago.'),
  end_date: z.string().optional().describe('The end date to fetch news to (YYYY-MM-DD). Defaults to today.'),
  limit: z
    .number()
    .default(10)
    .describe('The number of news articles to retrieve (default: 10, max: 50).'),
});

export const getNews = new DynamicStructuredTool({
  name: 'get_news',
  description: `Retrieves recent company news from Finnhub. Returns headlines, summaries, source, publication date, and URLs. Requires FINNHUB_API_KEY environment variable.`,
  schema: NewsInputSchema,
  func: async (input) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      return formatToolResult(
        { error: 'FINNHUB_API_KEY environment variable is not set. Cannot fetch news.' },
        []
      );
    }

    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 7);

    const startDate = input.start_date ?? defaultStart.toISOString().split('T')[0];
    const endDate = input.end_date ?? now.toISOString().split('T')[0];
    const ticker = input.ticker.toUpperCase();

    const url = `${FINNHUB_BASE_URL}/company-news?symbol=${ticker}&from=${startDate}&to=${endDate}&token=${apiKey}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Finnhub network error: ${message}`);
      throw new Error(`Finnhub request failed: ${message}`);
    }

    if (!response.ok) {
      const detail = `${response.status} ${response.statusText}`;
      logger.error(`Finnhub error: ${detail}`);
      throw new Error(`Finnhub request failed: ${detail}`);
    }

    const articles = (await response.json()) as Array<{
      category: string;
      datetime: number;
      headline: string;
      id: number;
      image: string;
      related: string;
      source: string;
      summary: string;
      url: string;
    }>;

    const maxLimit = Math.min(input.limit, 50);
    const limited = articles.slice(0, maxLimit).map((article) => ({
      headline: article.headline,
      summary: article.summary,
      source: article.source,
      publishedAt: new Date(article.datetime * 1000).toISOString(),
      url: article.url,
      category: article.category,
    }));

    const sourceUrls = limited.map((a) => a.url);
    return formatToolResult(limited, sourceUrls);
  },
});
