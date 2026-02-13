import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Import all finance tools directly (avoid circular deps with index.ts)
import { getDirectSecFilings } from './sec_scraper.js';
import { getIncomeStatements, getBalanceSheets, getCashFlowStatements, getAllFinancialStatements } from './fundamentals.js';
import { getPriceSnapshot, getPrices } from './prices.js';
import { getKeyRatiosSnapshot, getKeyRatios } from './key-ratios.js';
import { getNews } from './news.js';
import { getAnalystEstimates } from './estimates.js';
import { getSegmentedRevenues } from './segments.js';
import { getCryptoPriceSnapshot, getCryptoPrices, getCryptoTickers } from './crypto.js';
import { getInsiderTrades } from './insider_trades.js';
import { getCompanyFacts } from './company_facts.js';

// All finance tools available for routing
const FINANCE_TOOLS: StructuredToolInterface[] = [
  // Price Data
  getPriceSnapshot,
  getPrices,
  getCryptoPriceSnapshot,
  getCryptoPrices,
  getCryptoTickers,
  // Fundamentals
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  // SEC Filings (direct scraper)
  getDirectSecFilings,
  // Key Ratios & Estimates
  getKeyRatiosSnapshot,
  getKeyRatios,
  getAnalystEstimates,
  // Other Data
  getNews,
  getInsiderTrades,
  getSegmentedRevenues,
  getCompanyFacts,
];

const FINANCE_TOOL_MAP = new Map(FINANCE_TOOLS.map(t => [t.name, t]));

// Build the router system prompt - simplified since LLM sees tool schemas
function buildRouterPrompt(): string {
  return `You are a financial data routing assistant.
Current date: ${getCurrentDate()}

Given a user's natural language query about financial data, call the appropriate financial tool(s).

## Guidelines

1. **Ticker Resolution**: Convert company names to ticker symbols:
   - Apple → AAPL, Tesla → TSLA, Microsoft → MSFT, Amazon → AMZN
   - Google/Alphabet → GOOGL, Meta/Facebook → META, Nvidia → NVDA

2. **Date Inference**: Convert relative dates to YYYY-MM-DD format:
   - "last year" → start_date 1 year ago, end_date today
   - "last quarter" → start_date 3 months ago, end_date today
   - "past 5 years" → start_date 5 years ago, end_date today
   - "YTD" → start_date Jan 1 of current year, end_date today

3. **Tool Selection**:
   - For SEC filings (8-K, 6-K, 10-K, 10-Q, etc.), use get_direct_sec_filings.
   - For "current" or "latest" data, use snapshot tools (get_price_snapshot, get_key_ratios_snapshot)
   - For "historical" or "over time" data, use date-range tools
   - For P/E ratio, market cap, valuation metrics → get_key_ratios_snapshot
   - For revenue, earnings, profitability → get_income_statements
   - For debt, assets, equity → get_balance_sheets
   - For cash flow, free cash flow → get_cash_flow_statements
   - For comprehensive analysis → get_all_financial_statements

4. **Efficiency**:
   - Prefer specific tools over general ones when possible
   - Use get_all_financial_statements only when multiple statement types needed
   - For comparisons between companies, call the same tool for each ticker

Call the appropriate tool(s) now.`;
}

const FinancialSearchInputSchema = z.object({
  query: z.string().describe('Natural language query about financial data'),
});

/**
 * Create a financial_search tool configured with the specified model.
 * Uses native LLM tool calling for routing queries to finance tools.
 * Includes SEC filing force-route and API-failure fallback to get_direct_sec_filings.
 */
export function createFinancialSearch(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'financial_search',
    description: `Intelligent agentic search for financial data. Takes a natural language query and automatically routes to appropriate financial data tools. Use for:
- Stock prices (current or historical)
- Company financials (income statements, balance sheets, cash flow)
- Financial metrics (P/E ratio, market cap, EPS, dividend yield)
- SEC filings (8-K, 6-K, 10-K, 10-Q, etc.)
- Analyst estimates and price targets
- Company news
- Insider trading activity
- Cryptocurrency prices`,
    schema: FinancialSearchInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
      const q = input.query;

      // SEC filing force-route: when query clearly asks for filings and has a ticker
      const isFilingRequest = /filing|8-k|6-k|10-k|10-q|report|sec/i.test(q);
      const tickerMatch = q.match(/\b[A-Z]{2,5}\b/i);
      const likelyTicker = tickerMatch ? tickerMatch[0].toUpperCase() : null;

      if (isFilingRequest && likelyTicker) {
        onProgress?.(`Fetching SEC filings for ${likelyTicker}...`);
        try {
          const result = await getDirectSecFilings.invoke({ ticker: likelyTicker });
          const parsed = JSON.parse(typeof result === 'string' ? result : JSON.stringify(result));
          if (!parsed.error) {
            return formatToolResult(
              { get_direct_sec_filings: parsed.data ?? parsed },
              parsed.sourceUrls ?? []
            );
          }
        } catch {
          // Fall through to LLM routing
        }
      }

      // 1. Call LLM with finance tools bound (native tool calling)
      onProgress?.('Searching...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: FINANCE_TOOLS,
      });
      const aiMessage = response as AIMessage;

      // 2. Check for tool calls
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'No tools selected for query' }, []);
      }

      // 3. Execute tool calls in parallel
      const toolNames = toolCalls.map(tc => formatSubToolName(tc.name));
      onProgress?.(`Fetching from ${toolNames.join(', ')}...`);
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = FINANCE_TOOL_MAP.get(tc.name);
            if (!tool) throw new Error(`Tool '${tc.name}' not found`);
            const rawResult = await tool.invoke(tc.args);
            const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
            const parsed = JSON.parse(result);
            return {
              tool: tc.name,
              args: tc.args,
              data: parsed.data,
              sourceUrls: parsed.sourceUrls ?? [],
              error: null,
            };
          } catch (error) {
            return {
              tool: tc.name,
              args: tc.args,
              data: null,
              sourceUrls: [] as string[],
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      const allUrls = results.flatMap((r) => r.sourceUrls);
      const combinedData: Record<string, unknown> = {};
      const failedResults: Array<{ tool: string; args: unknown; error: string }> = [];

      for (const r of results) {
        const isApiError =
          r.error &&
          (String(r.error).includes('402') ||
            String(r.error).includes('Payment') ||
            String(r.error).includes('Subscription') ||
            String(r.error).includes('Financial Datasets API'));
        const ticker =
          ((r.args as Record<string, unknown>)?.ticker as string | undefined) ??
          (q.match(/\b[A-Z]{2,5}\b/i)?.[0]?.toUpperCase());

        if (isApiError && ticker) {
          try {
            const fallbackResult = await getDirectSecFilings.invoke({ ticker });
            const parsedFallback = JSON.parse(
              typeof fallbackResult === 'string' ? fallbackResult : JSON.stringify(fallbackResult)
            );
            if (!parsedFallback.error) {
              combinedData['sec_filing_data'] = parsedFallback.data ?? parsedFallback;
              if (Array.isArray(parsedFallback.sourceUrls)) {
                allUrls.push(...parsedFallback.sourceUrls);
              }
              continue;
            }
          } catch {
            // Fall through to record as failed
          }
        }

        if (r.error === null) {
          const key = (r.args as Record<string, unknown>).ticker
            ? `${r.tool}_${(r.args as Record<string, unknown>).ticker}`
            : r.tool;
          combinedData[key] = r.data;
        } else {
          failedResults.push({ tool: r.tool, args: r.args, error: r.error });
        }
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
