/**
 * Stock Price Tool - Provider-agnostic implementation
 *
 * Uses provider abstraction layer for flexible provider routing.
 * Supports Indian markets (NSE/BSE) via Groww/Zerodha and US markets via Yahoo/Financial Datasets.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { providerRegistry } from './providers/index.js';
import { formatToolResult } from '../types.js';
import { logger } from '@/utils';

export const STOCK_PRICE_DESCRIPTION = `
Fetches current stock price snapshots using provider abstraction:
- Indian stocks (NSE/BSE) → Groww → Zerodha → Yahoo
- US stocks (NASDAQ/NYSE) → Yahoo → Financial Datasets
- Specify provider parameter to override automatic selection
`.trim();

const StockPriceInputSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(20)
    .describe("Stock ticker symbol (e.g., 'RELIANCE', 'AAPL')"),
  exchange: z
    .enum(['NSE', 'BSE', 'NASDAQ', 'NYSE'])
    .optional()
    .describe("Exchange code (NSE/BSE for Indian, NASDAQ/NYSE for US)"),
  provider: z
    .enum(['financial-datasets', 'groww', 'zerodha', 'yahoo', 'auto'])
    .optional()
    .describe("Preferred data provider (default: auto)"),
});

/**
 * Determine preferred provider based on exchange
 */
function getPreferredProvider(exchange?: string): string | undefined {
  if (!exchange) return undefined;

  const isIndian = ['NSE', 'BSE'].includes(exchange.toUpperCase());
  return isIndian ? 'groww' : 'yahoo';
}

export const getStockPrice = new DynamicStructuredTool({
  name: 'get_stock_price',
  description: STOCK_PRICE_DESCRIPTION,
  schema: StockPriceInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();

    // Determine preferred provider
    let preferredProvider = input.provider === 'auto' ? undefined : input.provider;
    if (!preferredProvider) {
      preferredProvider = getPreferredProvider(input.exchange);
    }

    try {
      // Get provider for live prices capability
      const provider = providerRegistry.getProviderForCapability(
        'livePrices',
        preferredProvider
      );

      if (!provider) {
        return formatToolResult(
          {
            error: 'No provider available for stock prices',
            ticker,
            exchange: input.exchange,
            message: 'Configure at least one provider (Groww, Zerodha, or Yahoo Finance)',
          },
          []
        );
      }

      // Fetch price
      const price = await provider.getStockPrice({
        ticker,
        exchange: input.exchange,
      });

      return formatToolResult(
        {
          ticker: price.ticker,
          provider: price.provider,
          price: price.price,
          change: price.change,
          change_percent: price.changePercent,
          market_cap: price.marketCap,
          shares_outstanding: price.sharesOutstanding,
          currency: price.currency,
          market_state: price.marketState,
          volume: price.volume,
          timestamp: price.timestamp,
        },
        [price.sourceUrl]
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[Stock Price] Failed for ${ticker}: ${errorMessage}`);

      // Try fallback with executeWithFallback
      try {
        const result = await providerRegistry.executeWithFallback(
          'livePrices',
          async (p) => p.getStockPrice({ ticker, exchange: input.exchange }),
          preferredProvider
        );

        return formatToolResult(
          {
            ticker: result.ticker,
            provider: result.provider,
            price: result.price,
            change: result.change,
            change_percent: result.changePercent,
            currency: result.currency,
            market_state: result.marketState,
            volume: result.volume,
            timestamp: result.timestamp,
          },
          [result.sourceUrl]
        );
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        return formatToolResult(
          {
            error: `Failed to fetch stock price for ${ticker}`,
            details: errorMessage,
            fallback_error: fallbackMessage,
          },
          []
        );
      }
    }
  },
});
