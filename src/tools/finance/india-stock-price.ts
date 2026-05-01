import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/**
 * Fetches live/latest NSE stock price and key metrics for an Indian equity.
 * Uses Yahoo Finance NSE feed. Automatically appends .NS suffix.
 */
export const getIndiaNsePrice = new DynamicStructuredTool({
  name: 'get_indian_stock_price_v2',
  description:
    "Fetches live/latest NSE stock price and key metrics for an Indian equity. " +
    "Input: NSE ticker symbol (e.g. RELIANCE, TCS, HDFCBANK, INFY). " +
    "Do NOT include .NS suffix — the tool adds it automatically. " +
    "Returns price in INR, 52-week range, market cap, P/E ratio, and volume. " +
    "Always call this tool before quoting any Indian stock price.",
  schema: z.object({
    ticker: z
      .string()
      .describe(
        "NSE ticker symbol without suffix, e.g. RELIANCE, TCS, HDFCBANK, NIFTY50"
      ),
  }),
  func: async (input) => {
    // Normalise: strip existing suffix, force .NS for NSE
    const nse = input.ticker.toUpperCase().replace(/\.(NS|BO)$/, "") + ".NS";

    try {
      const quote = await yf.quote(nse);
      if (!quote || !quote.regularMarketPrice) {
        return formatToolResult({
          error: `DATA UNAVAILABLE — Could not retrieve price for ${nse}. Verify the ticker exists on NSE.`,
        });
      }
      return formatToolResult({
        ticker: nse,
        exchange: "NSE",
        price_inr: quote.regularMarketPrice,
        currency: quote.currency ?? "INR",
        market_state: quote.marketState,
        regular_market_open: quote.regularMarketOpen,
        regular_market_high: quote.regularMarketDayHigh,
        regular_market_low: quote.regularMarketDayLow,
        regular_market_volume: quote.regularMarketVolume,
        fifty_two_week_high: quote.fiftyTwoWeekHigh,
        fifty_two_week_low: quote.fiftyTwoWeekLow,
        market_cap: quote.marketCap,
        pe_ratio: quote.trailingPE,
        as_of: new Date().toISOString(),
        source: "Yahoo Finance (NSE feed)",
      });
    } catch (err: any) {
      logger.error(`[India Stock API] Error for ${nse}: ${err?.message}`);
      return formatToolResult({
        error: `DATA UNAVAILABLE — Tool error for ${nse}: ${err?.message ?? String(err)}`,
      });
    }
  },
});
