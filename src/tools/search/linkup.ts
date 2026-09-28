import { DynamicStructuredTool } from '@langchain/core/tools';
import { LinkupClient } from 'linkup-sdk';
import { z } from 'zod';
import { formatToolResult, parseSearchResults } from '../types.js';
import { logger } from '@/utils';

// Lazily initialized to avoid errors when API key is not set
let linkupClient: LinkupClient | null = null;

function getLinkupClient(): LinkupClient {
  if (!linkupClient) {
    linkupClient = new LinkupClient({ apiKey: process.env.LINKUP_API_KEY ?? '' });
  }
  return linkupClient;
}

export const linkupSearch = new DynamicStructuredTool({
  name: 'web_search',
  description:
    'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  func: async (input) => {
    try {
      const result = await getLinkupClient().search({
        query: input.query,
        depth: 'standard',
        outputType: 'searchResults',
        maxResults: 5,
      });
      const { parsed, urls } = parseSearchResults(result);
      return formatToolResult(parsed, urls);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Linkup API] error: ${message}`);
      throw new Error(`[Linkup API] ${message}`);
    }
  },
});
