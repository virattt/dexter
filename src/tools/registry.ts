import { StructuredToolInterface } from '@langchain/core/tools';
import { discoverSkills } from '../skills/index.js';
import { getSearchConfig } from '../utils/config.js';
import { browserTool, BROWSER_DESCRIPTION } from './browser/browser.js';
import { webFetchTool, WEB_FETCH_DESCRIPTION } from './fetch/web-fetch.js';
import { editFileTool, EDIT_FILE_DESCRIPTION } from './filesystem/edit-file.js';
import { readFileTool, READ_FILE_DESCRIPTION } from './filesystem/read-file.js';
import { writeFileTool, WRITE_FILE_DESCRIPTION } from './filesystem/write-file.js';
import { GET_FINANCIALS_DESCRIPTION } from './finance/get-financials.js';
import { GET_MARKET_DATA_DESCRIPTION } from './finance/get-market-data.js';
import { createGetFinancials, createGetMarketData, createReadFilings, createScreenStocks } from './finance/index.js';
import { READ_FILINGS_DESCRIPTION } from './finance/read-filings.js';
import { SCREEN_STOCKS_DESCRIPTION } from './finance/screen-stocks.js';
import { heartbeatTool, HEARTBEAT_TOOL_DESCRIPTION } from './heartbeat/heartbeat-tool.js';
import { memoryGetTool, memorySearchTool, memoryUpdateTool, MEMORY_GET_DESCRIPTION, MEMORY_SEARCH_DESCRIPTION, MEMORY_UPDATE_DESCRIPTION } from './memory/index.js';
import { exaSearch, perplexitySearch, tavilySearch, WEB_SEARCH_DESCRIPTION, xSearchTool, X_SEARCH_DESCRIPTION } from './search/index.js';
import { skillTool, SKILL_TOOL_DESCRIPTION } from './skill.js';

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
 * Resolve the web search tool based on settings.search.provider preference.
 * "auto" (default) uses first available key: exa → perplexity → tavily.
 */
function resolveSearchTool(): StructuredToolInterface | null {
  const { provider } = getSearchConfig();

  if (provider === 'exa' || provider === 'auto') {
    if (process.env.EXASEARCH_API_KEY) return exaSearch;
    if (provider === 'exa') return null; // explicit choice but no key
  }
  if (provider === 'perplexity' || provider === 'auto') {
    if (process.env.PERPLEXITY_API_KEY) return perplexitySearch;
    if (provider === 'perplexity') return null;
  }
  if (provider === 'tavily' || provider === 'auto') {
    if (process.env.TAVILY_API_KEY) return tavilySearch;
  }
  return null;
}

/**
 * Get all registered tools with their descriptions.
 * Conditionally includes tools based on environment configuration.
 *
 * @param model - The model name (needed for tools that require model-specific configuration)
 * @param searchDescription - Optional override for web_search description (from SEARCH.md)
 * @returns Array of registered tools
 */
export function getToolRegistry(model: string, searchDescription?: string | null): RegisteredTool[] {
  const tools: RegisteredTool[] = [
    {
      name: 'get_financials',
      tool: createGetFinancials(model),
      description: GET_FINANCIALS_DESCRIPTION,
    },
    {
      name: 'get_market_data',
      tool: createGetMarketData(model),
      description: GET_MARKET_DATA_DESCRIPTION,
    },
    {
      name: 'read_filings',
      tool: createReadFilings(model),
      description: READ_FILINGS_DESCRIPTION,
    },
    {
      name: 'stock_screener',
      tool: createScreenStocks(model),
      description: SCREEN_STOCKS_DESCRIPTION,
    },
    {
      name: 'web_fetch',
      tool: webFetchTool,
      description: WEB_FETCH_DESCRIPTION,
    },
    {
      name: 'browser',
      tool: browserTool,
      description: BROWSER_DESCRIPTION,
    },
    {
      name: 'read_file',
      tool: readFileTool,
      description: READ_FILE_DESCRIPTION,
    },
    {
      name: 'write_file',
      tool: writeFileTool,
      description: WRITE_FILE_DESCRIPTION,
    },
    {
      name: 'edit_file',
      tool: editFileTool,
      description: EDIT_FILE_DESCRIPTION,
    },
    {
      name: 'heartbeat',
      tool: heartbeatTool,
      description: HEARTBEAT_TOOL_DESCRIPTION,
    },
    {
      name: 'memory_search',
      tool: memorySearchTool,
      description: MEMORY_SEARCH_DESCRIPTION,
    },
    {
      name: 'memory_get',
      tool: memoryGetTool,
      description: MEMORY_GET_DESCRIPTION,
    },
    {
      name: 'memory_update',
      tool: memoryUpdateTool,
      description: MEMORY_UPDATE_DESCRIPTION,
    },
  ];

  // Include web_search based on settings.search.provider (default: auto = exa → perplexity → tavily)
  const searchTool = resolveSearchTool();
  if (searchTool) {
    tools.push({
      name: 'web_search',
      tool: searchTool,
      description: searchDescription ?? WEB_SEARCH_DESCRIPTION,
    });
  }

  // Include x_search if X Bearer Token is configured
  if (process.env.X_BEARER_TOKEN) {
    tools.push({
      name: 'x_search',
      tool: xSearchTool,
      description: X_SEARCH_DESCRIPTION,
    });
  }

  // Include skill tool if any skills are available
  const availableSkills = discoverSkills();
  if (availableSkills.length > 0) {
    tools.push({
      name: 'skill',
      tool: skillTool,
      description: SKILL_TOOL_DESCRIPTION,
    });
  }

  return tools;
}

/**
 * Get just the tool instances for binding to the LLM.
 *
 * @param model - The model name
 * @param searchDescription - Optional override for web_search description (from SEARCH.md)
 * @returns Array of tool instances
 */
export function getTools(model: string, searchDescription?: string | null): StructuredToolInterface[] {
  return getToolRegistry(model, searchDescription).map((t) => t.tool);
}

/**
 * Build the tool descriptions section for the system prompt.
 * Formats each tool's rich description with a header.
 *
 * @param model - The model name
 * @param searchDescription - Optional override for web_search description (from SEARCH.md)
 * @returns Formatted string with all tool descriptions
 */
export function buildToolDescriptions(model: string, searchDescription?: string | null): string {
  return getToolRegistry(model, searchDescription)
    .map((t) => `### ${t.name}\n\n${t.description}`)
    .join('\n\n');
}
