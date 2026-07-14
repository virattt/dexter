import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '@/utils';

const CAESAR_API_URL = 'https://alpha.api.trycaesar.com/v1/search';

interface CaesarPassage {
  text?: string;
}

interface CaesarResult {
  title?: string;
  url?: string;
  canonical_url?: string;
  source_url?: string;
  snippet?: string;
  content?: string;
  passage?: string;
  // Extracts Caesar selected for this query, not a fixed chunking of the page.
  passages?: CaesarPassage[];
  metadata?: { published_at?: string | null };
  // score is a scalar at default verbosity, { value } at higher verbosity
  score?: number | { value?: number } | null;
}

interface CaesarResponse {
  results?: CaesarResult[];
}

// Caesar returns both a `snippet` (the page's meta description) and `passages`
// (spans it selected for this query). Prefer the passages: they carry the text
// that actually answers the query, so the agent rarely needs to fetch the page.
// Mirrors how the LangSearch provider prefers `summary` over its short `snippet`.
function contentFor(r: CaesarResult): string | undefined {
  const passages = (r.passages ?? []).map((p) => p.text?.trim()).filter((t): t is string => Boolean(t));
  if (passages.length) return passages.join('\n\n');
  return r.snippet ?? r.content ?? r.passage ?? undefined;
}

async function callCaesar(query: string): Promise<CaesarResponse> {
  const apiKey = process.env.CAESAR_API_KEY;
  if (!apiKey) {
    throw new Error('[Caesar API] CAESAR_API_KEY is not set');
  }

  const response = await fetch(CAESAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, max_results: 5 }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[Caesar API] ${response.status}: ${text}`);
  }

  return response.json() as Promise<CaesarResponse>;
}

export const caesarSearch = new DynamicStructuredTool({
  name: 'web_search',
  description:
    'Search the web for current information on any topic. Returns relevant search results with URLs and content snippets.',
  schema: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  func: async (input) => {
    try {
      const res = await callCaesar(input.query);

      const results = res.results ?? [];
      const urls: string[] = [];
      const formattedResults = results.map((r) => {
        const url = r.url ?? r.canonical_url ?? r.source_url;
        if (url && !urls.includes(url)) {
          urls.push(url);
        }
        const published = r.metadata?.published_at ?? undefined;
        return {
          title: r.title,
          url,
          snippet: contentFor(r),
          ...(published ? { published } : {}),
        };
      });

      const data = { results: formattedResults };
      return formatToolResult(data, urls.length ? urls : undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Caesar API] error: ${message}`);
      throw new Error(`[Caesar API] ${message}`);
    }
  },
});
