import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult, parseSearchResults } from '../types.js';
import { logger } from '@/utils';

const LANGSEARCH_API_URL = 'https://api.langsearch.com/v1/web-search';

interface LangSearchResult {
  title?: string;
  url?: string;
  snippet?: string;
  summary?: string;
}

interface LangSearchResponse {
  webPages?: {
    value?: LangSearchResult[];
  };
}

export const langSearch = new DynamicStructuredTool({
  name: 'web_search',
  description:
    'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  func: async (input) => {
    try {
      const apiKey = process.env.LANGSEARCH_API_KEY;
      if (!apiKey) {
        throw new Error('LANGSEARCH_API_KEY is not set.');
      }

      const response = await fetch(LANGSEARCH_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input.query,
          count: 5,
          summary: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const rawResult = (await response.json()) as LangSearchResponse;
      const normalizedResult = {
        results: (rawResult.webPages?.value ?? []).map((item) => ({
          title: item.title,
          url: item.url,
          text: item.summary ?? item.snippet,
        })),
      };

      const { parsed, urls } = parseSearchResults(normalizedResult);
      return formatToolResult(parsed, urls);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[LangSearch API] error: ${message}`);
      throw new Error(`[LangSearch API] ${message}`);
    }
  },
});
