import { DynamicStructuredTool } from '@langchain/core/tools';
import { Seltz } from 'seltz';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

// Lazily initialized to avoid errors when API key is not set
let seltzClient: Seltz | null = null;

function getSeltzClient(): Seltz {
  if (!seltzClient) {
    seltzClient = new Seltz();
  }
  return seltzClient;
}

export const seltzSearch = new DynamicStructuredTool({
  name: 'web_search',
  description:
    'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  func: async (input) => {
    try {
      const result = await getSeltzClient().search(input.query, 5);
      const urls = result.documents
        ?.map((doc) => doc.url)
        .filter((url): url is string => Boolean(url)) ?? [];
      return formatToolResult(result, urls);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Seltz API] error: ${message}`);
      throw new Error(`[Seltz API] ${message}`);
    }
  },
});
