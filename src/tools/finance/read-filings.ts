import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';
import { getFilings, get10KFilingItems, get10QFilingItems, get8KFilingItems, getFilingItemTypes, type FilingItemTypes } from './filings.js';

/**
 * Rich description for the read_filings tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const READ_FILINGS_DESCRIPTION = `
Intelligent meta-tool for reading SEC filing content. Takes a natural language query and handles the complete workflow of fetching filing metadata and reading the actual text content.

## When to Use

- Reading 10-K annual reports (business description, risk factors, MD&A, financial statements)
- Reading 10-Q quarterly reports (quarterly financials, MD&A, market risk disclosures)
- Reading 8-K current reports (material events, acquisitions, earnings announcements)
- Analyzing or comparing content across multiple SEC filings
- Extracting specific sections from filings (e.g., "AAPL risk factors", "TSLA business description")

## When NOT to Use

- Stock prices (use web_search)
- Financial statements data in structured format (use financial_metrics)
- Company news (use financial_search)
- Analyst estimates (use financial_search)
- Non-SEC data (use web_search)

## Usage Notes

- Call ONCE with the complete natural language query
- Handles ticker resolution (Apple -> AAPL)
- Handles filing type inference (risk factors -> 10-K, quarterly results -> 10-Q)
- API calls can be slow - tool limits to 3 filings max per query
- Intelligently retrieves specific sections when query targets particular content, full filing otherwise
`.trim();

// Escape curly braces for LangChain template interpolation
function escapeTemplateVars(str: string): string {
  return str.replace(/\{/g, '{{').replace(/\}/g, '}}');
}

const FilingTypeSchema = z.enum(['10-K', '10-Q', '8-K']);

const FilingPlanSchema = z.object({
  ticker: z
    .string()
    .describe('Stock ticker symbol (e.g. AAPL, TSLA, MSFT)'),
  filing_types: z
    .array(FilingTypeSchema)
    .min(1)
    .describe('Filing type(s) required to answer the query'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe('Maximum filings to retrieve per request (default 10)'),
});

type FilingPlan = z.infer<typeof FilingPlanSchema>;

// Step 2 tools: read filing content
const STEP2_TOOLS: StructuredToolInterface[] = [
  get10KFilingItems,
  get10QFilingItems,
  get8KFilingItems,
];

const STEP2_TOOL_MAP = new Map(STEP2_TOOLS.map(t => [t.name, t]));

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
   - If a query spans multiple time horizons or intents, include multiple filing types
   - If the query is broad, include all relevant filing types instead of leaving this empty

3. **Limit**: Default to 10 unless query specifies otherwise

Return only the structured output fields.`;
}

function buildStep2Prompt(
  originalQuery: string,
  filingsData: unknown,
  itemTypes: FilingItemTypes
): string {
  const escapedQuery = escapeTemplateVars(originalQuery);
  const escapedFilings = escapeTemplateVars(JSON.stringify(filingsData, null, 2));

  // Format item types with descriptions so the LLM can make informed selections
  const format10K = escapeTemplateVars(
    itemTypes['10-K'].map(i => `- ${i.name}: ${i.title} — ${i.description}`).join('\n')
  );
  const format10Q = escapeTemplateVars(
    itemTypes['10-Q'].map(i => `- ${i.name}: ${i.title} — ${i.description}`).join('\n')
  );

  return `You are a SEC filings content retrieval assistant.
Current date: ${getCurrentDate()}

Original user query: "${escapedQuery}"

Available filings:
${escapedFilings}

## Available Items

### 10-K Items
${format10K}

### 10-Q Items
${format10Q}

## Guidelines

1. Select the most relevant filing(s) based on the original query
2. Maximum 3 filings to read
3. **Always specify items for 10-K and 10-Q**. Full filing payloads are massive and should be avoided.
   - Risk factors → items: ["Item-1A"]
   - Business description → items: ["Item-1"]
   - MD&A → items: ["Item-7"] (10-K) or ["Part-1,Item-2"] (10-Q)
   - Financial statements → items: ["Item-8"] (10-K) or ["Part-1,Item-1"] (10-Q)
4. Select the minimum set of items required to answer the query
5. For 8-K filings, call get_8K_filing_items (items filtering is not required)
6. Call the appropriate items tool based on filing_type:
   - 10-K filings → get_10K_filing_items
   - 10-Q filings → get_10Q_filing_items  
   - 8-K filings → get_8K_filing_items

Call the appropriate filing items tool(s) now.`;
}

const ReadFilingsInputSchema = z.object({
  query: z.string().describe('Natural language query about SEC filing content to read'),
});

/**
 * Create a read_filings tool configured with the specified model.
 * Two-LLM-call workflow: structured output planning, then tool-calling item selection.
 */
