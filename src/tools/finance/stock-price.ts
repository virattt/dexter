import { DynamicStructuredTool } from '@langchain/core/tools';
import YahooFinance from 'yahoo-finance2';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { exaSearch, perplexitySearch, tavilySearch } from '../search/index.js';
import { logger } from '@/utils';

export const STOCK_PRICE_DESCRIPTION = `
Fetches current stock price snapshots for equities, including market cap and shares outstanding. Uses Yahoo Finance as the primary source and falls back to web search when Yahoo is unavailable.
`.trim();

const StockPriceInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch current price for. For example, 'AAPL' for Apple."),
});

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

interface ParsedToolResult {
  data: unknown;
  sourceUrls?: string[];
}

function parseToolResult(rawResult: string): ParsedToolResult {
  try {
    return JSON.parse(rawResult) as ParsedToolResult;
  } catch {
    return { data: rawResult };
  }
}

async function fallbackViaWebSearch(ticker: string): Promise<{ data: unknown; sourceUrls: string[] }> {
  const query = `${ticker} stock price today`;

  if (process.env.EXASEARCH_API_KEY) {
    const result = await exaSearch.invoke({ query });
    const parsed = parseToolResult(typeof result === 'string' ? result : JSON.stringify(result));
    return { data: parsed.data, sourceUrls: parsed.sourceUrls || [] };
  }

  if (process.env.PERPLEXITY_API_KEY) {
    const result = await perplexitySearch.invoke({ query });
    const parsed = parseToolResult(typeof result === 'string' ? result : JSON.stringify(result));
    return { data: parsed.data, sourceUrls: parsed.sourceUrls || [] };
  }

  if (process.env.TAVILY_API_KEY) {
    const result = await tavilySearch.invoke({ query });
    const parsed = parseToolResult(typeof result === 'string' ? result : JSON.stringify(result));
    return { data: parsed.data, sourceUrls: parsed.sourceUrls || [] };
  }

  throw new Error('No web search provider configured for fallback');
}

export const getStockPrice = new DynamicStructuredTool({
  name: 'get_stock_price',
  description:
    'Fetches the current stock price snapshot for an equity ticker, including current price, change, percent change, market cap, shares outstanding, market status, volume, and currency.',
  schema: StockPriceInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();

    try {
      const quote = await yahooFinance.quote(ticker);
      const sourceUrl = `https://finance.yahoo.com/quote/${ticker}`;

      return formatToolResult(
        {
          ticker,
          provider: 'yahoo_finance',
          regular_market_price: quote.regularMarketPrice ?? null,
          regular_market_change: quote.regularMarketChange ?? null,
          regular_market_change_percent: quote.regularMarketChangePercent ?? null,
          market_cap: quote.marketCap ?? null,
          shares_outstanding: quote.sharesOutstanding ?? null,
          currency: quote.currency ?? null,
          market_state: quote.marketState ?? null,
          regular_market_time: quote.regularMarketTime ?? null,
          regular_market_volume: quote.regularMarketVolume ?? null,
        },
        [sourceUrl]
      );
    } catch (error) {
      const yahooMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[Stock Price] Yahoo Finance failed for ${ticker}: ${yahooMessage}`);

      try {
        const fallback = await fallbackViaWebSearch(ticker);
        logger.info(`[Stock Price] using web search fallback for ${ticker}`);
        return formatToolResult(
          {
            ticker,
            provider: 'web_search_fallback',
            query: `${ticker} stock price today`,
            result: fallback.data,
          },
          fallback.sourceUrls
        );
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        logger.error(`[Stock Price] fallback failed for ${ticker}: ${fallbackMessage}`);
        throw new Error(
          `Failed to fetch current stock price for ${ticker}. Yahoo Finance error: ${yahooMessage}. Fallback error: ${fallbackMessage}`
        );
      }
    }
  },
});
