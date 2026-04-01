import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';
import { withTimeout, SUB_TOOL_TIMEOUT_MS } from './utils.js';
import { FINANCIAL_FORMATTERS } from './formatters.js';

/**
 * Rich description for the get_financials tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const GET_FINANCIALS_DESCRIPTION = `
Intelligent meta-tool for retrieving company financial data. Takes a natural language query and automatically routes to appropriate financial data sources.

## When to Use

- Company facts (sector, industry, market cap, number of employees, listing date, exchange, location, weighted average shares, website)
- Company financials (income statements, balance sheets, cash flow statements)
- Financial metrics and key ratios (P/E ratio, market cap, EPS, dividend yield, enterprise value, ROE, ROA, margins)
- Historical metrics and trend analysis across multiple periods
- Analyst estimates and price targets
- Revenue segment breakdowns
- Earnings data (EPS/revenue beat-miss, earnings surprises)
- Multi-company comparisons (pass the full query, it handles routing internally)

## When NOT to Use

- Stock or cryptocurrency prices (use get_market_data instead)
- Company news or insider trading activity (use get_market_data instead)
- General web searches or non-financial topics (use web_search instead)
- Questions that don't require external financial data (answer directly from knowledge)
- Non-public company information
- Real-time trading or order execution
- Reading SEC filing content (use read_filings instead)
- Stock screening by criteria (use stock_screener)

## Usage Notes

- Call ONCE with the complete natural language query - the tool handles complexity internally
- For comparisons like "compare AAPL vs MSFT revenue", pass the full query as-is
- Handles ticker resolution automatically (Apple -> AAPL, Microsoft -> MSFT)
- Handles date inference (e.g., "last quarter", "past 5 years", "YTD")
- Returns structured JSON data with source URLs for verification
`.trim();

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Import all finance tools directly (avoid circular deps with index.ts)
import { getIncomeStatements, getBalanceSheets, getCashFlowStatements, getAllFinancialStatements } from './fundamentals.js';
import { getKeyRatios, getHistoricalKeyRatios } from './key-ratios.js';
import { getAnalystEstimates } from './estimates.js';
import { getSegmentedRevenues } from './segments.js';
import { getEarnings } from './earnings.js';

// All finance tools available for routing
const FINANCE_TOOLS: StructuredToolInterface[] = [
  // Fundamentals
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  // Earnings
  getEarnings,
  // Key Ratios, Snapshots & Estimates
  getKeyRatios,
  getHistoricalKeyRatios,
  getAnalystEstimates,
  // Other Data
  getSegmentedRevenues,
];

// Create a map for quick tool lookup by name
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

2. **Date Inference**: Use schema-supported filters for date ranges:
   - "last year" → report_period_gte 1 year ago
   - "last quarter" → report_period_gte 3 months ago
   - "past 5 years" → report_period_gte 5 years ago and limit 5 (annual) or 20 (quarterly)
   - "YTD" → report_period_gte Jan 1 of current year

3. **Tool Selection**:
   - For latest financial metrics snapshot (P/E, margins, ROE, EPS, growth rates) → get_financial_metrics_snapshot
   - For historical P/E ratio, historical market cap, valuation metrics over time → get_key_ratios
   - For revenue, earnings, profitability → get_income_statements
   - For latest earnings release snapshot, EPS/revenue beat-miss, earnings surprises → get_earnings
   - For debt, assets, equity → get_balance_sheets
   - For cash flow, free cash flow → get_cash_flow_statements
   - For comprehensive analysis → get_all_financial_statements

4. **Efficiency**:
   - Prefer specific tools over general ones when possible
   - Use get_all_financial_statements only when multiple statement types needed
   - For comparisons between companies, call the same tool for each ticker
   - Always use the smallest limit that can answer the question:
     - Point-in-time/latest questions → limit 1
     - Short trend (2-3 periods) → limit 3
     - Medium trend (4-5 periods) → limit 5
   - Increase limit beyond defaults only when the user explicitly asks for long history (e.g., 10-year trend)

Call the appropriate tool(s) now.`;
}

// Input schema for the get_financials tool
const GetFinancialsInputSchema = z.object({
  query: z.string().describe('Natural language query about financial data'),
});

/**
 * Create a get_financials tool configured with the specified model.
 * Uses native LLM tool calling for routing queries to finance tools.
 */
export function createGetFinancials(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_financials',
    description: `Intelligent meta-tool for retrieving company financial data. Takes a natural language query and automatically routes to appropriate financial data tools. Use for:
- Company financials (income statements, balance sheets, cash flow)
- Financial metrics and key ratios (P/E ratio, market cap, EPS, dividend yield, ROE, margins)
- Historical metrics and trend analysis
- Analyst estimates and price targets
- Earnings data and revenue segments`,
    schema: GetFinancialsInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. Call LLM with finance tools bound (native tool calling)
      onProgress?.('Fetching...');
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
      const toolNames = [...new Set(toolCalls.map(tc => formatSubToolName(tc.name)))];
      onProgress?.(`Fetching from ${toolNames.join(', ')}...`);
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = FINANCE_TOOL_MAP.get(tc.name);
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
        const ticker = (result.args as Record<string, unknown>).ticker as string | undefined;
        const key = ticker ? `${result.tool}_${ticker}` : result.tool;
        const formatter = FINANCIAL_FORMATTERS[result.tool];
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
