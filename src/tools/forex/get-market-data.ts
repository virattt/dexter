import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';

/**
 * Rich description for the get_market_data meta-tool.
 */
export const GET_MARKET_DATA_META_DESCRIPTION = `
Intelligent meta-tool for retrieving forex, index, and commodity market data. Takes a natural language query and automatically routes to appropriate data sources.

## When to Use

- Current price quotes for Fintokei instruments
- Historical OHLCV data for any timeframe
- Technical indicator calculations (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, etc.)
- Multi-indicator confluence analysis
- Listing available instruments
- Any combination of market data needs in a single query

## When NOT to Use

- Fintokei challenge rules or position sizing (use fintokei_rules tools directly)
- Trade journaling (use trade_journal tools directly)
- Economic calendar (use economic_calendar directly)
- General web searches (use web_search)

## Usage Notes

- Call ONCE with the complete natural language query - handles complexity internally
- Resolves instrument names automatically (gold → XAUUSD, DOW → US30, etc.)
- For multi-instrument analysis, pass the full query as-is
- Returns structured JSON data with source URLs
`.trim();

// Import all forex sub-tools
import { getPrice, getPriceHistory, listInstruments } from './market-data.js';
import { getTechnicalIndicator, getMultiIndicators } from './technical-analysis.js';

const MARKET_DATA_TOOLS: StructuredToolInterface[] = [
  getPrice,
  getPriceHistory,
  listInstruments,
  getTechnicalIndicator,
  getMultiIndicators,
];

const MARKET_DATA_TOOL_MAP = new Map(MARKET_DATA_TOOLS.map(t => [t.name, t]));

function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function buildRouterPrompt(): string {
  return `You are a forex and CFD market data routing assistant for Fintokei traders.
Current date: ${getCurrentDate()}

Given a user's natural language query about market data, call the appropriate tool(s).

## Available Instruments

**FX Majors:** EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD
**FX Minors:** EUR/GBP, EUR/JPY, GBP/JPY, EUR/AUD, AUD/JPY, and 15+ more crosses
**Indices:** JP225 (Nikkei), US30 (Dow), US500 (S&P), NAS100 (Nasdaq), GER40 (DAX), UK100 (FTSE), FRA40, AUS200, HK50
**Commodities:** XAUUSD (Gold), XAGUSD (Silver), USOIL (WTI), UKOIL (Brent)

## Guidelines

1. **Instrument Resolution**: Convert common names:
   - gold/GOLD → XAUUSD, silver → XAGUSD, oil/WTI → USOIL, brent → UKOIL
   - DOW/Dow Jones → US30, S&P/SP500 → US500, NASDAQ → NAS100
   - Nikkei/日経 → JP225, DAX → GER40, FTSE → UK100
   - EURUSD → EUR/USD, GBPJPY → GBP/JPY (add slash for FX pairs)

2. **Tool Selection**:
   - For current price quote → get_price
   - For historical candles/OHLCV → get_price_history
   - For single technical indicator → get_technical_indicator
   - For multi-indicator confluence → get_multi_indicators
   - For "what instruments are available" → list_instruments

3. **Timeframe Inference**:
   - "daily chart" → 1day, "4-hour" → 4h, "15-minute" → 15min
   - "weekly" → 1week, "monthly" → 1month

4. **Technical Indicator Defaults**:
   - RSI → time_period 14, SMA-20 → time_period 20, SMA-50 → time_period 50
   - MACD → default (12, 26, 9), Bollinger → time_period 20
   - ATR → time_period 14, ADX → time_period 14

Call the appropriate tool(s) now.`;
}

const GetMarketDataInputSchema = z.object({
  query: z.string().describe('Natural language query about market data, prices, or technical analysis'),
});

export function createGetMarketData(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_market_data',
    description: `Intelligent meta-tool for forex, index, and commodity market data. Takes a natural language query and routes to prices, historical data, or technical indicators. Use for:
- Current price quotes for FX pairs, indices, gold, oil
- Historical OHLCV candle data
- Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, etc.)
- Multi-indicator confluence analysis`,
    schema: GetMarketDataInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      onProgress?.('Fetching market data...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: MARKET_DATA_TOOLS,
      });
      const aiMessage = response as AIMessage;

      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No tools selected for query' }, []);
      }

      const toolNames = [...new Set(toolCalls.map(tc => formatSubToolName(tc.name)))];
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
        })
      );

      const successfulResults = results.filter(r => r.error === null);
      const failedResults = results.filter(r => r.error !== null);
      const allUrls = results.flatMap(r => r.sourceUrls);

      const combinedData: Record<string, unknown> = {};
      for (const result of successfulResults) {
        const symbol = (result.args as Record<string, unknown>).symbol as string | undefined;
        const key = symbol ? `${result.tool}_${symbol}` : result.tool;
        combinedData[key] = result.data;
      }

      if (failedResults.length > 0) {
        combinedData._errors = failedResults.map(r => ({
          tool: r.tool,
          args: r.args,
          error: r.error,
        }));
      }

      return formatToolResult(combinedData, allUrls);
    },
  });
}
