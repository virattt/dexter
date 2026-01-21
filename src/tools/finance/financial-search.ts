import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';

// Import all finance tools directly (avoid circular deps with index.ts)
import { getIncomeStatements, getBalanceSheets, getCashFlowStatements, getAllFinancialStatements } from './fundamentals.js';
import { getPriceSnapshot, getPrices, searchTicker } from './prices.js';
import { getFinancialMetricsSnapshot, getEarnings } from './metrics.js';
import { getNews } from './news.js';
import { getCryptoPriceSnapshot, getCryptoPrices } from './crypto.js';

// All finance tools available for routing (powered by Alpha Vantage API)
const FINANCE_TOOLS: StructuredToolInterface[] = [
  // Price Data
  getPriceSnapshot,
  getPrices,
  searchTicker,
  // Cryptocurrency
  getCryptoPriceSnapshot,
  getCryptoPrices,
  // Fundamentals
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  // Metrics & Earnings
  getFinancialMetricsSnapshot,
  getEarnings,
  // News
  getNews,
];

// Create a map for quick tool lookup by name
const FINANCE_TOOL_MAP = new Map(FINANCE_TOOLS.map(t => [t.name, t]));

// Build the router system prompt - simplified since LLM sees tool schemas
function buildRouterPrompt(): string {
  return `You are a financial data routing assistant powered by Alpha Vantage API.
Current date: ${getCurrentDate()}

Given a user's natural language query about financial data, call the appropriate financial tool(s).

## Guidelines

1. **Ticker Resolution**: Convert company names to ticker symbols:
   - Apple → AAPL, Tesla → TSLA, Microsoft → MSFT, Amazon → AMZN
   - Google/Alphabet → GOOGL, Meta/Facebook → META, Nvidia → NVDA
   - If unsure, use search_ticker to find the correct symbol

2. **Tool Selection**:
   - For "current" or "latest" price → get_price_snapshot
   - For "historical" prices → get_prices (supports daily, weekly, monthly, intraday)
   - For P/E ratio, market cap, valuation, company overview → get_financial_metrics_snapshot
   - For earnings history and EPS data → get_earnings
   - For revenue, expenses, profitability → get_income_statements
   - For assets, liabilities, equity → get_balance_sheets
   - For cash flow analysis → get_cash_flow_statements
   - For comprehensive financial analysis → get_all_financial_statements
   - For news and sentiment → get_news
   - For cryptocurrency prices → get_crypto_price_snapshot or get_crypto_prices

3. **Efficiency**:
   - Prefer specific tools over general ones when possible
   - Use get_all_financial_statements only when multiple statement types needed
   - For comparisons between companies, call the same tool for each ticker

Call the appropriate tool(s) now.`;
}

// Input schema for the financial_search tool
const FinancialSearchInputSchema = z.object({
  query: z.string().describe('Natural language query about financial data'),
});

/**
 * Create a financial_search tool configured with the specified model.
 * Uses native LLM tool calling for routing queries to finance tools.
 */
export function createFinancialSearch(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'financial_search',
    description: `Intelligent agentic search for financial data powered by Alpha Vantage API. Takes a natural language query and automatically routes to appropriate financial data tools. Use for:
- Stock prices (current quotes, historical daily/weekly/monthly/intraday)
- Company financials (income statements, balance sheets, cash flow)
- Financial metrics (P/E ratio, market cap, EPS, dividend yield, analyst ratings)
- Earnings data (quarterly and annual EPS, estimates, surprises)
- Company news with sentiment analysis
- Cryptocurrency prices and exchange rates
- Ticker symbol search`,
    schema: FinancialSearchInputSchema,
    func: async (input) => {
      // 1. Call LLM with finance tools bound (native tool calling)
      const response = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: FINANCE_TOOLS,
      }) as AIMessage;

      // 2. Check for tool calls
      const toolCalls = response.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No tools selected for query' }, []);
      }

      // 3. Execute tool calls in parallel
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = FINANCE_TOOL_MAP.get(tc.name);
            if (!tool) {
              throw new Error(`Tool '${tc.name}' not found`);
            }
            const rawResult = await tool.invoke(tc.args);
            const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
            const parsed = JSON.parse(result);
            return {
              tool: tc.name,
              args: tc.args,
              data: parsed.data,
              sourceUrls: parsed.sourceUrls || [],
              error: null,
            };
          } catch (error) {
            return {
              tool: tc.name,
              args: tc.args,
              data: null,
              sourceUrls: [],
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      // 4. Combine results
      const successfulResults = results.filter((r) => r.error === null);
      const failedResults = results.filter((r) => r.error !== null);

      // Collect all source URLs
      const allUrls = results.flatMap((r) => r.sourceUrls);

      // Build combined data structure
      const combinedData: Record<string, unknown> = {};

      for (const result of successfulResults) {
        // Use tool name as key, or tool_ticker for multiple calls to same tool
        const ticker = (result.args as Record<string, unknown>).ticker as string | undefined;
        const symbol = (result.args as Record<string, unknown>).symbol as string | undefined;
        const key = ticker || symbol ? `${result.tool}_${ticker || symbol}` : result.tool;
        combinedData[key] = result.data;
      }

      // Add errors if any
      if (failedResults.length > 0) {
        combinedData._errors = failedResults.map((r) => ({
          tool: r.tool,
          args: r.args,
          error: r.error,
        }));
      }

      return formatToolResult(combinedData, allUrls);
    },
  });
}
