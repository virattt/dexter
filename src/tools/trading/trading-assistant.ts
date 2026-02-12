import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';
import { isPaperMode } from './alpaca-client.js';

// Import sub-tools directly (avoid circular deps with index.ts)
import { getTradingAccount, getPositions } from './account.js';
import { placeOrder, cancelOrder, getOrders } from './orders.js';
import { technicalAnalysis } from './technical-analysis.js';

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// All trading sub-tools available for routing
const TRADING_TOOLS: StructuredToolInterface[] = [
  getTradingAccount,
  getPositions,
  placeOrder,
  cancelOrder,
  getOrders,
  technicalAnalysis,
];

// Create a map for quick tool lookup by name
const TRADING_TOOL_MAP = new Map(TRADING_TOOLS.map(t => [t.name, t]));

// Build the router system prompt
function buildRouterPrompt(): string {
  const mode = isPaperMode() ? 'PAPER (simulated)' : 'LIVE (real money)';

  return `You are a trading assistant router. Current mode: ${mode}.
Current date: ${getCurrentDate()}

Given a user's natural language query about trading, call the appropriate trading tool(s).

## SAFETY RULES — MANDATORY

1. **NEVER auto-trade**: If the query is analytical ("should I buy X?", "analyze X for trading"), use technical_analysis. Do NOT place orders for analytical queries.
2. **Confirmation required**: Before placing any order, the user must explicitly confirm. If unsure, use get_trading_account first to show account status.
3. **Check before ordering**: Always call get_trading_account before place_order to verify buying power.
4. **Mode awareness**: Always include the trading mode (${mode}) in context.

## Tool Selection

- "analyze X", "technical analysis on X", "what do indicators say" → technical_analysis
- "show my account", "buying power", "how much cash" → get_trading_account
- "show positions", "what do I own", "my portfolio" → get_positions
- "buy X", "sell X" (with explicit user confirmation) → get_trading_account + place_order
- "cancel order", "cancel my order" → cancel_order
- "show orders", "pending orders", "order history" → get_orders
- "analyze X then buy" → technical_analysis only (do NOT place order — analysis ≠ execution)

## Ticker Resolution

- Stock tickers: AAPL, MSFT, TSLA, etc.
- Crypto on Alpaca: BTC/USD, ETH/USD, etc.
- For technical analysis of crypto, convert: BTC/USD → BTC-USD (hyphen format for price data)

Call the appropriate tool(s) now.`;
}

// Input schema for the trading tool
const TradingInputSchema = z.object({
  query: z.string().describe('Natural language query about trading, positions, orders, or technical analysis'),
});

/**
 * Create a trading assistant tool configured with the specified model.
 * Routes natural language trading queries to appropriate sub-tools.
 */
export function createTradingAssistant(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'trading',
    description: `Intelligent trading assistant for executing trades, managing positions, and performing technical analysis via Alpaca. Takes a natural language query and routes to appropriate trading tools. Use for:
- Technical analysis (RSI, MACD, Bollinger Bands, EMA/SMA, ATR, Stochastic, VWAP)
- Account info (equity, buying power, cash)
- Position management (view open positions, P&L)
- Order placement (buy/sell with safety checks)
- Order management (view/cancel orders)`,
    schema: TradingInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
      const mode = isPaperMode() ? 'paper' : 'live';

      // 1. Call LLM with trading tools bound (native tool calling)
      onProgress?.('Routing...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: TRADING_TOOLS,
      });
      const aiMessage = response as AIMessage;

      // 2. Check for tool calls
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ mode, error: 'No trading tools selected for query' }, []);
      }

      // 3. Execute tool calls in parallel
      const toolNames = toolCalls.map(tc => formatSubToolName(tc.name));
      onProgress?.(`Executing ${toolNames.join(', ')}...`);
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = TRADING_TOOL_MAP.get(tc.name);
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
      const allUrls = results.flatMap((r) => r.sourceUrls);

      const combinedData: Record<string, unknown> = { mode };

      for (const result of successfulResults) {
        const ticker = (result.args as Record<string, unknown>).ticker as string | undefined;
        const key = ticker ? `${result.tool}_${ticker}` : result.tool;
        combinedData[key] = result.data;
      }

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
