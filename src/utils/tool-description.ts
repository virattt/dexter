/**
 * Generate a deterministic human-readable description of a tool call.
 * Used for context compaction during the agent loop.
 * 
 * Examples:
 * - "AAPL income statements (annual) - 5 periods"
 * - '"bitcoin price" tavily search'
 */
export function getToolDescription(toolName: string, args: Record<string, unknown>): string {
  const parts: string[] = [];
  const usedKeys = new Set<string>();

  // Add ticker if present (most common identifier)
  if (args.ticker) {
    parts.push(String(args.ticker).toUpperCase());
    usedKeys.add('ticker');
  }

  // Add search query if present
  if (args.query) {
    parts.push(`"${args.query}"`);
    usedKeys.add('query');
  }

  // Format tool name: get_income_statements -> income statements
  const formattedToolName = toolName
    .replace(/^get_/, '')
    .replace(/^search_/, '')
    .replace(/_/g, ' ');
  parts.push(formattedToolName);

  // Add period qualifier if present
  if (args.period) {
    parts.push(`(${args.period})`);
    usedKeys.add('period');
  }

  // Add limit if present
  if (args.limit && typeof args.limit === 'number') {
    parts.push(`- ${args.limit} periods`);
    usedKeys.add('limit');
  }

  // Add date range if present
  if (args.start_date && args.end_date) {
    parts.push(`from ${args.start_date} to ${args.end_date}`);
    usedKeys.add('start_date');
    usedKeys.add('end_date');
  }

  // Append any remaining args not explicitly handled
  const remainingArgs = Object.entries(args)
    .filter(([key]) => !usedKeys.has(key))
    .map(([key, value]) => `${key}=${value}`);

  if (remainingArgs.length > 0) {
    parts.push(`[${remainingArgs.join(', ')}]`);
  }

  return parts.join(' ');
}
