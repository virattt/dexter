import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getSetting } from '../../utils/config.js';
import { WEB_SEARCH_DESCRIPTION } from './index.js';
import { exaSearch } from './exa.js';
import { perplexitySearch } from './perplexity.js';
import { tavilySearch } from './tavily.js';

export interface WebSearchProvider {
  id: 'exa' | 'perplexity' | 'tavily';
  name: string;
  tool: {
    invoke: (input: { query: string }) => Promise<unknown>;
  };
}

async function invokeWebSearchProvider(provider: WebSearchProvider, query: string): Promise<string> {
  return provider.tool.invoke({ query }) as Promise<string>;
}

export async function searchWithProviders(query: string, providers: WebSearchProvider[]): Promise<string> {
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      return await invokeWebSearchProvider(provider, query);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider.name}: ${message}`);
    }
  }

  throw new Error(`[Web Search] All providers failed: ${errors.join(' | ')}`);
}

function orderProviders(providers: WebSearchProvider[]): WebSearchProvider[] {
  const preferredProvider = getSetting('webSearchPreferredProvider', null) as string | null;
  if (!preferredProvider) {
    return providers;
  }

  const preferred = providers.find((provider) => provider.id === preferredProvider);
  if (!preferred) {
    return providers;
  }

  return [preferred, ...providers.filter((provider) => provider.id !== preferredProvider)];
}

export function createWebSearchTool(): DynamicStructuredTool | null {
  const allProviders: WebSearchProvider[] = [
    ...(process.env.EXASEARCH_API_KEY ? [{ id: 'exa' as const, name: 'Exa' as const, tool: exaSearch }] : []),
    ...(process.env.PERPLEXITY_API_KEY ? [{ id: 'perplexity' as const, name: 'Perplexity' as const, tool: perplexitySearch }] : []),
    ...(process.env.TAVILY_API_KEY ? [{ id: 'tavily' as const, name: 'Tavily' as const, tool: tavilySearch }] : []),
  ];

  if (allProviders.length === 0) return null;

  return new DynamicStructuredTool({
    name: 'web_search',
    description: WEB_SEARCH_DESCRIPTION,
    schema: z.object({
      query: z.string().describe('The search query to look up on the web'),
    }),
    func: async (input) => searchWithProviders(input.query, orderProviders(allProviders)),
  });
}