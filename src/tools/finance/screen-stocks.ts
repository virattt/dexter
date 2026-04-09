import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';
import { api } from './api.js';

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
- Filtering by sector or industry (e.g., "health care stocks", "oil and gas companies")
- Finding stocks matching a specific investment thesis

## When NOT to Use

- Looking up a specific company's financials (use get_financials)
- Current stock prices or market data (use get_market_data)
- SEC filing content (use read_filings)
- General web searches (use web_search)

## Usage Notes

- Call ONCE with the complete natural language query describing your screening criteria
- The tool translates your criteria into exact API filters automatically
- Returns matching tickers with the metric values used for screening
- Supports operators: gt, gte, lt, lte, eq, in
- For range queries (e.g., "between 10 and 20"), use two filters: gte + lte
`.trim();

// In-memory cache for screener filters (static model fields, rarely change)
let cachedFilters: Record<string, unknown> | null = null;

async function getScreenerFilters(): Promise<Record<string, unknown>> {
  if (cachedFilters) {
    return cachedFilters;
  }

  const { data } = await api.get('/financials/search/screener/filters/', {});
  cachedFilters = data;
  return data;
}

const ScreenerFilterSchema = z.object({
  filters: z.array(z.object({
    field: z.string().describe('Exact metric field name from the available metrics list'),
    operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'in']).describe('Comparison operator'),
    value: z.union([z.number(), z.string(), z.array(z.number()), z.array(z.string())]).describe('Numeric threshold, string for company fields (sector/industry), or array for "in" operator'),
  })).describe('Array of screening filters to apply'),
  currency: z.string().default('USD').describe('Currency code (e.g., "USD")'),
  limit: z.number().default(5).describe('Maximum number of results to return'),
});

type ScreenerFilters = z.infer<typeof ScreenerFilterSchema>;

// Escape curly braces for LangChain template interpolation
function escapeTemplateVars(str: string): string {
  return str.replace(/\{/g, '{{').replace(/\}/g, '}}');
}

function buildScreenerPrompt(metrics: Record<string, unknown>): string {
  const escapedMetrics = escapeTemplateVars(JSON.stringify(metrics, null, 2));

  return `You are a stock screening assistant.
Current date: ${getCurrentDate()}

Given a user's natural language query about stock screening criteria, produce the structured filter payload.

## Available Screener Metrics

${escapedMetrics}

## Guidelines

1. Map user criteria to exact field names from the metrics list above
2. Choose the correct operator:
   - "below", "under", "less than" → lt or lte
   - "above", "over", "greater than", "more than" → gt or gte
   - "equal to", "exactly" → eq
   - "between X and Y" → use TWO filters: gte for the lower bound + lte for the upper bound
   - "one of", "in" → in (value as array)
3. **Decimal scaling**: Margins and ratios (gross_margin, net_margin, operating_margin, return_on_equity, return_on_assets, return_on_invested_capital, dividend_yield, free_cash_flow_yield, payout_ratio, revenue_growth, earnings_growth, earnings_per_share_growth, ebitda_growth, free_cash_flow_growth, operating_income_growth, book_value_growth) are stored as decimals, NOT percentages. For example, "ROE above 15%" → return_on_equity gt 0.15, "gross margin above 40%" → gross_margin gt 0.4
4. Use reasonable defaults:
   - If the user says "low P/E" without a number, use a sensible threshold (e.g., lt 15)
   - If the user says "high growth" without a number, use a sensible threshold (e.g., gt 0.20)
5. Set limit to 25 unless the user specifies otherwise
6. Default currency to USD unless specified
7. Company fields (sector, industry) use GICS classification and require string values with the "eq" or "in" operator (case-insensitive). Common GICS sectors: Communication Services, Consumer Discretionary, Consumer Staples, Energy, Financials, Health Care, Industrials, Information Technology, Materials, Real Estate, Utilities. Map user intent to the correct GICS value (e.g., "tech stocks" → sector eq "Information Technology", "oil and gas" → industry eq "Oil, Gas & Consumable Fuels")

Return only the structured output fields.`;
}

const ScreenStocksInputSchema = z.object({
  query: z.string().describe('Natural language query describing stock screening criteria'),
});

/**
 * Create a screen_stocks tool configured with the specified model.
 * Single LLM call: structured output translates natural language → screener filters.
 */
export function createScreenStocks(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'stock_screener',
    description: `Screens for stocks matching financial criteria. Takes a natural language query and returns matching tickers with metric values. Use for:
- Finding stocks by valuation (P/E, P/B, EV/EBITDA)
- Screening by profitability (margins, ROE, ROA)
- Filtering by growth rates (revenue, earnings, EPS growth)
- Dividend screening (yield, payout ratio)
- Filtering by sector or industry (e.g., "health care", "oil and gas")`,
    schema: ScreenStocksInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // Step 1: Fetch screener metrics (cached after first call)
      onProgress?.('Loading screener metrics...');
      let metrics: Record<string, unknown>;
      try {
        metrics = await getScreenerFilters();
      } catch (error) {
        return formatToolResult(
          {
            error: 'Failed to fetch screener metrics',
            details: error instanceof Error ? error.message : String(error),
          },
          [],
        );
      }

      // Step 2: LLM structured output — translate natural language → filters
      onProgress?.('Building screening criteria...');
      let filters: ScreenerFilters;
      try {
        const { response } = await callLlm(input.query, {
          model,
          systemPrompt: buildScreenerPrompt(metrics),
          outputSchema: ScreenerFilterSchema,
        });
        filters = ScreenerFilterSchema.parse(response);
      } catch (error) {
        return formatToolResult(
          {
            error: 'Failed to parse screening criteria',
            details: error instanceof Error ? error.message : String(error),
          },
          [],
        );
      }

      // Step 3: POST to screener API
      onProgress?.('Screening stocks...');
      try {
        const { data, url } = await api.post('/financials/search/screener/', {
          filters: filters.filters,
          currency: filters.currency,
          limit: filters.limit,
        });
        return formatToolResult(data, [url]);
      } catch (error) {
        return formatToolResult(
          {
            error: 'Screener request failed',
            details: error instanceof Error ? error.message : String(error),
            filters: filters.filters,
          },
          [],
        );
      }
    },
  });
}
