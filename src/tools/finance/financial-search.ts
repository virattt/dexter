import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';

/**
 * Rich description for financial_search tool.
 * Used in system prompt to guide LLM on when and how to use this tool.
 */
export const FINANCIAL_SEARCH_DESCRIPTION = `
Intelligent meta-tool for financial data research. Takes a natural language query and automatically routes to appropriate financial data sources for company financials, SEC filings, analyst estimates, and more.

## When to Use

- Company facts (sector, industry, market cap, number of employees, listing date, exchange, location, weighted average shares, website)
- Company financials (income statements, balance sheets, cash flow statements)
- Financial metrics (P/E ratio, market cap, EPS, dividend yield, enterprise value)
- Analyst estimates and price targets
- Company news and recent headlines
- Insider trading activity
- Current stock prices for equities
- Cryptocurrency prices
- Revenue segment breakdowns
- Multi-company comparisons (pass full query, it handles routing internally)

## When NOT to Use

- Historical stock prices (use web_search instead)
- General web searches or non-financial topics (use web_search instead)
- Questions that don't require external financial data (answer directly from knowledge)
- Non-public company information
- Real-time trading or order execution

## Usage Notes

- Call ONCE with complete natural language query - tool handles complexity internally
- For comparisons like "compare AAPL vs MSFT revenue", pass full query as-is
- For price move explanations and catalysts, this tool can return both price and news headlines
- Handles ticker resolution automatically (Apple -> AAPL, Microsoft -> MSFT)
- Handles date inference (e.g., "last quarter", "past 5 years", "YTD")
- Returns structured JSON data with source URLs for verification

## Provider Routing

The tool uses a provider abstraction layer that automatically routes to the best data source:
- Indian stocks (NSE/BSE) → Groww → Zerodha → Yahoo
- US stocks (NASDAQ/NYSE) → Yahoo → Financial Datasets
- Fundamentals data → Financial Datasets API
- Automatic fallback if primary provider fails
`.trim();

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Helper function to get finance tools (lazy initialization to avoid circular deps)
function getFinanceTools(): StructuredToolInterface[] {
  // Use require() to avoid circular dependency with stock-price.ts
  // This is loaded on-demand when createFinancialSearch is called
  const { getIncomeStatements, getBalanceSheets, getCashFlowStatements, getAllFinancialStatements } = require('./fundamentals.js');
  const { getKeyRatios } = require('./key-ratios.js');
  const { getAnalystEstimates } = require('./estimates.js');
  const { getSegmentedRevenues } = require('./segments.js');
  const { getCryptoPriceSnapshot, getCryptoPrices, getCryptoTickers } = require('./crypto.js');
  const { getInsiderTrades } = require('./insider_trades.js');
  const { getStockPrice } = require('./stock-price.js');
  const { getCompanyNews } = require('./news.js');

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
  ];

  return FINANCE_TOOLS;
}

// Helper function to get finance tool map
function getFinanceToolMap(): Map<string, StructuredToolInterface> {
  return new Map(getFinanceTools().map(t => [t.name, t]));
}

// Build router system prompt - includes provider capabilities
function buildRouterPrompt(): string {
  return `You are a financial data routing assistant with provider-aware capabilities.
Current date: ${getCurrentDate()}

Given a user's natural language query about financial data, call the appropriate financial tool(s).

## Provider Capabilities

The financial data layer uses multiple providers with different capabilities:

- **Groww**: Indian stocks (NSE, BSE, MCX), live prices, orders, positions
- **Zerodha**: Indian stocks (NSE, BSE, MCX), live prices, historical data, WebSocket
- **Yahoo Finance**: Global stocks, live prices, historical data
- **Financial Datasets**: US stocks, fundamentals (income statements, balance sheets, cash flow statements)

## Provider Routing Logic

- For Indian market tickers (RELIANCE, TCS, INFY) with exchange NSE/BSE:
  - Stock prices → Groww → Zerodha → Yahoo (automatic fallback)
- For US market tickers (AAPL, GOOGL, MSFT):
  - Stock prices → Yahoo → Financial Datasets
- For fundamentals data (income statements, balance sheets, cash flow):
  - Use get_all_financial_statements → Financial Datasets

## Guidelines

1. **Ticker Resolution**: Convert company names to ticker symbols:
   - Apple → AAPL, Tesla → TSLA, Microsoft → MSFT, Amazon → AMZN
   - Google/Alphabet → GOOGL, Meta/Facebook → META, Nvidia → NVDA
   - Reliance → RELIANCE, Tata Consultancy Services → TCS, Infosys → INFY

2. **Date Inference**: Use schema-supported filters for date ranges:
   - "last year" → report_period_gte 1 year ago
   - "last quarter" → report_period_gte 3 months ago
   - "past 5 years" → report_period_gte 5 years ago and limit 5 (annual) or 20 (quarterly)
   - "YTD" → report_period_gte Jan 1 of current year

3. **Tool Selection**:
   - For a current stock quote/snapshot (price, market cap now) → get_stock_price
   - For "historical" or "over time" data, use date-range tools
   - For historical P/E ratio, historical market cap, valuation metrics over time → get_key_ratios
   - For revenue, earnings, profitability → get_income_statements
   - For debt, assets, equity → get_balance_sheets
   - For cash flow, free cash flow → get_cash_flow_statements
   - For news, catalysts, "why did X move", recent announcements → get_company_news
   - For "why did X go up/down" → combine get_stock_price + get_company_news
   - For comprehensive analysis → get_all_financial_statements

4. **Efficiency**:
   - Prefer specific tools over general ones when possible
   - Use get_all_financial_statements only when multiple statement types are needed
   - For comparisons between companies, call the same tool for each ticker
   - Always use the smallest limit that can answer the question:
     - Point-in-time/latest questions → limit 1
     - Short trend (2-3 periods) → limit 3
     - Medium trend (4-5 periods) → limit 5
   - Increase limit beyond defaults only when the user explicitly asks for long history (e.g., 10-year trend)

5. **Provider Awareness**:
   - The tools automatically select the best provider based on market and capability
   - No need to specify providers manually - routing is automatic
   - If a provider fails, the system automatically falls back to the next available provider

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
    description: `Intelligent agentic search for financial data. Takes a natural language query and automatically routes to appropriate financial data tools. Use for:
- Company financials (income statements, balance sheets, cash flow)
- Financial metrics (P/E ratio, market cap, EPS, dividend yield)
- Analyst estimates and price targets
- Company news and recent headlines
- Insider trading activity
- Current stock prices
- Cryptocurrency prices. For historical stock prices use web_search instead.

Provider routing: Indian stocks use Groww/Zerodha, US stocks use Yahoo/Financial Datasets. Automatic fallback enabled.`,
    schema: FinancialSearchInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. Call LLM with finance tools bound (native tool calling)
      onProgress?.('Searching...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: getFinanceTools(),
      });
      const aiMessage = response as AIMessage;

      // 2. Check for tool calls
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No tools selected for query' }, []);
      }

      // 3. Execute tool calls in parallel
      const toolNames = toolCalls.map(tc => formatSubToolName(tc.name));
      onProgress?.(`Fetching from \${toolNames.join(', ')}...`);
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = getFinanceToolMap().get(tc.name);
            if (!tool) {
              throw new Error(`Tool '\${tc.name}' not found`);
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
        // Use tool name as key, or tool_ticker for multiple calls to the same tool
        const ticker = (result.args as Record<string, unknown>).ticker as string | undefined;
        const key = ticker ? `\${result.tool}_\${ticker}` : result.tool;
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
