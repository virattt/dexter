import { DynamicStructuredTool } from '@langchain/core/tools';
import { ExaSearchResults } from '@langchain/exa';
import Exa from 'exa-js';
import { z } from 'zod';
import { formatToolResult, parseSearchResults } from '../types.js';

// Lazily initialized to avoid errors when API key is not set
let exaTool: ExaSearchResults | null = null;

function getExaTool(): ExaSearchResults {
  if (!exaTool) {
    const client = new Exa(process.env.EXASEARCH_API_KEY);
    exaTool = new ExaSearchResults({
      client,
      searchArgs: { numResults: 5, text: true },
    });
  }
  return exaTool!;
}

export const exaSearch = new DynamicStructuredTool({
  name: 'web_search',
  description:
    'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  func: async (input) => {
    const result = await getExaTool().invoke(input.query);
    const { parsed, urls } = parseSearchResults(result);
    return formatToolResult(parsed, urls);
  },
});
