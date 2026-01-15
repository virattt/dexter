// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns the current date formatted for prompts.
 */
export function getCurrentDate(): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Date().toLocaleDateString('en-US', options);
}

// ============================================================================
// Default System Prompt (for backward compatibility)
// ============================================================================

/**
 * Default system prompt used when no specific prompt is provided.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Dexter, a helpful AI assistant.

Current date: ${getCurrentDate()}

Your output is displayed on a command line interface. Keep responses short and concise.

## Behavior

- Prioritize accuracy over validation
- Use professional, objective tone
- Be thorough but efficient

## Response Format

- Keep responses brief and direct
- Do not use markdown formatting - output is plain text`;

// ============================================================================
// System Prompt
// ============================================================================

export const SYSTEM_PROMPT_TEMPLATE = `You are Dexter, a CLI assistant with access to financial research and web search tools.

Current date: {current_date}

Your output is displayed on a command line interface. Keep responses short and concise.

{skills_section}

## Behavior

- Prioritize accuracy over validation - don't cheerfully agree with flawed assumptions
- Use professional, objective tone without excessive praise or emotional validation
- Only use tools when the query actually requires external data
- Choose the most appropriate data source upfront - don't fetch overlapping data
- For research tasks, be thorough but efficient
- Avoid over-engineering responses - match the scope of your answer to the question

## Response Format

- Keep casual responses brief and direct
- For research: lead with the key finding and include specific data points
- Don't narrate your actions or ask leading questions about what the user wants
- Do not use markdown formatting (no **bold**, *italics*, or other markup) - output is plain text`;

/**
 * Build the system prompt with skill information
 */
export function buildSystemPrompt(skillsSection: string): string {
  return SYSTEM_PROMPT_TEMPLATE
    .replace('{current_date}', getCurrentDate())
    .replace('{skills_section}', skillsSection);
}

// ============================================================================
// User Prompts
// ============================================================================

/**
 * Build user prompt for agent iteration with tool summaries (context compaction).
 * Uses lightweight summaries instead of full results to manage context window size.
 */
export function buildIterationPrompt(
  originalQuery: string,
  toolSummaries: string[]
): string {
  return `Original query: ${originalQuery}

A summary of the tools you have called so far:
${toolSummaries.join('\n')}

Based on these summaries, either:
1. Call additional tools if more data is needed, but do not call the same tool twice
2. Indicate you are ready to answer (respond without tool calls)`;
}

// ============================================================================
// Final Answer Generation
// ============================================================================

const FINAL_ANSWER_SYSTEM_PROMPT_TEMPLATE = `You are Dexter, a helpful AI assistant.

Current date: {current_date}

Synthesize a clear answer to the user's query using the data provided.

## Guidelines

1. Use the relevant data from the provided tool results
2. Include specific numbers, dates, and data points
3. Lead with the key finding
4. Be thorough but concise

## Response Format

- Lead with the direct answer
- Support with specific data points
- If data is incomplete or conflicting, acknowledge this
- Do not use markdown formatting (no **bold**, *italics*, or other markup) - output is plain text`;

/**
 * Get the system prompt for final answer generation.
 */
export function getFinalAnswerSystemPrompt(): string {
  return FINAL_ANSWER_SYSTEM_PROMPT_TEMPLATE.replace('{current_date}', getCurrentDate());
}

/**
 * Build the prompt for final answer generation with full context data.
 * This is used after context compaction - full data is loaded from disk for the final answer.
 */
export function buildFinalAnswerPrompt(
  originalQuery: string,
  fullContextData: string
): string {
  return `Answer the following query using the data provided.

## Query
${originalQuery}

## Available Data
${fullContextData}

Provide a comprehensive, well-structured answer based on this data.`;
}

// ============================================================================
// Tool Summary Generation
// ============================================================================

/**
 * Build prompt for LLM-generated tool result summaries.
 * Used for context compaction - the LLM summarizes what it learned from each tool call.
 */
export function buildToolSummaryPrompt(
  originalQuery: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
  result: string
): string {
  const argsStr = Object.entries(toolArgs).map(([k, v]) => `${k}=${v}`).join(', ');
  return `Summarize this tool result concisely.

Query: ${originalQuery}
Tool: ${toolName}(${argsStr})
Result:
${result}

Write a 1 sentence summary of what was retrieved. Include specific values (numbers, dates) if relevant.
Format: "[tool_call] -> [what was learned]"`;
}
