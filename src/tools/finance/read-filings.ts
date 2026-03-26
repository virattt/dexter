import type { RunnableConfig } from '@langchain/core/runnables';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getCurrentDate } from '../../agent/prompts.js';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getFilings } from './filings.js';

/**
 * Rich description for the read_filings tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const READ_FILINGS_DESCRIPTION = `
Intelligent meta-tool for searching SEC filings. Takes a natural language query and returns filing metadata with links to full documents on EDGAR.

## When to Use

- Finding 10-K annual reports, 10-Q quarterly reports, or 8-K current reports
- Looking up filing dates, accession numbers, and document URLs
- Searching for specific types of SEC filings for a company

## When NOT to Use

- Stock prices (use get_market_data)
- Financial statements data in structured format (use get_financials)
- Company news (use get_market_data)
- Analyst estimates (use get_financials)
- Non-SEC data (use web_search)

## Usage Notes

- Call ONCE with the complete natural language query
- Handles ticker resolution (Apple -> AAPL)
- Returns filing metadata with EDGAR document URLs
- Follow the source URLs to read actual filing content
`.trim();

const FilingPlanSchema = z.object({
  ticker: z
    .string()
    .describe('Stock ticker symbol (e.g. AAPL, TSLA, MSFT)'),
  filing_types: z
    .array(z.enum(['10-K', '10-Q', '8-K']))
    .min(1)
    .describe('Filing type(s) required to answer the query'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe('Maximum filings to retrieve (default 10)'),
});

type FilingPlan = z.infer<typeof FilingPlanSchema>;

function buildPlanPrompt(): string {
  return `You are a SEC filings planning assistant.
Current date: ${getCurrentDate()}

Given a user query about SEC filings, return structured plan fields:
- ticker
- filing_types
- limit

## Guidelines

1. **Ticker Resolution**: Convert company names to ticker symbols:
   - Apple → AAPL, Tesla → TSLA, Microsoft → MSFT, Amazon → AMZN
   - Google/Alphabet → GOOGL, Meta/Facebook → META, Nvidia → NVDA

2. **Filing Type Inference**:
   - Risk factors, business description, annual data → 10-K
   - Quarterly results, recent performance → 10-Q
   - Material events, acquisitions, earnings announcements → 8-K
   - If broad, include multiple filing types

3. **Limit**: Default to 10 unless query specifies otherwise

Return only the structured output fields.`;
}

const ReadFilingsInputSchema = z.object({
  query: z.string().describe('Natural language query about SEC filings'),
});

/**
 * Create a read_filings tool configured with the specified model.
 * Uses LLM structured output to plan the filing search, then fetches metadata via Polygon.
 */
export function createReadFilings(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'read_filings',
    description: `Intelligent tool for searching SEC filings. Takes a natural language query and returns filing metadata with EDGAR document URLs. Use for:
- Finding annual reports (10-K)
- Finding quarterly reports (10-Q)
- Finding current reports (8-K)`,
    schema: ReadFilingsInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // Step 1: Plan ticker + filing types using structured output
      onProgress?.('Planning filing search...');
      let filingPlan: FilingPlan;
      try {
        const { response: step1Response } = await callLlm(input.query, {
          model,
          systemPrompt: buildPlanPrompt(),
          outputSchema: FilingPlanSchema,
        });
        filingPlan = FilingPlanSchema.parse(step1Response);
      } catch (error) {
        return formatToolResult(
          {
            error: 'Failed to plan filing search',
            details: error instanceof Error ? error.message : String(error),
          },
          [],
        );
      }

      // Step 2: Fetch filing metadata
      onProgress?.(`Fetching ${filingPlan.filing_types.join(', ')} filings for ${filingPlan.ticker}...`);
      try {
        const filingsRaw = await getFilings.invoke({
          ticker: filingPlan.ticker,
          filing_type: filingPlan.filing_types,
          limit: filingPlan.limit ?? 10,
        });
        const parsed = JSON.parse(
          typeof filingsRaw === 'string' ? filingsRaw : JSON.stringify(filingsRaw),
        ) as { data?: unknown; sourceUrls?: unknown };

        const filings = Array.isArray(parsed.data) ? parsed.data : [];
        const sourceUrls = Array.isArray(parsed.sourceUrls)
          ? parsed.sourceUrls.filter((u): u is string => typeof u === 'string')
          : [];

        if (filings.length === 0) {
          return formatToolResult(
            {
              error: 'No filings found',
              params: {
                ticker: filingPlan.ticker,
                filing_type: filingPlan.filing_types,
                limit: filingPlan.limit,
              },
            },
            sourceUrls,
          );
        }

        return formatToolResult(filings, sourceUrls);
      } catch (error) {
        return formatToolResult(
          {
            error: 'Failed to fetch filings',
            details: error instanceof Error ? error.message : String(error),
          },
          [],
        );
      }
    },
  });
}
