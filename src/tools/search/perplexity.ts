import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { logger } from '@/utils';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const SONAR_MODEL = 'sonar';

interface PerplexitySearchResult {
  title: string;
  url: string;
  date?: string | null;
  snippet?: string;
}

interface PerplexityCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  citations?: string[] | null;
  search_results?: PerplexitySearchResult[] | null;
}

async function callPerplexity(query: string): Promise<PerplexityCompletionResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('[Perplexity API] PERPLEXITY_API_KEY is not set');
  }

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SONAR_MODEL,
      messages: [{ role: 'user' as const, content: query }],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[Perplexity API] ${response.status}: ${text}`);
  }

  return response.json() as Promise<PerplexityCompletionResponse>;
}

export const perplexitySearch = new DynamicStructuredTool({
  name: 'web_search',
  description:
    'Search the web for current information on any topic. Returns a grounded, citation-backed answer with source URLs.',
  schema: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  func: async (input) => {
    try {
      const res = await callPerplexity(input.query);
      const content = res.choices?.[0]?.message?.content ?? '';
      const urls: string[] = [];
      if (Array.isArray(res.citations)) {
        urls.push(...res.citations);
      }
      if (Array.isArray(res.search_results)) {
        for (const r of res.search_results) {
          if (r?.url && !urls.includes(r.url)) {
            urls.push(r.url);
          }
        }
      }
      const data = {
        answer: content,
        results:
          res.search_results?.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet ?? undefined,
          })) ?? [],
      };
      return formatToolResult(data, urls.length ? urls : undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Perplexity API] error: ${message}`);
      throw new Error(`[Perplexity API] ${message}`);
    }
  },
});
