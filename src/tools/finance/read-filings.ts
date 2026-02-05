import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';
import { getFilings, get10KFilingItems, get10QFilingItems, get8KFilingItems, getFilingItemTypes, type FilingItemTypes } from './filings.js';

// Escape curly braces for LangChain template interpolation
function escapeTemplateVars(str: string): string {
  return str.replace(/\{/g, '{{').replace(/\}/g, '}}');
}

// Step 1 tools: get filing metadata
const STEP1_TOOLS: StructuredToolInterface[] = [getFilings];

// Step 2 tools: read filing content
const STEP2_TOOLS: StructuredToolInterface[] = [
  get10KFilingItems,
  get10QFilingItems,
  get8KFilingItems,
];

const STEP2_TOOL_MAP = new Map(STEP2_TOOLS.map(t => [t.name, t]));

function buildStep1Prompt(): string {
  return `You are a SEC filings routing assistant.
Current date: ${getCurrentDate()}

Given a user query about SEC filings, call get_filings to fetch available filings.

## Guidelines

1. **Ticker Resolution**: Convert company names to ticker symbols:
   - Apple → AAPL, Tesla → TSLA, Microsoft → MSFT, Amazon → AMZN
   - Google/Alphabet → GOOGL, Meta/Facebook → META, Nvidia → NVDA

2. **Filing Type Inference**:
   - Risk factors, business description, annual data → 10-K
   - Quarterly results, recent performance → 10-Q
   - Material events, acquisitions, earnings announcements → 8-K
   - If unclear, omit filing_type to get recent filings of any type

3. **Limit**: Default to 3 filings unless query specifies otherwise

Call get_filings now with appropriate parameters.`;
}

function buildStep2Prompt(
  originalQuery: string,
  filingsData: unknown,
  itemTypes: FilingItemTypes
): string {
  const escapedFilings = escapeTemplateVars(JSON.stringify(filingsData, null, 2));
  
  // Format item types for the prompt
  const format10K = itemTypes['10-K'].map(i => `${i.name} (${i.title})`).join(', ');
  const format10Q = itemTypes['10-Q'].map(i => `${i.name} (${i.title})`).join(', ');
  
  return `You are a SEC filings content retrieval assistant.
Current date: ${getCurrentDate()}

Original user query: "${originalQuery}"

Available filings:
${escapedFilings}

## Valid Item Names

**10-K items:** ${format10K}

**10-Q items:** ${format10Q}

## Guidelines

1. Select the most relevant filing(s) based on the original query
2. Maximum 3 filings to read
3. **Always specify items** when the query targets specific sections - don't fetch entire filings unnecessarily:
   - Risk factors → items: ["Item-1A"]
   - Business description → items: ["Item-1"]
   - MD&A → items: ["Item-7"] (10-K) or ["Part-1,Item-2"] (10-Q)
   - Financial statements → items: ["Item-8"] (10-K) or ["Part-1,Item-1"] (10-Q)
4. If the query is broad or unclear, omit items to get the full filing
5. Call the appropriate items tool based on filing_type:
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
 * Uses two-step LLM workflow: Step 1 gets filings, Step 2 reads content.
 */
export function createReadFilings(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'read_filings',
    description: `Intelligent tool for reading SEC filing content. Takes a natural language query and retrieves full text from 10-K, 10-Q, or 8-K filings. Use for:
- Reading annual reports (10-K): business description, risk factors, MD&A
- Reading quarterly reports (10-Q): quarterly financials, MD&A
- Reading current reports (8-K): material events, acquisitions, earnings`,
    schema: ReadFilingsInputSchema,
    func: async (input) => {
      // Step 1: Get filings metadata
      const step1Response = await callLlm(input.query, {
        model,
        systemPrompt: buildStep1Prompt(),
        tools: STEP1_TOOLS,
      }) as AIMessage;

      const step1ToolCalls = step1Response.tool_calls as ToolCall[];
      if (!step1ToolCalls || step1ToolCalls.length === 0) {
        return formatToolResult({ error: 'Failed to parse query for filings' }, []);
      }

      // Execute getFilings
      const filingsCall = step1ToolCalls[0];
      const filingsRaw = await (STEP1_TOOLS[0] as StructuredToolInterface).invoke(filingsCall.args);
      const filingsResult = JSON.parse(typeof filingsRaw === 'string' ? filingsRaw : JSON.stringify(filingsRaw));
      
      if (!filingsResult.data?.length) {
        return formatToolResult({ 
          error: 'No filings found', 
          params: filingsCall.args 
        }, filingsResult.sourceUrls || []);
      }

      // Fetch canonical item types for Step 2
      const itemTypes = await getFilingItemTypes();

      // Step 2: Select and read filing content with canonical item names
      const step2Response = await callLlm(input.query, {
        model,
        systemPrompt: buildStep2Prompt(input.query, filingsResult.data, itemTypes),
        tools: STEP2_TOOLS,
      }) as AIMessage;

      const step2ToolCalls = step2Response.tool_calls as ToolCall[];
      if (!step2ToolCalls || step2ToolCalls.length === 0) {
        return formatToolResult({ 
          error: 'Failed to select filings to read',
          availableFilings: filingsResult.data,
        }, filingsResult.sourceUrls || []);
      }

      // Execute filing items calls in parallel
      const results = await Promise.all(
        step2ToolCalls.map(async (tc) => {
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
      for (const result of successfulResults) {
        const accession = (result.args as Record<string, unknown>).accession_number as string;
        combinedData[accession] = result.data;
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
