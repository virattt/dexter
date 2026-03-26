import type { RunnableConfig } from '@langchain/core/runnables';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getCurrentDate } from '../../agent/prompts.js';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { fmp } from './api.js';

/**
 * Rich description for the screen_stocks tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const SCREEN_STOCKS_DESCRIPTION = `
Screens for stocks matching financial criteria. Takes a natural language query describing the screening criteria and returns matching tickers with their metric values.

## When to Use

- Finding stocks by financial criteria (e.g., "P/E below 15 and revenue growth above 20%")
- Screening for value, growth, dividend, or quality stocks
- Filtering the market by valuation ratios, profitability metrics, or growth rates
- Finding stocks matching a specific investment thesis

## When NOT to Use

- Looking up a specific company's financials (use get_financials)
- Current stock prices or market data (use get_market_data)
- SEC filing content (use read_filings)
- General web searches (use web_search)

## Usage Notes

- Call ONCE with the complete natural language query describing your screening criteria
- The tool translates your criteria into FMP stock screener parameters automatically
- Returns matching tickers with key financial data
`.trim();

// FMP stock screener query params
const FmpScreenerParamsSchema = z.object({
  marketCapMoreThan: z.number().optional().describe('Minimum market cap in USD'),
  marketCapLowerThan: z.number().optional().describe('Maximum market cap in USD'),
  priceMoreThan: z.number().optional().describe('Minimum stock price'),
  priceLowerThan: z.number().optional().describe('Maximum stock price'),
  betaMoreThan: z.number().optional().describe('Minimum beta'),
  betaLowerThan: z.number().optional().describe('Maximum beta'),
  volumeMoreThan: z.number().optional().describe('Minimum average volume'),
  volumeLowerThan: z.number().optional().describe('Maximum average volume'),
  dividendMoreThan: z.number().optional().describe('Minimum dividend yield'),
  dividendLowerThan: z.number().optional().describe('Maximum dividend yield'),
  sector: z.string().optional().describe('Sector filter (e.g., "Technology", "Healthcare")'),
  industry: z.string().optional().describe('Industry filter'),
  country: z.string().optional().describe('Country filter (e.g., "US", "GB")'),
  exchange: z.string().optional().describe('Exchange filter (e.g., "NYSE", "NASDAQ")'),
  isEtf: z.boolean().optional().describe('Filter for ETFs only'),
  isActivelyTrading: z.boolean().optional().describe('Filter for actively trading stocks'),
  limit: z.number().default(25).describe('Maximum results to return'),
});

type FmpScreenerParams = z.infer<typeof FmpScreenerParamsSchema>;

function buildScreenerPrompt(): string {
  return `You are a stock screening assistant.
Current date: ${getCurrentDate()}

Given a user's natural language query about stock screening criteria, produce the structured FMP screener parameters.

## Available Parameters

- marketCapMoreThan / marketCapLowerThan: Market cap bounds in USD (e.g., 1000000000 for $1B)
- priceMoreThan / priceLowerThan: Stock price bounds
- betaMoreThan / betaLowerThan: Beta bounds
- volumeMoreThan / volumeLowerThan: Average volume bounds
- dividendMoreThan / dividendLowerThan: Dividend yield bounds (as percentage, e.g., 3 for 3%)
- sector: One of "Technology", "Healthcare", "Financial Services", "Consumer Cyclical", "Industrials", "Communication Services", "Consumer Defensive", "Energy", "Basic Materials", "Real Estate", "Utilities"
- industry: Specific industry within sector
- country: Country code (e.g., "US", "GB", "JP")
- exchange: "NYSE", "NASDAQ", "AMEX", "EURONEXT", "TSX", "LSE"
- isEtf: true to include only ETFs, false to exclude ETFs
- isActivelyTrading: true for actively traded stocks only
- limit: Number of results (default 25)

## Guidelines

1. Map user criteria to the available parameters above
2. Use reasonable defaults:
   - "large cap" → marketCapMoreThan: 10000000000
   - "mid cap" → marketCapMoreThan: 2000000000, marketCapLowerThan: 10000000000
   - "small cap" → marketCapLowerThan: 2000000000
   - "high dividend" → dividendMoreThan: 3
   - "penny stocks" → priceLowerThan: 5
3. Set limit to 25 unless the user specifies otherwise
4. Default isActivelyTrading to true

Return only the structured output fields.`;
}

const ScreenStocksInputSchema = z.object({
  query: z.string().describe('Natural language query describing stock screening criteria'),
});

/**
 * Create a screen_stocks tool configured with the specified model.
 * LLM translates natural language → FMP screener params.
 */
export function createScreenStocks(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'stock_screener',
    description: `Screens for stocks matching financial criteria via FMP. Takes a natural language query and returns matching tickers with key data. Use for:
- Finding stocks by valuation (P/E, market cap)
- Screening by sector, industry, or exchange
- Filtering by dividend yield, beta, or volume
- Finding large/mid/small cap stocks`,
    schema: ScreenStocksInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // LLM structured output — translate natural language → FMP params
      onProgress?.('Building screening criteria...');
      let params: FmpScreenerParams;
      try {
        const { response } = await callLlm(input.query, {
          model,
          systemPrompt: buildScreenerPrompt(),
          outputSchema: FmpScreenerParamsSchema,
        });
        params = FmpScreenerParamsSchema.parse(response);
      } catch (error) {
        return formatToolResult(
          {
            error: 'Failed to parse screening criteria',
            details: error instanceof Error ? error.message : String(error),
          },
          [],
        );
      }

      // Call FMP stock screener
      onProgress?.('Screening stocks...');
      try {
        const queryParams: Record<string, string | number | undefined> = {};
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            queryParams[key] = typeof value === 'boolean' ? String(value) : (value as string | number);
          }
        }
        const { data, url } = await fmp.get('/stock-screener', queryParams);
        return formatToolResult(Array.isArray(data) ? data : [], [url]);
      } catch (error) {
        return formatToolResult(
          {
            error: 'Screener request failed',
            details: error instanceof Error ? error.message : String(error),
          },
          [],
        );
      }
    },
  });
}
