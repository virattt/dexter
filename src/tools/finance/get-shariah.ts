/**
 * get_shariah — intelligent meta-tool for Shariah finance queries.
 *
 * Routes natural language queries about Islamic finance to the appropriate
 * Halal Terminal API tools: stock/ETF compliance screening, portfolio scans,
 * side-by-side comparisons, zakat calculation, dividend purification,
 * Islamic news, and the halal stock database.
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
  scanPortfolioShariah,
  compareShariah,
  screenEtfShariah,
  compareEtfShariah,
  calculateZakat,
  calculatePurification,
  getDividendPurification,
  getIslamicNews,
  searchHalalDatabase,
} from './shariah.js';

export const GET_SHARIAH_DESCRIPTION = `
Intelligent meta-tool for Islamic finance and Shariah compliance queries. Routes natural language questions to the appropriate Halal Terminal API tools.

## When to Use

- Checking if a stock is halal / Shariah-compliant (e.g. "Is Apple halal?", "TSLA shariah status")
- Scanning a portfolio of stocks for compliance (e.g. "Screen my portfolio: AAPL, MSFT, GOOGL")
- Comparing stocks side-by-side for halal status (e.g. "Compare AAPL vs MSFT compliance")
- Screening ETFs for Shariah compliance (e.g. "Is QQQ halal?", "Screen SPY ETF")
- Comparing ETFs by halal compliance (e.g. "Which is more halal: HLAL or SPUS?")
- Calculating zakat on a stock portfolio
- Calculating dividend purification (cleansing) amounts
- Getting Islamic finance news or news about a specific halal stock
- Finding halal stocks by sector, country, or exchange
- Any question involving halal investing, Islamic finance, Shariah screening, zakat, or purification

## When NOT to Use

- Standard financial statements or ratios (use get_financials)
- Current stock prices or market data (use get_market_data)
- SEC filings (use read_filings)
- General stock screening by valuation metrics (use stock_screener)
- General web searches (use web_search)

## Usage Notes

- Call ONCE with a complete natural language query — routes internally
- Handles ticker resolution (Apple → AAPL, S&P 500 ETF → SPY)
- Returns Shariah compliance verdicts with AAOIFI, DJIM, FTSE, MSCI, S&P breakdowns
`.trim();

// All Shariah sub-tools
const SHARIAH_TOOLS: StructuredToolInterface[] = [
  screenStockShariah,
  scanPortfolioShariah,
  compareShariah,
  screenEtfShariah,
  compareEtfShariah,
  calculateZakat,
  calculatePurification,
  getDividendPurification,
  getIslamicNews,
  searchHalalDatabase,
];

const SHARIAH_TOOL_MAP = new Map(SHARIAH_TOOLS.map((t) => [t.name, t]));

function buildRouterPrompt(): string {
  return `You are an Islamic finance assistant specialising in Shariah compliance.
Current date: ${getCurrentDate()}

Given a user query about Shariah compliance or Islamic finance, call the most appropriate tool(s).

## Tool Selection Guide

### screen_stock_shariah
Use when asked if a specific STOCK is halal, compliant, or Shariah-screened.
- "Is Apple halal?" → screen_stock_shariah(symbol="AAPL")
- "Check Tesla shariah compliance" → screen_stock_shariah(symbol="TSLA")
- For multiple stocks, call once per ticker (up to 3 in parallel).

### scan_portfolio_shariah
Use when asked to screen a LIST of stocks as a portfolio.
- "Screen my portfolio: AAPL, MSFT, GOOGL, AMZN" → scan_portfolio_shariah(symbols=["AAPL","MSFT","GOOGL","AMZN"])
- Prefer this over multiple screen_stock_shariah calls for 4+ symbols.

### compare_shariah
Use when asked to COMPARE 2-5 stocks side-by-side for compliance.
- "Compare AAPL vs MSFT halal status" → compare_shariah(symbols=["AAPL","MSFT"])
- "Which is more halal: Google, Apple, or Amazon?" → compare_shariah(symbols=["GOOGL","AAPL","AMZN"])

### screen_etf_shariah
Use when asked if an ETF is halal or for its per-holding compliance breakdown.
- "Is QQQ halal?" → screen_etf_shariah(symbol="QQQ")
- "Screen the S&P 500 ETF" → screen_etf_shariah(symbol="SPY")

### compare_etf_shariah
Use when asked to compare ETFs by Shariah compliance.
- "Which halal ETF is best: HLAL, SPUS, or ISWD?" → compare_etf_shariah(symbols=["HLAL","SPUS","ISWD"])

### calculate_zakat
Use when asked to calculate zakat on stock holdings.
- "Calculate my zakat: $25,000 in AAPL and $18,000 in MSFT"
  → calculate_zakat(holdings=[{symbol:"AAPL",market_value:25000},{symbol:"MSFT",market_value:18000}])
- "I have 100 shares of AAPL at $190 and 50 shares of MSFT at $420, what's my zakat?"
  → calculate_zakat(holdings=[{symbol:"AAPL",market_value:19000},{symbol:"MSFT",market_value:21000}])

### calculate_purification
Use when asked about dividend purification for multiple holdings.
- "I received $320 from MSFT and $150 from AAPL in dividends, how much do I purify?"
  → calculate_purification(holdings=[{symbol:"MSFT",dividend_income:320},{symbol:"AAPL",dividend_income:150}])

### get_dividend_purification
Use when asked for dividend history WITH purification amounts for a single stock.
- "Show MSFT dividend purification history" → get_dividend_purification(symbol="MSFT")
- "How much should I have purified from AAPL dividends?" → get_dividend_purification(symbol="AAPL")

### get_islamic_news
Use when asked for Islamic finance news or news about a specific stock from an Islamic perspective.
- "Latest Islamic finance news" → get_islamic_news(category="islamic_finance")
- "News about AAPL for halal investors" → get_islamic_news(symbol="AAPL")
- "Any news about sukuk or AAOIFI?" → get_islamic_news(q="sukuk AAOIFI")

### search_halal_database
Use when asked to FIND or LIST stocks by sector, country, or exchange.
- "Find halal tech stocks on NASDAQ" → search_halal_database(sector="Technology", exchange="NASDAQ")
- "Show me healthcare companies in Saudi Arabia" → search_halal_database(sector="Healthcare", country="Saudi Arabia")
- "What ETFs are in the database?" → search_halal_database(asset_type="etfs")
- "Find companies named 'Islamic'" → search_halal_database(q="Islamic")

## Ticker Resolution
Apple → AAPL, Tesla → TSLA, Microsoft → MSFT, Amazon → AMZN, Google/Alphabet → GOOGL
Meta/Facebook → META, Nvidia → NVDA, Netflix → NFLX, Saudi Aramco → 2222.SR
Halal ETF → HLAL, SP Shariah ETF → SPUS, iShares MSCI World Islamic → ISWD
S&P 500 ETF → SPY, Nasdaq ETF → QQQ, Vanguard Total Market → VTI

Call the appropriate tool(s) now.`;
}

function formatSubToolName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const GetShariahInputSchema = z.object({
  query: z
    .string()
    .describe(
      'Natural language query about Shariah compliance, halal investing, zakat, purification, or Islamic finance',
    ),
});

/**
 * Create a get_shariah tool configured with the specified model.
 * Uses native LLM tool calling to route queries to the appropriate Shariah sub-tools.
 */
export function createGetShariah(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_shariah',
    description: `Intelligent meta-tool for Islamic finance and Shariah compliance. Takes a natural language query and routes to appropriate Halal Terminal API tools. Use for:
- Checking if a stock or ETF is halal / Shariah-compliant
- Scanning a portfolio of stocks for compliance
- Comparing stocks or ETFs side-by-side for halal status
- Calculating zakat on a stock portfolio
- Calculating dividend purification (cleansing) amounts
- Getting Islamic finance news
- Finding halal stocks by sector, country, or exchange`,
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
            if (!tool) throw new Error(`Shariah tool '${tc.name}' not found`);
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
        // Key by symbol (or first symbol in array) to disambiguate parallel calls to the same tool
        const symbol =
          (args.symbol as string | undefined) ||
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
