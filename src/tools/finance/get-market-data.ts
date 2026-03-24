import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';
import {
  getStockQuote,
  getStockOhlc,
  getStockQuotesBatch,
  getTrendingStocks,
  getMarketNews,
} from './halal-market.js';

/**
 * Rich description for the get_market_data tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const GET_MARKET_DATA_DESCRIPTION = `
Intelligent meta-tool for retrieving market data including prices, news, and trends. Takes a natural language query and automatically routes to the appropriate Halal Terminal API tools.

## When to Use

- Current stock price snapshots (price, market cap, volume, 52-week high/low)
- Historical stock OHLC prices over a time period
- Batch price quotes for multiple stocks at once
- Trending or most-active stocks today
- Company news and recent market headlines
- Price move explanations ("why did X go up/down" → combines price + news)

## When NOT to Use

- Company financials like income statements, balance sheets, cash flow (use get_financials)
- Financial metrics and key ratios (use get_financials)
- Analyst estimates (use get_financials)
- SEC filings (use read_filings)
- Stock screening by criteria (use stock_screener)
- Shariah compliance, zakat, purification, or Islamic finance (use get_shariah)
- General web searches (use web_search)

## Usage Notes

- Call ONCE with the complete natural language query - routes internally
- Handles ticker resolution automatically (Apple → AAPL, Bitcoin → BTC)
- Handles period inference ("last month" → period=1mo, "past year" → period=1y)
- Returns structured JSON data with source URLs
`.trim();

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// All market data tools available for routing
const MARKET_DATA_TOOLS: StructuredToolInterface[] = [
  getStockQuote,
  getStockOhlc,
  getStockQuotesBatch,
  getTrendingStocks,
  getMarketNews,
];

const MARKET_DATA_TOOL_MAP = new Map(MARKET_DATA_TOOLS.map((t) => [t.name, t]));

function buildRouterPrompt(): string {
  return `You are a market data routing assistant powered by the Halal Terminal API.
Current date: ${getCurrentDate()}

Given a user's natural language query about market data, call the most appropriate tool(s).

## Tool Selection Guide

### get_stock_quote
Use for a real-time price snapshot of a single stock.
- "What is the current price of Apple?" → get_stock_quote(symbol="AAPL")
- "TSLA stock price" → get_stock_quote(symbol="TSLA")
- "Latest MSFT quote" → get_stock_quote(symbol="MSFT")

### get_stock_ohlc
Use for historical price data or charts over a time range.
- "AAPL price history last 6 months" → get_stock_ohlc(symbol="AAPL", period="6mo", interval="1d")
- "Show me Tesla chart for the past year" → get_stock_ohlc(symbol="TSLA", period="1y", interval="1wk")
- "MSFT daily prices YTD" → get_stock_ohlc(symbol="MSFT", period="ytd", interval="1d")

Period options: '1d','5d','1mo','3mo','6mo','1y','2y','5y','ytd','max'
Interval options: '1d','1wk','1mo' (use finer intervals like '1h' for short periods)

### get_stock_quotes_batch
Use when comparing prices of 2 or more stocks at once.
- "Compare current prices of AAPL, MSFT, and GOOGL" → get_stock_quotes_batch(symbols=["AAPL","MSFT","GOOGL"])
- "Prices for my portfolio: NVDA, AMD, INTC" → get_stock_quotes_batch(symbols=["NVDA","AMD","INTC"])

### get_trending_stocks
Use for "what's trending" or "top movers" type queries.
- "What stocks are trending today?" → get_trending_stocks(limit=20)
- "Top movers right now" → get_trending_stocks(limit=10)

### get_market_news
Use for news, catalysts, or "why did X move" queries.
- "Latest news on Apple" → get_market_news(symbol="AAPL", limit=10)
- "Why did Tesla drop today?" → get_stock_quote(symbol="TSLA") + get_market_news(symbol="TSLA")
- "Market headlines today" → get_market_news(limit=15)
- "News about AI stocks" → get_market_news(q="artificial intelligence", limit=10)

## Ticker Resolution
Apple → AAPL, Tesla → TSLA, Microsoft → MSFT, Amazon → AMZN
Google/Alphabet → GOOGL, Meta/Facebook → META, Nvidia → NVDA
Netflix → NFLX, Saudi Aramco → 2222.SR, Alibaba → BABA

Call the appropriate tool(s) now.`;
}

const GetMarketDataInputSchema = z.object({
  query: z
    .string()
    .describe('Natural language query about market data, prices, news, or trending stocks'),
});

/**
 * Create a get_market_data tool configured with the specified model.
 * Uses native LLM tool calling to route queries to the appropriate market data tools.
 */
export function createGetMarketData(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_market_data',
    description: `Intelligent meta-tool for retrieving market data including prices, news, and trends. Takes a natural language query and automatically routes to appropriate market data tools. Use for:
- Current and historical stock prices
- Batch price quotes for multiple stocks
- Trending or most-active stocks
- Company news and recent market headlines
- Price move explanations`,
    schema: GetMarketDataInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. LLM routes the query to the right sub-tool(s) via native tool calling
      onProgress?.('Fetching market data...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: MARKET_DATA_TOOLS,
      });
      const aiMessage = response as AIMessage;

      // 2. Verify tool calls were generated
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No tools selected for query' }, []);
      }

      // 3. Execute tool calls in parallel
      const toolNames = [...new Set(toolCalls.map((tc) => formatSubToolName(tc.name)))];
      onProgress?.(`Fetching from ${toolNames.join(', ')}...`);

      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = MARKET_DATA_TOOL_MAP.get(tc.name);
            if (!tool) throw new Error(`Tool '${tc.name}' not found`);
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
        }),
      );

      // 4. Combine results into a single response
      const allUrls = results.flatMap((r) => r.sourceUrls);
      const combinedData: Record<string, unknown> = {};

      for (const result of results.filter((r) => r.error === null)) {
        const args = result.args as Record<string, unknown>;
        const symbol = (args.symbol as string | undefined) ||
          (Array.isArray(args.symbols) ? (args.symbols as string[])[0] : undefined);
        const key = symbol ? `${result.tool}_${symbol}` : result.tool;
        combinedData[key] = result.data;
      }

      const failedResults = results.filter((r) => r.error !== null);
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
