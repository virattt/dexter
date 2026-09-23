import { DynamicStructuredTool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { WEB_SEARCH_DESCRIPTION, exaSearch, perplexitySearch, tavilySearch, langSearch } from './index.js';
import { parallelSearch } from './parallel.js';
import { getSetting } from '../../utils/config.js';
import type { SearchProviderId } from '../../utils/env.js';

export interface WebSearchProvider {
  id: SearchProviderId;
  name: string;
  tool: StructuredToolInterface;
}

/** Keep anonymous search out of automatic fallback unless explicitly selected. */
export function getWebSearchProviders(): WebSearchProvider[] {
  const providers: WebSearchProvider[] = [];
  if (process.env.EXASEARCH_API_KEY) {
    providers.push({ id: 'exa', name: 'Exa', tool: exaSearch });
  }
  if (process.env.PERPLEXITY_API_KEY) {
    providers.push({ id: 'perplexity', name: 'Perplexity', tool: perplexitySearch });
  }
  if (process.env.TAVILY_API_KEY) {
    providers.push({ id: 'tavily', name: 'Tavily', tool: tavilySearch });
  }
  if (process.env.LANGSEARCH_API_KEY) {
    providers.push({ id: 'langsearch', name: 'LangSearch', tool: langSearch });
  }
  const preferred = getSetting<SearchProviderId | undefined>('webSearchPreferredProvider', undefined);
  if (preferred === 'parallel') {
    providers.unshift({ id: 'parallel', name: 'Parallel', tool: parallelSearch });
  }
  return preferred
    ? [...providers.filter((p) => p.id === preferred), ...providers.filter((p) => p.id !== preferred)]
    : providers;
}

async function invokeProvider(provider: WebSearchProvider, query: string, signal?: AbortSignal): Promise<string> {
  const result = await provider.tool.invoke({ query }, { signal });
  return typeof result === 'string' ? result : JSON.stringify(result);
}

export async function searchWithProviders(
  query: string,
  providers: WebSearchProvider[],
  signal?: AbortSignal,
): Promise<string> {
  if (providers.length === 0) {
    throw new Error('[Web Search] No providers configured.');
  }

  const errors: string[] = [];
  for (const provider of providers) {
    signal?.throwIfAborted();
    try {
      return await invokeProvider(provider, query, signal);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider.name}: ${message}`);
    }
  }

  throw new Error(`[Web Search] All providers failed: ${errors.join(' | ')}`);
}

export function createWebSearchTool(providers: WebSearchProvider[]): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'web_search',
    description: WEB_SEARCH_DESCRIPTION,
    schema: z.object({
      query: z.string().describe('The search query to look up on the web'),
    }),
    func: async (input, _runManager, config) => searchWithProviders(input.query, providers, config?.signal),
  });
}
