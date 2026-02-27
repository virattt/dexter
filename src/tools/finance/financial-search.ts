import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';

/**
 * Rich description for the financial_search tool.
 */
export const FINANCIAL_SEARCH_DESCRIPTION = `
Intelligent meta-tool for financial data research. Takes a natural language query and automatically routes to appropriate financial data sources for company financials, SEC filings, analyst estimates, and more.
`.trim();

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Import all finance tools directly
import { getIncomeStatements, getBalanceSheets, getCashFlowStatements, getAllFinancialStatements } from './fundamentals.js';
import { getKeyRatios } from './key-ratios.js';
import { getAnalystEstimates } from './estimates.js';
import { getSegmentedRevenues } from './segments.js';
import { getCryptoPriceSnapshot, getCryptoPrices, getCryptoTickers } from './crypto.js';
import { getInsiderTrades } from './insider_trades.js';
import { getYahooPriceSnapshot, getYahooFundamentals, getYahooNews } from './yahoo.js';
import { getAlphaVantagePriceSnapshot, getAlphaVantageOverview } from './alpha_vantage.js';
import { getStockPrice } from './stock-price.js';
import { getCompanyNews } from './news.js';

// All finance tools available for routing
const FINANCE_TOOLS: StructuredToolInterface[] = [
  // Price Data
  getStockPrice,
  getCryptoPriceSnapshot,
  getCryptoPrices,
  getCryptoTickers,
  // Fundamentals
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  // Key Ratios & Estimates
  getKeyRatios,
  getAnalystEstimates,
  // News
  getCompanyNews,
  // Other Data
  getInsiderTrades,
  getSegmentedRevenues,
  // Yahoo Finance (Indian Market)
  getYahooPriceSnapshot,
  getYahooFundamentals,
  getYahooNews,
  // Alpha Vantage (Indian Market)
  getAlphaVantagePriceSnapshot,
  getAlphaVantageOverview,
];

// Create a map for quick tool lookup by name
const FINANCE_TOOL_MAP = new Map(FINANCE_TOOLS.map(t => [t.name, t]));

/**
 * Build the router system prompt
 */
function buildRouterPrompt(): string {
  return `You are a financial data routing assistant.
Current date: ${getCurrentDate()}

Given a user's natural language query about financial data, call the appropriate financial tool(s).

## Guidelines

1. **Ticker Resolution**: Convert company names to ticker symbols:
   - Apple → AAPL, Tesla → TSLA, Microsoft → MSFT, Amazon → AMZN
   - **INDIAN STOCKS**: Use ".BSE" for Indian stocks (e.g., RELIANCE.BSE).

2. **Tool Selection**:
   - For a current stock quote/snapshot → get_stock_price
   - For revenue, earnings, profitability → get_income_statements
   - For news, catalysts, announcements → get_company_news
   - **Indian Market Routing**: For any ticker ending in .BSE or .NSE, or for Indian companies, ALWAYS use:
     - get_alpha_vantage_price_snapshot (for prices)
     - get_alpha_vantage_overview (for fundamentals)

Call the appropriate tool(s) now.`;
}

// Input schema for the financial_search tool
const FinancialSearchInputSchema = z.object({
  query: z.string().describe('Natural language query about financial data'),
});

/**
 * Create a financial_search tool configured with the specified model.
 */
export function createFinancialSearch(model: string, apiKeys?: Record<string, string>): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'financial_search',
    description: FINANCIAL_SEARCH_DESCRIPTION,
    schema: FinancialSearchInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. Call LLM with finance tools bound
      onProgress?.('Searching...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: FINANCE_TOOLS,
        apiKeys: apiKeys, // Propagate API keys
      });

      const aiMessage = response as AIMessage;

      // 2. Check for tool calls
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No tools selected for query', message: typeof aiMessage.content === 'string' ? aiMessage.content : 'Router did not select tools' }, []);
      }

      // 3. Execute tool calls in parallel
      const toolNames = toolCalls.map(tc => formatSubToolName(tc.name));
      onProgress?.(`Fetching from ${toolNames.join(', ')}...`);
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = FINANCE_TOOL_MAP.get(tc.name);
            if (!tool) {
              throw new Error(`Tool '${tc.name}' not found`);
            }

            // Invoke the tool with merged API keys in the config
            const config = { metadata: { apiKeys } };
            const rawResult = await tool.invoke(tc.args, config);
            const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
            const parsed = JSON.parse(result);
            return {
              tool: tc.name,
              args: tc.args,
              data: parsed.data || parsed, // Handle both wrapped and unwrapped results
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
      const combinedData: Record<string, unknown> = {};
      const allUrls: string[] = [];

      for (const result of results) {
        if (result.error) {
          combinedData[`${result.tool}_error`] = result.error;
        } else {
          const ticker = (result.args as Record<string, unknown>).ticker as string | undefined;
          const key = ticker ? `${result.tool}_${ticker}` : result.tool;
          combinedData[key] = result.data;
          allUrls.push(...result.sourceUrls);
        }
      }

      return formatToolResult(combinedData, Array.from(new Set(allUrls)));
    },
  });
}
