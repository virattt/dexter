import { DynamicStructuredTool } from '@langchain/core/tools';
import { TavilySearch } from '@langchain/tavily';
import { z } from 'zod';
import { formatToolResult, parseSearchResults } from '../types.js';
import { logger } from '../../utils/logger.js';

// Lazily initialized to avoid errors when API key is not set
let tavilyClient: TavilySearch | null = null;

function getTavilyClient(): TavilySearch {
  if (!tavilyClient) {
    tavilyClient = new TavilySearch({ maxResults: 5 });
  }
  return tavilyClient;
}

export const tavilySearch = new DynamicStructuredTool({
  name: 'web_search',
  description:
    'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  func: async (input) => {
    try {
      const result = await getTavilyClient().invoke({ query: input.query });
      const { parsed, urls } = parseSearchResults(result);
      return formatToolResult(parsed, urls);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Tavily API] error: ${message}`);
      throw new Error(`[Tavily API] ${message}`);
    }
  },
});
