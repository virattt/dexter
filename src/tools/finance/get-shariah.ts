/**
 * get_shariah — intelligent meta-tool for Shariah finance queries.
 *
 * Routes natural language queries about Islamic finance to the appropriate
 * Halal Terminal API tools: stock/ETF compliance screening, zakat calculation,
 * dividend purification, and halal database search.
 */

import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';
import {
  screenStockShariah,
  screenEtfShariah,
  compareEtfShariah,
  calculateZakat,
  calculatePurification,
  getDividendsShariah,
  searchHalalDatabase,
} from './shariah.js';

export const GET_SHARIAH_DESCRIPTION = `
Intelligent meta-tool for Islamic finance and Shariah compliance queries. Routes natural language questions to the appropriate Halal Terminal API tools.

## When to Use

- Checking if a stock is halal / Shariah-compliant (AAPL, MSFT, TSLA, etc.)
- Screening ETFs for Shariah compliance (QQQ, SPY, HLAL, SPUS, etc.)
- Comparing ETFs by their halal compliance rating
- Calculating zakat on a stock portfolio
- Calculating dividend purification (cleansing) amounts
- Finding halal stocks in a sector or exchange
- Searching for Shariah-compliant alternatives to a non-compliant stock
- Any question involving halal investing, Islamic finance, or Shariah screening

## When NOT to Use

- Standard financial statements or ratios (use get_financials)
- Current stock prices or market data (use get_market_data)
- SEC filings (use read_filings)
- General stock screening by valuation (use stock_screener)
- General web searches (use web_search)

## Usage Notes

- Call ONCE with a complete natural language query
- Handles ticker resolution (Apple → AAPL, S&P 500 ETF → SPY)
- Automatically selects and calls the right sub-tool(s)
- Returns Shariah compliance verdicts with detailed breakdowns
`.trim();

// All Shariah sub-tools available for routing
const SHARIAH_TOOLS: StructuredToolInterface[] = [
  screenStockShariah,
  screenEtfShariah,
  compareEtfShariah,
  calculateZakat,
  calculatePurification,
  getDividendsShariah,
  searchHalalDatabase,
];

const SHARIAH_TOOL_MAP = new Map(SHARIAH_TOOLS.map((t) => [t.name, t]));

function buildRouterPrompt(): string {
  return `You are an Islamic finance assistant specialising in Shariah compliance.
Current date: ${getCurrentDate()}

Given a user query about Shariah compliance or Islamic finance, call the appropriate tool(s).

## Tool Selection Guide

1. **screen_stock_shariah** — Use when asked whether a specific stock is halal/compliant.
   - "Is Apple halal?" → screen_stock_shariah(symbol="AAPL")
   - "Check MSFT shariah compliance using AAOIFI" → screen_stock_shariah(symbol="MSFT", methodology="AAOIFI")
   - For multiple stocks, call once per ticker.

2. **screen_etf_shariah** — Use when asked about an ETF's halal status or holding breakdown.
   - "Is QQQ halal?" → screen_etf_shariah(symbol="QQQ")

3. **compare_etf_shariah** — Use to compare multiple ETFs by Shariah compliance.
   - "Which is more halal: QQQ or HLAL?" → compare_etf_shariah(symbols=["QQQ", "HLAL"])

4. **calculate_zakat** — Use when asked to calculate zakat on stock holdings.
   - "Calculate my zakat: 100 shares of AAPL at $180, 50 shares of MSFT at $400"
     → calculate_zakat(holdings=[{symbol:"AAPL", shares:100, price:180}, {symbol:"MSFT", shares:50, price:400}])

5. **calculate_purification** — Use when asked about dividend purification/cleansing for a specific holding.
   - "How much do I need to purify from my 200 AAPL dividends in 2024?"
     → calculate_purification(symbol="AAPL", shares=200, period="2024")

6. **get_dividends_shariah** — Use when asked for dividend history with purification amounts.
   - "Show AAPL dividend history with purification amounts"
     → get_dividends_shariah(symbol="AAPL")

7. **search_halal_database** — Use when asked to find or list halal stocks by criteria.
   - "Find halal tech stocks on NASDAQ" → search_halal_database(status="COMPLIANT", exchange="NASDAQ", sector="Technology")
   - "What halal alternatives to Meta exist?" → search_halal_database(query="social media", status="COMPLIANT")

## Ticker Resolution
- Apple → AAPL, Tesla → TSLA, Microsoft → MSFT, Amazon → AMZN
- Google/Alphabet → GOOGL, Meta/Facebook → META, Nvidia → NVDA
- S&P 500 ETF → SPY, Nasdaq ETF → QQQ, Halal ETF → HLAL

Call the appropriate tool(s) now.`;
}

function formatSubToolName(name: string): string {
  return name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const GetShariahInputSchema = z.object({
  query: z
    .string()
    .describe(
      'Natural language query about Shariah compliance, halal investing, zakat, or Islamic finance',
    ),
});

/**
 * Create a get_shariah tool configured with the specified model.
 * Uses native LLM tool calling to route queries to the appropriate Shariah sub-tools.
 */
export function createGetShariah(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_shariah',
    description: `Intelligent meta-tool for Islamic finance and Shariah compliance. Takes a natural language query and routes to appropriate tools. Use for:
- Checking if a stock or ETF is halal / Shariah-compliant
- Calculating zakat on a stock portfolio
- Calculating dividend purification (cleansing) amounts
- Finding halal stocks by sector, exchange, or compliance status
- Comparing ETFs by Shariah compliance`,
    schema: GetShariahInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. LLM routes the query to the right sub-tool(s) via native tool calling
      onProgress?.('Analysing Shariah compliance query...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: SHARIAH_TOOLS,
      });
      const aiMessage = response as AIMessage;

      // 2. Verify tool calls were generated
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No Shariah tools selected for query' }, []);
      }

      // 3. Execute sub-tool calls in parallel
      const toolNames = [...new Set(toolCalls.map((tc) => formatSubToolName(tc.name)))];
      onProgress?.(`Fetching from ${toolNames.join(', ')}...`);

      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = SHARIAH_TOOL_MAP.get(tc.name);
            if (!tool) {
              throw new Error(`Shariah tool '${tc.name}' not found`);
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
        }),
      );

      // 4. Combine results into a single response
      const allUrls = results.flatMap((r) => r.sourceUrls);
      const combinedData: Record<string, unknown> = {};

      for (const result of results.filter((r) => r.error === null)) {
        const symbol = (result.args as Record<string, unknown>).symbol as string | undefined;
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
