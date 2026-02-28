/**
 * SEC Filings Tool - Provider-agnostic implementation
 *
 * Uses provider abstraction layer for SEC filings data.
 * Currently supports Financial Datasets API as the only provider with this capability.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { providerRegistry } from './providers/index.js';
import { formatToolResult } from '../types.js';
import { logger } from '@/utils';

// Types for filing item metadata
export interface FilingItemType {
  name: string;        // e.g., "Item-1", "Part-1,Item-2"
  title: string;       // e.g., "Business", "MD&A"
  description: string; // e.g., "Detailed overview of the company's operations..."
}

export interface FilingItemTypes {
  '10-K': FilingItemType[];
  '10-Q': FilingItemType[];
}

let cachedItemTypes: FilingItemTypes | null = null;

/**
 * Fetches canonical item type names from the API.
 * Used to provide the inner LLM with exact item names for selective retrieval.
 */
export async function getFilingItemTypes(): Promise<FilingItemTypes> {
  if (cachedItemTypes) {
    return cachedItemTypes;
  }

  const response = await fetch('https://api.financialdatasets.ai/filings/items/types/');
  if (!response.ok) {
    throw new Error(`[Financial Datasets API] Failed to fetch filing item types: ${response.status}`);
  }
  const itemTypes = (await response.json()) as FilingItemTypes;
  cachedItemTypes = itemTypes;
  return itemTypes;
}

export const FILINGS_DESCRIPTION = `
Retrieves SEC filings metadata and content using provider abstraction:
- 10-K annual reports, 10-Q quarterly reports, 8-K current reports
- Currently uses Financial Datasets API (only provider with filings)
`.trim();

const FilingsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch filings for. For example, 'AAPL' for Apple."),
  filing_type: z
    .array(z.enum(['10-K', '10-Q', '8-K']))
    .optional()
    .describe(
      "Optional list of filing types to filter by. Use one or more of '10-K', '10-Q', or '8-K'. If omitted, returns most recent filings of ANY type."
    ),
  limit: z
    .number()
    .default(10)
    .describe(
      'Maximum number of filings to return (default: 10). Returns the most recent N filings matching the criteria.'
    ),
  provider: z
    .enum(['financial-datasets', 'auto'])
    .optional()
    .describe("Data provider (default: auto)"),
});

