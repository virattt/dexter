import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '@/utils';

const LANGSEARCH_API_URL = 'https://api.langsearch.com/v1/web-search';

interface LangSearchWebPage {
  name: string;
  url: string;
  snippet?: string;
  summary?: string;
}

interface LangSearchResponse {
  code: number;
  msg?: string | null;
  data?: {
    _type?: string;
    queryContext?: { originalQuery?: string };
    webPages?: {
      totalEstimatedMatches?: number | null;
      value?: LangSearchWebPage[];
    };
  };
}

async function callLangSearch(query: string): Promise<LangSearchResponse> {
  const apiKey = process.env.LANGSEARCH_API_KEY;
  if (!apiKey) {
    throw new Error('[LangSearch API] LANGSEARCH_API_KEY is not set');
  }

  const response = await fetch(LANGSEARCH_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      summary: true,
      count: 10,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[LangSearch API] ${response.status}: ${text}`);
  }

  return response.json() as Promise<LangSearchResponse>;
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
      const res = await callLangSearch(input.query);

      if (res.code !== 200) {
        throw new Error(`[LangSearch API] Error code ${res.code}: ${res.msg ?? 'Unknown error'}`);
      }

      const results = res.data?.webPages?.value ?? [];
      const urls: string[] = [];
      const formattedResults = results.map((r) => {
        if (r.url && !urls.includes(r.url)) {
          urls.push(r.url);
        }
        return {
          title: r.name,
          url: r.url,
          snippet: r.summary ?? r.snippet ?? undefined,
        };
      });

      const data = { results: formattedResults };
      return formatToolResult(data, urls.length ? urls : undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[LangSearch API] error: ${message}`);
      throw new Error(`[LangSearch API] ${message}`);
    }
  },
});
