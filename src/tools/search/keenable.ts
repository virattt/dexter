import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '@/utils';

// Keenable works without an API key via its public endpoint. A key is optional
// and only lifts the keyless rate limits (10 req/s, 1000 req/hour per IP).
const KEENABLE_PUBLIC_URL = 'https://api.keenable.ai/v1/search/public';
const KEENABLE_KEYED_URL = 'https://api.keenable.ai/v1/search';
const MAX_RESULTS = 5;
const SNIPPET_MAX_LENGTH = 1000;

interface KeenableResult {
  title?: string;
  url: string;
  description?: string;
  snippet?: string;
  acquired_at?: string;
}

interface KeenableResponse {
  query?: string;
  results?: KeenableResult[];
}

function getKeenableApiKey(): string | undefined {
  const key = process.env.KEENABLE_API_KEY?.trim();
  // Ignore the env.example placeholder so a copied .env still runs keyless.
  if (!key || key.startsWith('your-')) return undefined;
  return key;
}

export async function callKeenable(query: string): Promise<KeenableResponse> {
  const apiKey = getKeenableApiKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Identifies the calling app; required by the public endpoint.
    'X-Keenable-Title': 'dexter',
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const response = await fetch(apiKey ? KEENABLE_KEYED_URL : KEENABLE_PUBLIC_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      max_results: MAX_RESULTS,
      snippet_max_length: SNIPPET_MAX_LENGTH,
    }),
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`429: rate limit exceeded${retryAfter ? ` (retry after ${retryAfter}s)` : ''}`);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }

  return response.json() as Promise<KeenableResponse>;
}

export const keenableSearch = new DynamicStructuredTool({
  name: 'web_search',
  description:
    'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  func: async (input) => {
    try {
      const res = await callKeenable(input.query);

      const results = res.results ?? [];
      const urls: string[] = [];
      const formattedResults = results.map((r) => {
        if (r.url && !urls.includes(r.url)) {
          urls.push(r.url);
        }
        return {
          title: r.title,
          url: r.url,
          // `snippet` carries the page text; `description` is usually empty.
          snippet: r.snippet || r.description || undefined,
        };
      });

      const data = { results: formattedResults };
      return formatToolResult(data, urls.length ? urls : undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Keenable API] error: ${message}`);
      throw new Error(`[Keenable API] ${message}`);
    }
  },
});
