import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';

/**
 * Rich description for the financial_metrics tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const FINANCIAL_METRICS_DESCRIPTION = `
Intelligent meta-tool for fundamental analysis and financial metrics. Takes a natural language query and routes to financial statements and key ratios tools.

## When to Use

- Income statement data (revenue, gross profit, operating income, net income, EPS)
- Balance sheet data (assets, liabilities, equity, debt, cash)
- Cash flow data (operating cash flow, investing cash flow, financing cash flow, free cash flow)
- Financial metrics (P/E ratio, EV/EBITDA, ROE, ROA, margins, dividend yield)
- Trend analysis across multiple periods
- Multi-company fundamental comparisons

## When NOT to Use

- Stock prices (use web_search)
- SEC filings content (use financial_search)
- Company news (use financial_search)
- Analyst estimates (use financial_search)
- Non-financial data (use web_search)

## Usage Notes

- Call ONCE with full natural language query
- Handles ticker resolution (Apple -> AAPL)
- Handles date inference ("last 5 years", "Q3 2024")
- For "current" metrics, uses snapshot tools; for "historical", uses time-series tools
`.trim();

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Import fundamental analysis tools directly (avoid circular deps with index.ts)
import { getIncomeStatements, getBalanceSheets, getCashFlowStatements, getAllFinancialStatements } from './fundamentals.js';
import { getKeyRatios } from './key-ratios.js';

// Fundamental analysis tools available for routing
const METRICS_TOOLS: StructuredToolInterface[] = [
  // Financial Statements
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  // Key Ratios
  getKeyRatios,
];

// Create a map for quick tool lookup by name
const METRICS_TOOL_MAP = new Map(METRICS_TOOLS.map(t => [t.name, t]));

// Build the router system prompt for fundamental analysis
function buildRouterPrompt(): string {
  return `You are a fundamental analysis routing assistant.
Current date: ${getCurrentDate()}

Given a user's natural language query about financial statements or metrics, call the appropriate tool(s).

## Guidelines

1. **Ticker Resolution**: Convert company names to ticker symbols:
   - Apple → AAPL, Tesla → TSLA, Microsoft → MSFT, Amazon → AMZN
   - Google/Alphabet → GOOGL, Meta/Facebook → META, Nvidia → NVDA

2. **Date Inference**: Convert relative dates to YYYY-MM-DD format:
   - "last year" → report_period_gte 1 year ago
   - "last quarter" → report_period_gte 3 months ago
   - "past 5 years" → report_period_gte 5 years ago, limit 5 (for annual) or 20 (for quarterly)
   - "YTD" → report_period_gte Jan 1 of current year

3. **Tool Selection**:
   - For historical metrics over time → get_key_ratios
   - For revenue, earnings, profitability → get_income_statements
   - For debt, assets, equity, cash position → get_balance_sheets
   - For cash flow, free cash flow, operating cash → get_cash_flow_statements
   - For comprehensive analysis needing all three → get_all_financial_statements

4. **Period Selection**:
   - Default to "annual" for multi-year trend analysis
   - Use "quarterly" for recent performance or seasonal analysis
   - Use "ttm" (trailing twelve months) for current state metrics

5. **Efficiency**:
   - Prefer specific statement tools over get_all_financial_statements when possible
   - Use get_all_financial_statements when multiple statement types are needed
   - For comparisons between companies, call the same tool for each ticker
   - Always use the smallest limit that can answer the question:
     - Point-in-time/latest questions → limit 1
     - Short trend (2-3 periods) → limit 3
     - Medium trend (4-5 periods) → limit 5
   - Increase limit beyond defaults only when the user explicitly asks for long history (e.g., 10-year trend)

Call the appropriate tool(s) now.`;
}

// Input schema for the financial_metrics tool
const FinancialMetricsInputSchema = z.object({
  query: z.string().describe('Natural language query about financial statements or metrics'),
});

/**
 * Create a financial_metrics tool configured with the specified model.
 * Uses native LLM tool calling for routing queries to fundamental analysis tools.
 */
export function createFinancialMetrics(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'financial_metrics',
    description: `Intelligent agentic search for fundamental analysis. Takes a natural language query and automatically routes to financial statements and key ratios tools. Use for:
- Income statements (revenue, gross profit, operating income, net income, EPS)
- Balance sheets (assets, liabilities, equity, debt, cash)
- Cash flow statements (operating, investing, financing activities, free cash flow)
- Key ratios (P/E, EV/EBITDA, ROE, ROA, margins, dividend yield)
- Multi-period trend analysis
- Multi-company fundamental comparisons`,
    schema: FinancialMetricsInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. Call LLM with metrics tools bound (native tool calling)
      onProgress?.('Searching...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: METRICS_TOOLS,
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
            const tool = METRICS_TOOL_MAP.get(tc.name);
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

      // Collect all source URLs
      const allUrls = results.flatMap((r) => r.sourceUrls);

      // Build combined data structure
      const combinedData: Record<string, unknown> = {};

      for (const result of successfulResults) {
        // Use tool name as key, or tool_ticker for multiple calls to same tool
        const ticker = (result.args as Record<string, unknown>).ticker as string | undefined;
        const key = ticker ? `${result.tool}_${ticker}` : result.tool;
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