export function createReadFilings(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'read_filings',
    description: `Intelligent tool for reading SEC filing content. Takes a natural language query and retrieves full text from 10-K, 10-Q, or 8-K filings. Use for:
- Reading annual reports (10-K): business description, risk factors, MD&A
- Reading quarterly reports (10-Q): quarterly financials, MD&A
- Reading current reports (8-K): material events, acquisitions, earnings`,
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
          []
        );
      }
      const filingLimit = filingPlan.limit ?? 10;

      // Steps 2-3: Fetch filings metadata + canonical item types in parallel
      onProgress?.(`Fetching ${filingPlan.filing_types.join(', ')} filings for ${filingPlan.ticker}...`);
      let filingsResult: { data: unknown[]; sourceUrls: string[] };
      let itemTypes: FilingItemTypes;
      try {
        const [filingsRaw, fetchedItemTypes] = await Promise.all([
          getFilings.invoke({
            ticker: filingPlan.ticker,
            filing_type: filingPlan.filing_types,
            limit: filingLimit,
          }),
          getFilingItemTypes(),
        ]);
        const parsedFilings = JSON.parse(
          typeof filingsRaw === 'string' ? filingsRaw : JSON.stringify(filingsRaw)
        ) as { data?: unknown; sourceUrls?: unknown };
        filingsResult = {
          data: Array.isArray(parsedFilings.data) ? parsedFilings.data : [],
          sourceUrls: Array.isArray(parsedFilings.sourceUrls)
            ? parsedFilings.sourceUrls.filter((u): u is string => typeof u === 'string')
            : [],
        };
        itemTypes = fetchedItemTypes;
      } catch (error) {
        return formatToolResult(
          {
            error: 'Failed to fetch filings metadata',
            details: error instanceof Error ? error.message : String(error),
            params: {
              ticker: filingPlan.ticker,
              filing_type: filingPlan.filing_types,
              limit: filingLimit,
            },
          },
          []
        );
      }

      if (filingsResult.data.length === 0) {
        return formatToolResult({
          error: 'No filings found',
          params: {
            ticker: filingPlan.ticker,
            filing_type: filingPlan.filing_types,
            limit: filingLimit,
          },
        }, filingsResult.sourceUrls);
      }

      const filingCount = filingsResult.data.length;
      onProgress?.(`Found ${filingCount} filing${filingCount !== 1 ? 's' : ''}, selecting content to read...`);

      // Step 2: Select and read filing content with canonical item names
      const { response: step2Response } = await callLlm('Select and call the appropriate filing item tools.', {
        model,
        systemPrompt: buildStep2Prompt(input.query, filingsResult.data, itemTypes),
        tools: STEP2_TOOLS,
      });
      const step2Message = step2Response as AIMessage;

      const step2ToolCalls = step2Message.tool_calls as ToolCall[];
      if (!step2ToolCalls || step2ToolCalls.length === 0) {
        return formatToolResult({ 
          error: 'Failed to select filings to read',
          availableFilings: filingsResult.data,
        }, filingsResult.sourceUrls || []);
      }

      const limitedToolCalls = step2ToolCalls.slice(0, 3);

      // Execute filing items calls in parallel
      onProgress?.(`Reading ${limitedToolCalls.length} filing${limitedToolCalls.length !== 1 ? 's' : ''}...`);
      const results = await Promise.all(
        limitedToolCalls.map(async (tc) => {
          try {
            const tool = STEP2_TOOL_MAP.get(tc.name);
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

      // Combine results
      const successfulResults = results.filter((r) => r.error === null);
      const failedResults = results.filter((r) => r.error !== null);
      const allUrls = [
        ...(filingsResult.sourceUrls || []),
        ...results.flatMap((r) => r.sourceUrls),
      ];

      const combinedData: Record<string, unknown> = {};
      for (const [index, result] of successfulResults.entries()) {
        const accession = (result.args as Record<string, unknown>).accession_number as string;
        const key = accession || `${result.tool}_${index}`;
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
