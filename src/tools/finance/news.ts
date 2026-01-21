import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

/**
 * Transform Alpha Vantage news item to consistent format
 */
function transformNewsItem(item: Record<string, unknown>): Record<string, unknown> {
  const tickerSentiment = item['ticker_sentiment'] as Array<Record<string, string>> || [];

  return {
    title: item['title'],
    url: item['url'],
    timePublished: item['time_published'],
    authors: item['authors'],
    summary: item['summary'],
    source: item['source'],
    sourceDomain: item['source_domain'],
    overallSentimentScore: parseFloat(String(item['overall_sentiment_score'] || 0)),
    overallSentimentLabel: item['overall_sentiment_label'],
    tickerSentiment: tickerSentiment.map((ts) => ({
      ticker: ts['ticker'],
      relevanceScore: parseFloat(ts['relevance_score'] || '0'),
      sentimentScore: parseFloat(ts['ticker_sentiment_score'] || '0'),
      sentimentLabel: ts['ticker_sentiment_label'],
    })),
  };
}

const NewsInputSchema = z.object({
  tickers: z
    .string()
    .describe(
      "Stock ticker symbol(s) to fetch news for. For single ticker: 'AAPL'. For multiple tickers, separate with commas: 'AAPL,MSFT,GOOGL'."
    ),
  topics: z
    .string()
    .optional()
    .describe(
      "News topics to filter by. Options: blockchain, earnings, ipo, mergers_and_acquisitions, financial_markets, economy_fiscal, economy_monetary, economy_macro, energy_transportation, finance, life_sciences, manufacturing, real_estate, retail_wholesale, technology. Separate multiple with commas."
    ),
  time_from: z
    .string()
    .optional()
    .describe(
      "Start time for news articles in YYYYMMDDTHHMM format (e.g., '20240115T0000'). Defaults to last 24 hours if not specified."
    ),
  time_to: z
    .string()
    .optional()
    .describe("End time for news articles in YYYYMMDDTHHMM format (e.g., '20240116T2359')."),
  sort: z
    .enum(['LATEST', 'EARLIEST', 'RELEVANCE'])
    .default('LATEST')
    .describe("Sort order for results. 'LATEST' for most recent first, 'EARLIEST' for oldest first, 'RELEVANCE' for most relevant."),
  limit: z
    .number()
    .default(10)
    .describe('The number of news articles to retrieve (default: 10, max: 1000).'),
});

export const getNews = new DynamicStructuredTool({
  name: 'get_news',
  description: `Retrieves news articles with sentiment analysis for given stock ticker(s). Each article includes:
- Title, summary, source, URL, and publication time
- Overall sentiment score and label (Bearish/Somewhat-Bearish/Neutral/Somewhat-Bullish/Bullish)
- Per-ticker sentiment scores and relevance
Useful for staying up-to-date with market-moving information and gauging investor sentiment.`,
  schema: NewsInputSchema,
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {
      tickers: input.tickers,
      topics: input.topics,
      time_from: input.time_from,
      time_to: input.time_to,
      sort: input.sort,
      limit: input.limit,
    };
    const { data, url } = await callApi('NEWS_SENTIMENT', params);

    const feed = data['feed'] as Array<Record<string, unknown>> || [];
    const result = {
      itemsReturned: data['items'],
      sentimentScoreDefinition: data['sentiment_score_definition'],
      relevanceScoreDefinition: data['relevance_score_definition'],
      articles: feed.map(transformNewsItem),
    };

    return formatToolResult(result, [url]);
  },
});
