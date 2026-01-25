import { StructuredToolInterface } from '@langchain/core/tools';
import { createFinancialSearch } from './finance/index.js';
import { exaSearch, tavilySearch } from './search/index.js';
import { FINANCIAL_SEARCH_DESCRIPTION, WEB_SEARCH_DESCRIPTION } from './descriptions/index.js';

/**
 * A registered tool with its rich description for system prompt injection.
 */
export interface RegisteredTool {
  /** Tool name (must match the tool's name property) */
  name: string;
  /** The actual tool instance */
  tool: StructuredToolInterface;
  /** Rich description for system prompt (includes when to use, when not to use, etc.) */
  description: string;
}

/**
 * Get all registered tools with their descriptions.
 * Conditionally includes tools based on environment configuration.
 *
 * @param model - The model name (needed for tools that require model-specific configuration)
 * @returns Array of registered tools
 */
export function getToolRegistry(model: string): RegisteredTool[] {
  const tools: RegisteredTool[] = [
    {
      name: 'financial_search',
      tool: createFinancialSearch(model),
      description: FINANCIAL_SEARCH_DESCRIPTION,
    },
  ];

  // Include web_search if Exa or Tavily API key is configured (Exa preferred)
  if (process.env.EXASEARCH_API_KEY) {
    tools.push({
      name: 'web_search',
      tool: exaSearch,
      description: WEB_SEARCH_DESCRIPTION,
    });
  } else if (process.env.TAVILY_API_KEY) {
    tools.push({
      name: 'web_search',
      tool: tavilySearch,
      description: WEB_SEARCH_DESCRIPTION,
    });
  }

  return tools;
}

/**
 * Get just the tool instances for binding to the LLM.
 *
 * @param model - The model name
 * @returns Array of tool instances
 */
export function getTools(model: string): StructuredToolInterface[] {
  return getToolRegistry(model).map((t) => t.tool);
}

/**
 * Build the tool descriptions section for the system prompt.
 * Formats each tool's rich description with a header.
 *
 * @param model - The model name
 * @returns Formatted string with all tool descriptions
 */
export function buildToolDescriptions(model: string): string {
  return getToolRegistry(model)
    .map((t) => `### ${t.name}\n\n${t.description}`)
    .join('\n\n');
}