export const getFilings = new DynamicStructuredTool({
  name: 'get_filings',
  description: `${FILINGS_DESCRIPTION} This tool ONLY returns metadata - it does NOT return the actual text content from filings. To retrieve text content, use the specific filing items tools: get_10K_filing_items, get_10Q_filing_items, or get_8K_filing_items.`,
  schema: FilingsInputSchema,
  func: async (input: any) => {
    const ticker = input.ticker.trim().toUpperCase();

    // Get provider for filings capability
    const provider = providerRegistry.getProviderForCapability(
      'filings',
      input.provider === 'auto' ? undefined : input.provider
    );

    if (!provider) {
      return formatToolResult(
        {
          error: 'No provider available for filings',
          ticker,
          message: 'Configure FINANCIAL_DATASETS_API_KEY for filings',
        },
        []
      );
    }

    // Check if provider supports getFilings method
    // TODO: Backend needs to implement getFilings() in FinancialDatasetsProvider
    // For now, we'll use the direct API approach if the method is not available
    if (!('getFilings' in provider)) {
      logger.warn(`[Filings] Provider ${provider.config.id} does not implement getFilings method`);

      // Fallback to direct API call using existing implementation
      // This maintains backward compatibility while we wait for the backend implementation
      return getFilingsDirect(input);
    }

    try {
      const filings = await (provider as any).getFilings({
        ticker,
        filing_type: input.filing_type,
        limit: input.limit,
      });

      return formatToolResult(
        {
          ticker: filings.ticker,
          provider: filings.provider,
          filings: filings.filings,
        },
        [filings.sourceUrl]
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[Filings] Failed for ${ticker}: ${errorMessage}`);

      // Try fallback
      try {
        const result = await providerRegistry.executeWithFallback(
          'filings',
          async (p) => {
            if (!('getFilings' in p)) {
              throw new Error('Provider does not support filings');
            }
            return (p as any).getFilings({ ticker, filing_type: input.filing_type, limit: input.limit });
          }
        );

        return formatToolResult(
          {
            ticker: result.ticker,
            provider: result.provider,
            filings: result.filings,
          },
          [result.sourceUrl]
        );
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        return formatToolResult(
          {
            error: `Failed to fetch filings for ${ticker}`,
            details: errorMessage,
            fallback_error: fallbackMessage,
          },
          []
        );
      }
    }
  },
});

const Filing10KItemsInputSchema = z.object({
  ticker: z.string().describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  accession_number: z
    .string()
    .describe(
      "The SEC accession number for the 10-K filing. For example, '0000320193-24-000123'. Can be retrieved from the get_filings tool."
    ),
  items: z
    .array(z.string())
    .optional()
    .describe(
      "Optional list of specific item names to retrieve. If omitted, returns all items. Use exact item names from the provided list (e.g., 'Item-1', 'Item-1A', 'Item-7')."
    ),
});

export const get10KFilingItems = new DynamicStructuredTool({
  name: 'get_10K_filing_items',
  description: `Retrieves sections (items) from a company's 10-K annual report. Specify items to retrieve only specific sections, or omit to get all. Common items: Item-1 (Business), Item-1A (Risk Factors), Item-7 (MD&A), Item-8 (Financial Statements). The accession_number can be retrieved using the get_filings tool.`,
  schema: Filing10KItemsInputSchema,
  func: async (input: any) => {
    const ticker = input.ticker.trim().toUpperCase();

    // Get provider for filings capability
    const provider = providerRegistry.getProviderForCapability('filings');

    if (!provider) {
      return formatToolResult(
        {
          error: 'No provider available for filings',
          ticker,
          message: 'Configure FINANCIAL_DATASETS_API_KEY for filings',
        },
        []
      );
    }

    // Check if provider supports getFilingItems method
    if (!('getFilingItems' in provider)) {
      // Fallback to direct API call
      return get10KFilingItemsDirect(input);
    }

    try {
      const items = await (provider as any).getFilingItems({
        ticker,
        filing_type: '10-K',
        accession_number: input.accession_number,
        items: input.items,
      });

      return formatToolResult(items, [items.sourceUrl]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[Filings] Failed to fetch 10-K items for ${ticker}: ${errorMessage}`);

      return formatToolResult(
        {
          error: `Failed to fetch 10-K filing items for ${ticker}`,
          details: errorMessage,
        },
        []
      );
    }
  },
});

const Filing10QItemsInputSchema = z.object({
  ticker: z.string().describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  accession_number: z
    .string()
    .describe(
      "The SEC accession number for the 10-Q filing. For example, '0000320193-24-000123'. Can be retrieved from the get_filings tool."
    ),
  items: z
    .array(z.string())
    .optional()
    .describe(
      "Optional list of specific item names to retrieve. If omitted, returns all items. Use exact item names from the provided list (e.g., 'Part-1,Item-1', 'Part-1,Item-2')."
    ),
});

export const get10QFilingItems = new DynamicStructuredTool({
  name: 'get_10Q_filing_items',
  description: `Retrieves sections (items) from a company's 10-Q quarterly report. Specify items to retrieve only specific sections, or omit to get all. Common items: Part-1,Item-1 (Financial Statements), Part-1,Item-2 (MD&A), Part-1,Item-3 (Market Risk), Part-2,Item-1A (Risk Factors). The accession_number can be retrieved using the get_filings tool.`,
  schema: Filing10QItemsInputSchema,
  func: async (input: any) => {
    const ticker = input.ticker.trim().toUpperCase();

    // Get provider for filings capability
    const provider = providerRegistry.getProviderForCapability('filings');

    if (!provider) {
      return formatToolResult(
        {
          error: 'No provider available for filings',
          ticker,
          message: 'Configure FINANCIAL_DATASETS_API_KEY for filings',
        },
        []
      );
    }

    // Check if provider supports getFilingItems method
    if (!('getFilingItems' in provider)) {
      // Fallback to direct API call
      return get10QFilingItemsDirect(input);
    }

    try {
      const items = await (provider as any).getFilingItems({
        ticker,
        filing_type: '10-Q',
        accession_number: input.accession_number,
        items: input.items,
      });

      return formatToolResult(items, [items.sourceUrl]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[Filings] Failed to fetch 10-Q items for ${ticker}: ${errorMessage}`);

      return formatToolResult(
        {
          error: `Failed to fetch 10-Q filing items for ${ticker}`,
          details: errorMessage,
        },
        []
      );
    }
  },
});

const Filing8KItemsInputSchema = z.object({
  ticker: z.string().describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  accession_number: z
    .string()
    .describe(
      "The SEC accession number for the 8-K filing. For example, '0000320193-24-000123'. This can be retrieved from the get_filings tool by filtering for 8-K filings."
    ),
});

export const get8KFilingItems = new DynamicStructuredTool({
  name: 'get_8K_filing_items',
  description: `Retrieves specific sections (items) from a company's 8-K current report. 8-K filings report material events such as acquisitions, financial results, management changes, and other significant corporate events. The accession_number parameter can be retrieved from the get_filings tool by filtering for 8-K filings.`,
  schema: Filing8KItemsInputSchema,
  func: async (input: any) => {
    const ticker = input.ticker.trim().toUpperCase();

    // Get provider for filings capability
    const provider = providerRegistry.getProviderForCapability('filings');

    if (!provider) {
      return formatToolResult(
        {
          error: 'No provider available for filings',
          ticker,
          message: 'Configure FINANCIAL_DATASETS_API_KEY for filings',
        },
        []
      );
    }

    // Check if provider supports getFilingItems method
    if (!('getFilingItems' in provider)) {
      // Fallback to direct API call
      return get8KFilingItemsDirect(input);
    }

    try {
      const items = await (provider as any).getFilingItems({
        ticker,
        filing_type: '8-K',
        accession_number: input.accession_number,
      });

      return formatToolResult(items, [items.sourceUrl]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[Filings] Failed to fetch 8-K items for ${ticker}: ${errorMessage}`);

      return formatToolResult(
        {
          error: `Failed to fetch 8-K filing items for ${ticker}`,
          details: errorMessage,
        },
        []
      );
    }
  },
});

/**
 * Direct API fallback for filings
 * Used when provider method is not yet implemented
 * TODO: Remove this once backend implements getFilings() and getFilingItems() in FinancialDatasetsProvider
 */
async function getFilingsDirect(input: any) {
  const { callApi } = await import('./api.js');

  const params: Record<string, string | number | string[] | undefined> = {
    ticker: input.ticker,
    limit: input.limit,
    filing_type: input.filing_type,
  };

  const { data, url } = await callApi('/filings/', params);
  return formatToolResult(data.filings || [], [url]);
}

async function get10KFilingItemsDirect(input: any) {
  const { callApi } = await import('./api.js');

  const params: Record<string, string | string[] | undefined> = {
    ticker: input.ticker.toUpperCase(),
    filing_type: '10-K',
    accession_number: input.accession_number,
    item: input.items, // API expects 'item' not 'items'
  };

  // SEC filings are legally immutable once filed
  const { data, url } = await callApi('/filings/items/', params, { cacheable: true });
  return formatToolResult(data, [url]);
}

async function get10QFilingItemsDirect(input: any) {
  const { callApi } = await import('./api.js');

  const params: Record<string, string | string[] | undefined> = {
    ticker: input.ticker.toUpperCase(),
    filing_type: '10-Q',
    accession_number: input.accession_number,
    item: input.items, // API expects 'item' not 'items'
  };

  // SEC filings are legally immutable from once filed
  const { data, url } = await callApi('/filings/items/', params, { cacheable: true });
  return formatToolResult(data, [url]);
}

async function get8KFilingItemsDirect(input: any) {
  const { callApi } = await import('./api.js');

  const params: Record<string, string | undefined> = {
    ticker: input.ticker.toUpperCase(),
    filing_type: '8-K',
    accession_number: input.accession_number,
  };

  // SEC filings are legally immutable once filed
  const { data, url } = await callApi('/filings/items/', params, { cacheable: true });
  return formatToolResult(data, [url]);
}
