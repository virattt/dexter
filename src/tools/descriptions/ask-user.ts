/**
 * Rich description for the ask_user tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const ASK_USER_DESCRIPTION = `
Ask the user a follow-up or clarifying question to get more context.

## When to Use

- When the user's query is ambiguous and could be interpreted multiple ways
- Before embarking on a lengthy research deep dive, to confirm scope or focus
- When you need a specific detail the user hasn't provided (e.g., time period, specific company, metric preference)
- When the user's intent is unclear and guessing could waste effort

## When NOT to Use

- When the query is clear and actionable — just do the work
- When you can reasonably infer the user's intent from context
- To confirm obvious next steps — be decisive
- Multiple times in a row — ask one clear question, then proceed with the answer

## Usage Notes

- Ask ONE focused question at a time
- Be specific about what you need — avoid vague "can you clarify?" questions
- After receiving the answer, proceed immediately with the research
`.trim();
