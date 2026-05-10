import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getSetting } from '../../utils/config.js';
import { WEB_SEARCH_DESCRIPTION } from './web-search-description.js';
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

export function createWebSearchTool(): DynamicStructuredTool {
  const providers: WebSearchProvider[] = [
    { id: 'exa', name: 'Exa', tool: exaSearch },
    { id: 'perplexity', name: 'Perplexity', tool: perplexitySearch },
    { id: 'tavily', name: 'Tavily', tool: tavilySearch },
  ];

  return new DynamicStructuredTool({
    name: 'web_search',
    description: WEB_SEARCH_DESCRIPTION,
    schema: z.object({
      query: z.string().describe('The search query to look up on the web'),
    }),
    func: async (input) => searchWithProviders(input.query, orderProviders(providers)),
  });
}