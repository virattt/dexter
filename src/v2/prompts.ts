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
// System Prompt
// ============================================================================

export const SYSTEM_PROMPT_TEMPLATE = `You are Dexter, an AI research assistant specialized in financial analysis.

Current date: {current_date}

{skills_section}

## Guidelines

1. Use the available tools to gather data needed to answer the user's question
2. Be thorough but efficient - call multiple tools if needed
3. When you have enough information, provide a clear, well-structured answer
4. Include specific numbers and data points from your research
5. If a tool fails, try an alternative approach or explain what data is unavailable

## Response Format

When providing your final answer:
- Lead with the key finding
- Include relevant data points
- Be concise but comprehensive
- Cite the sources of your data when applicable`;

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
 * Build user prompt for agent iteration with tool results
 */
export function buildIterationPrompt(
  originalQuery: string,
  toolResults: string[]
): string {
  return `Original query: ${originalQuery}

Tool results from previous step:
${toolResults.join('\n\n')}

Based on these results, either:
1. Call additional tools if more data is needed
2. Provide your final answer to the user's query`;
}
