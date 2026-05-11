import { DynamicStructuredTool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { WEB_SEARCH_DESCRIPTION } from './index.js';
import type { SearchProviderId } from '../../utils/env.js';

export interface WebSearchProvider {
  id: SearchProviderId;
  name: string;
  tool: StructuredToolInterface;
}

async function invokeProvider(provider: WebSearchProvider, query: string): Promise<string> {
  const result = await provider.tool.invoke({ query });
  return typeof result === 'string' ? result : JSON.stringify(result);
}

export async function searchWithProviders(
  query: string,
  providers: WebSearchProvider[],
): Promise<string> {
  if (providers.length === 0) {
    throw new Error('[Web Search] No providers configured.');
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      return await invokeProvider(provider, query);
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
    func: async (input) => searchWithProviders(input.query, providers),
  });
}
