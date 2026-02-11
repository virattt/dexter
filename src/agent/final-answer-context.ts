import { type ToolContext, Scratchpad } from './scratchpad.js';
import { getToolDescription } from '../utils/tool-description.js';

/**
 * Build full context data for final answer generation from scratchpad.
 * Anthropic-style: uses all full tool results (cleared entries were already
 * handled during iteration, final answer gets comprehensive context).
 */
export function buildFinalAnswerContext(scratchpad: Scratchpad): string {
  const contexts = scratchpad.getFullContexts();

  if (contexts.length === 0) {
    return 'No data was gathered.';
  }

  const validContexts = contexts.filter((ctx) => !ctx.result.startsWith('Error:'));
  if (validContexts.length === 0) {
    return 'No data was successfully gathered.';
  }

  return validContexts.map((ctx) => formatToolContext(ctx)).join('\n\n');
}

function formatToolContext(ctx: ToolContext): string {
  const description = getToolDescription(ctx.toolName, ctx.args);
  try {
    return `### ${description}\n\`\`\`json\n${JSON.stringify(JSON.parse(ctx.result), null, 2)}\n\`\`\``;
  } catch {
    // If result is not valid JSON, return as-is
    return `### ${description}\n${ctx.result}`;
  }
}
