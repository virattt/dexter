import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';
import { withTimeout, SUB_TOOL_TIMEOUT_MS } from './utils.js';
import { MARKET_DATA_FORMATTERS } from './formatters.js';

/**
 * Rich description for the get_market_data tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const GET_MARKET_DATA_DESCRIPTION = `
Intelligent meta-tool for retrieving market data including prices, news, and insider activity. Takes a natural language query and automatically routes to appropriate market data sources.

## When to Use

- Current stock price snapshots (price, market cap, volume, 52-week high/low)
- Historical stock prices over date ranges
- Available stock ticker lookup
- Current cryptocurrency price snapshots
- Historical cryptocurrency prices over date ranges
- Available crypto ticker lookup
- Multi-asset price comparisons
- Company news and recent headlines
- Broad market news (macro, rates, earnings, geopolitics)
- Insider trading activity
- Price move explanations ("why did X go up/down" → combines price + news)

## When NOT to Use

- Company financials like income statements, balance sheets, cash flow (use get_financials)
- Financial metrics and key ratios (use get_financials)
- Analyst estimates (use get_financials)
- SEC filings (use read_filings)
- Stock screening by criteria (use stock_screener)
- General web searches (use web_search)

## Usage Notes

- Call ONCE with the complete natural language query - the tool handles complexity internally
- Handles ticker resolution automatically (Apple -> AAPL, Bitcoin -> BTC)
- Handles date inference (e.g., "last month", "past year", "YTD")
- For "what ticker is X?" queries, this tool can look up available tickers
- Returns structured JSON data with source URLs for verification
`.trim();

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Import market data tools directly (avoid circular deps with index.ts)
import { getStockPrice, getStockPrices, getStockTickers } from './stock-price.js';
import { getCryptoPriceSnapshot, getCryptoPrices, getCryptoTickers } from './crypto.js';
import { getCompanyNews } from './news.js';
import { getInsiderTrades } from './insider_trades.js';

// All market data tools available for routing
const MARKET_DATA_TOOLS: StructuredToolInterface[] = [
  // Stock Prices
  getStockPrice,
  getStockPrices,
  getStockTickers,
  // Crypto Prices
  getCryptoPriceSnapshot,
  getCryptoPrices,
  getCryptoTickers,
  // News & Activity
  getCompanyNews,
  getInsiderTrades,
];

// Create a map for quick tool lookup by name
const MARKET_DATA_TOOL_MAP = new Map(MARKET_DATA_TOOLS.map(t => [t.name, t]));

// Build the router system prompt for market data
function buildRouterPrompt(): string {
  return `You are a market data routing assistant.
Current date: ${getCurrentDate()}

Given a user's natural language query about market data, call the appropriate tool(s).

## Guidelines

1. **Ticker Resolution**: Convert company/crypto names to ticker symbols:
   - Apple → AAPL, Tesla → TSLA, Microsoft → MSFT, Amazon → AMZN
   - Google/Alphabet → GOOGL, Meta/Facebook → META, Nvidia → NVDA
   - Bitcoin → BTC, Ethereum → ETH, Solana → SOL

2. **Date Inference**: Use schema-supported filters for date ranges:
   - "last month" → start_date 1 month ago, end_date today
   - "past year" → start_date 1 year ago, end_date today
   - "YTD" → start_date Jan 1 of current year, end_date today
   - "2024" → start_date 2024-01-01, end_date 2024-12-31

3. **Tool Selection**:
   - For a current stock quote/snapshot (price, market cap, volume) → get_stock_price
   - For historical stock prices over a date range → get_stock_prices
   - For "what stocks are available" or ticker lookup → get_stock_tickers
   - For a current crypto price/snapshot → get_crypto_price_snapshot
   - For historical crypto prices over a date range → get_crypto_prices
   - For "what cryptos are available" or crypto ticker lookup → get_crypto_tickers
   - For company-specific news, catalysts, recent announcements → get_company_news with ticker
   - For broad market news (macro, rates, earnings, geopolitics) → get_company_news without ticker
   - For insider buying/selling activity → get_insider_trades
   - For "why did X go up/down" → combine get_stock_price + get_company_news
   - For "what's happening in the markets" → get_company_news without ticker

4. **Efficiency**:
   - For current/latest price, use snapshot tools (not historical with limit 1)
   - For comparisons between assets, call the same tool for each ticker
   - Use the smallest date range that answers the question

Call the appropriate tool(s) now.`;
}

// Input schema for the get_market_data tool
const GetMarketDataInputSchema = z.object({
  query: z.string().describe('Natural language query about market data, prices, news, or insider activity'),
});

/**
 * Create a get_market_data tool configured with the specified model.
 * Uses native LLM tool calling for routing queries to market data tools.
 */
export function createGetMarketData(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_market_data',
    description: `Intelligent meta-tool for retrieving market data including prices, news, and insider activity. Takes a natural language query and automatically routes to appropriate market data tools. Use for:
- Current and historical stock prices
- Current and historical cryptocurrency prices
- Stock and crypto ticker lookup
- Company news and recent headlines
- Broad market news (omit ticker)
- Insider trading activity`,
    schema: GetMarketDataInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. Call LLM with market data tools bound (native tool calling)
      onProgress?.('Fetching market data...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: MARKET_DATA_TOOLS,
      });
      const aiMessage = response as AIMessage;

      // 2. Check for tool calls
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No tools selected for query' }, []);
      }

      // 3. Execute tool calls in parallel
      const toolNames = [...new Set(toolCalls.map(tc => formatSubToolName(tc.name)))];
      onProgress?.(`Fetching from ${toolNames.join(', ')}...`);
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = MARKET_DATA_TOOL_MAP.get(tc.name);
            if (!tool) {
              throw new Error(`Tool '${tc.name}' not found`);
            }
            const rawResult = await withTimeout(tool.invoke(tc.args), SUB_TOOL_TIMEOUT_MS, tc.name);
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
        const key = ticker ? `${result.tool}_${ticker}` : result.tool;
        const formatter = MARKET_DATA_FORMATTERS[result.tool];
        combinedData[key] = formatter
          ? formatter(result.data, result.args as Record<string, unknown>)
          : result.data;
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
