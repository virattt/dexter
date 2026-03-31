/**
 * Context compaction module — LLM summarization.
 *
 * Instead of dropping old tool results (losing information permanently),
 * this module asks a fast LLM to summarize all accumulated tool results
 * into a structured summary. The summary replaces the raw results in
 * subsequent iteration prompts while preserving key information.
 */

import { callLlm } from '../model/llm.js';
import { resolveProvider } from '../providers.js';
import type { TokenUsage } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Stop attempting compaction after this many consecutive failures. */
export const MAX_CONSECUTIVE_COMPACTION_FAILURES = 3;

/** Skip compaction when there are fewer tool results than this (clearing is fine). */
export const MIN_TOOL_RESULTS_FOR_COMPACTION = 3;

// ---------------------------------------------------------------------------
// Compaction prompt
// ---------------------------------------------------------------------------

const NO_TOOLS_PREAMBLE = `CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.

- Do NOT use any tool calls. You already have all the context you need below.
- Tool calls will be REJECTED and will waste your only turn — you will fail the task.
- Your entire response must be plain text: an <analysis> block followed by a <summary> block.

`;

const ANALYSIS_INSTRUCTION = `Before providing your final summary, wrap your analysis in <analysis> tags to organize your thoughts and ensure you've covered all necessary points. In your analysis process:

1. Chronologically review each tool call and its results. For each, thoroughly identify:
   - What data was requested and why
   - Key data points, numbers, and findings returned
   - Any errors, empty results, or unexpected responses
   - How this data relates to the user's original query
2. Double-check for numerical accuracy and completeness, addressing each required element thoroughly.`;

const BASE_COMPACT_PROMPT = `Your task is to create a detailed summary of the research session below. This summary must preserve all important data, findings, and numerical results so that work can continue without losing context.

${ANALYSIS_INSTRUCTION}

Your summary should include the following sections:

1. Original Query and Intent: The user's exact request and what they are trying to learn or accomplish.
2. Key Concepts: Important tickers, companies, sectors, financial metrics, or technical concepts involved.
3. Data Retrieved: For each tool call, summarize the tool name, arguments, and key results. Preserve important data points.
4. Errors and Retries: Any tool failures, empty results, or retried calls and their outcomes.
5. Analysis Progress: What has been analyzed so far, what conclusions or comparisons have been reached.
6. Numerical Data: ALL key numbers retrieved — prices, revenue figures, margins, ratios, growth rates, estimates, dates. This section is critical; do not omit any numbers that were returned by tools.
7. Pending Data Needs: What data has NOT yet been retrieved that would be needed to fully answer the query.
8. Current Work State: What was being worked on when this summary was requested.
9. Recommended Next Steps: What tool calls or analysis should happen next to complete the answer.

Here's an example of how your output should be structured:

<example>
<analysis>
[Your thought process, ensuring all numerical data and findings are captured accurately]
</analysis>

<summary>
1. Original Query and Intent:
   [Detailed description of what the user asked]

2. Key Concepts:
   - [Ticker/concept 1]
   - [Ticker/concept 2]

3. Data Retrieved:
   - [tool_name(args)]: [Key findings and data points]
   - [tool_name(args)]: [Key findings and data points]

4. Errors and Retries:
   - [Error description and resolution, or "None"]

5. Analysis Progress:
   [What has been analyzed, comparisons made, conclusions reached]

6. Numerical Data:
   - [Ticker/metric]: [value] ([date/period])
   - [Ticker/metric]: [value] ([date/period])

7. Pending Data Needs:
   - [Data still needed]

8. Current Work State:
   [What was being worked on]

9. Recommended Next Steps:
   [Next actions to take]

</summary>
</example>

Please provide your summary based on the research session below, following this structure and ensuring precision and thoroughness — especially for numerical data.`;

const NO_TOOLS_TRAILER =
  '\n\nREMINDER: Do NOT call any tools. Respond with plain text only — ' +
  'an <analysis> block followed by a <summary> block. ' +
  'Tool calls will be rejected and you will fail the task.';

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

export function buildCompactionPrompt(query: string, toolResults: string): string {
  return `${NO_TOOLS_PREAMBLE}${BASE_COMPACT_PROMPT}

Original query: ${query}

Data retrieved from tool calls:
${toolResults}${NO_TOOLS_TRAILER}`;
}

// ---------------------------------------------------------------------------
// Summary formatting
// ---------------------------------------------------------------------------

/**
 * Strip the <analysis> drafting scratchpad and format the <summary> section.
 */
export function formatCompactSummary(rawSummary: string): string {
  let formatted = rawSummary;

  // Strip analysis section — it improves summary quality but has no value once written.
  formatted = formatted.replace(/<analysis>[\s\S]*?<\/analysis>/, '');

  // Extract and format summary section
  const summaryMatch = formatted.match(/<summary>([\s\S]*?)<\/summary>/);
  if (summaryMatch) {
    const content = summaryMatch[1] || '';
    formatted = formatted.replace(
      /<summary>[\s\S]*?<\/summary>/,
      `Summary:\n${content.trim()}`,
    );
  }

  // Clean up extra whitespace
  formatted = formatted.replace(/\n\n+/g, '\n\n');

  return formatted.trim();
}

/**
 * Build the message that frames the compaction summary for the LLM.
 */
export function buildCompactSummaryMessage(summary: string): string {
  const formatted = formatCompactSummary(summary);

  return `This session is being continued from a previous research session that ran out of context. The summary below covers the data retrieved and analysis performed so far.

${formatted}

Continue working toward answering the query without asking the user any further questions. Resume directly — do not acknowledge the summary, do not recap what was happening. Pick up the research as if the break never happened.`;
}

// ---------------------------------------------------------------------------
// Core compaction function
// ---------------------------------------------------------------------------

export interface CompactContextParams {
  /** Main model name (used to resolve provider and fast model). */
  model: string;
  /** System prompt for the compaction call. */
  systemPrompt: string;
  /** Original user query. */
  query: string;
  /** Full formatted tool results from the scratchpad. */
  toolResults: string;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

export interface CompactResult {
  /** Formatted summary ready for injection into the iteration prompt. */
  summary: string;
  /** Raw LLM response (for debugging / scratchpad logging). */
  rawSummary: string;
  /** Token usage of the compaction LLM call. */
  usage?: TokenUsage;
}

/**
 * Summarize accumulated tool results into a structured summary using a fast LLM.
 * Throws on failure — caller is responsible for fallback to clearing.
 */
export async function compactContext(params: CompactContextParams): Promise<CompactResult> {
  const { model, systemPrompt, query, toolResults, signal } = params;

  // Resolve fast model for the current provider
  const provider = resolveProvider(model);
  const fastModel = provider.fastModel ?? model;

  // Build the compaction prompt
  const prompt = buildCompactionPrompt(query, toolResults);

  // Call LLM with no tools bound — callLlm returns string in this case
  const result = await callLlm(prompt, {
    model: fastModel,
    systemPrompt,
    signal,
  });

  const rawSummary = typeof result.response === 'string'
    ? result.response
    : String(result.response);

  if (!rawSummary.trim()) {
    throw new Error('Compaction returned empty response');
  }

  // Build the framed summary message
  const summary = buildCompactSummaryMessage(rawSummary);

  return {
    summary,
    rawSummary,
    usage: result.usage,
  };
}
