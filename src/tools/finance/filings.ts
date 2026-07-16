import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';
import { TTL_24H } from './utils.js';

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
 * Canonical SEC item types, used when filings are served from SEC EDGAR
 * (USE_SEC_EDGAR=true) so we don't depend on the Financial Datasets API.
 */
const SEC_ITEM_TYPES: FilingItemTypes = {
  '10-K': [
    { name: 'Item-1', title: 'Business', description: 'Overview of the company’s operations, products, and markets.' },
    { name: 'Item-1A', title: 'Risk Factors', description: 'Principal risks affecting the business.' },
    { name: 'Item-1B', title: 'Unresolved Staff Comments', description: 'Comments from SEC staff not yet resolved.' },
    { name: 'Item-2', title: 'Properties', description: 'Material physical properties owned or leased.' },
    { name: 'Item-3', title: 'Legal Proceedings', description: 'Significant pending legal proceedings.' },
    { name: 'Item-4', title: 'Mine Safety Disclosures', description: 'Mine safety disclosures if applicable.' },
    { name: 'Item-5', title: 'Market for Common Equity', description: 'Market info, dividends, and equity compensation.' },
    { name: 'Item-7', title: "Management’s Discussion and Analysis", description: 'MD&A of financial condition and results of operations.' },
    { name: 'Item-7A', title: 'Market Risk Disclosures', description: 'Quantitative/qualitative disclosures about market risk.' },
    { name: 'Item-8', title: 'Financial Statements', description: 'Consolidated financial statements and supplementary data.' },
    { name: 'Item-9', title: 'Changes in Accountants', description: 'Changes and disagreements with accountants.' },
    { name: 'Item-9A', title: 'Controls and Procedures', description: 'Disclosure controls and internal control over financial reporting.' },
    { name: 'Item-11', title: 'Executive Compensation', description: 'Executive compensation disclosure.' },
    { name: 'Item-12', title: 'Security Ownership', description: 'Beneficial ownership of securities.' },
    { name: 'Item-13', title: 'Certain Relationships', description: 'Related-party transactions.' },
    { name: 'Item-15', title: 'Exhibits', description: 'List of exhibits filed with the report.' },
  ],
  '10-Q': [
    { name: 'Part-1,Item-1', title: 'Financial Statements', description: 'Condensed consolidated financial statements.' },
    { name: 'Part-1,Item-2', title: "Management’s Discussion and Analysis", description: 'MD&A of financial condition and results of operations.' },
    { name: 'Part-1,Item-3', title: 'Market Risk Disclosures', description: 'Quantitative/qualitative disclosures about market risk.' },
    { name: 'Part-2,Item-1', title: 'Legal Proceedings', description: 'Updates to significant legal proceedings.' },
    { name: 'Part-2,Item-1A', title: 'Risk Factors', description: 'Risk factors (updates to 10-K).' },
    { name: 'Part-2,Item-3', title: 'Defaults', description: 'Defaults upon senior securities.' },
    { name: 'Part-2,Item-5', title: 'Other Information', description: 'Other information.' },
    { name: 'Part-2,Item-6', title: 'Exhibits', description: 'List of exhibits filed with the report.' },
  ],
};

/**
 * Fetches canonical item type names from the API.
 * Used to provide the inner LLM with exact item names for selective retrieval.
 */
export async function getFilingItemTypes(): Promise<FilingItemTypes> {
  if (cachedItemTypes) {
    return cachedItemTypes;
  }

  // When serving filings from SEC EDGAR, use the canonical SEC item taxonomy
  // instead of calling the (keyed) Financial Datasets endpoint.
  if ((process.env.USE_SEC_EDGAR || '').toLowerCase() === 'true') {
    cachedItemTypes = SEC_ITEM_TYPES;
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
});

export const getFilings = new DynamicStructuredTool({
  name: 'get_filings',
  description: `Retrieves metadata for SEC filings for a company. Returns accession numbers, filing types, and document URLs. This tool ONLY returns metadata - it does NOT return the actual text content from filings. To retrieve text content, use the specific filing items tools: get_10K_filing_items, get_10Q_filing_items, or get_8K_filing_items.`,
  schema: FilingsInputSchema,
  func: async (input) => {
    const params: Record<string, string | number | string[] | undefined> = {
      ticker: input.ticker,
      limit: input.limit,
      filing_type: input.filing_type,
    };
    const { data, url } = await api.get('/filings/', params);
    return formatToolResult(data.filings || [], [url]);
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
  func: async (input) => {
    const params: Record<string, string | string[] | undefined> = {
      ticker: input.ticker.toUpperCase(),
      filing_type: '10-K',
      accession_number: input.accession_number,
      item: input.items, // API expects 'item' not 'items'
    };
    // SEC filings are legally immutable once filed
    const { data, url } = await api.get('/filings/items/', params, { cacheable: true, ttlMs: TTL_24H });
    return formatToolResult(data, [url]);
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
  func: async (input) => {
    const params: Record<string, string | string[] | undefined> = {
      ticker: input.ticker.toUpperCase(),
      filing_type: '10-Q',
      accession_number: input.accession_number,
      item: input.items, // API expects 'item' not 'items'
    };
    // SEC filings are legally immutable once filed
    const { data, url } = await api.get('/filings/items/', params, { cacheable: true, ttlMs: TTL_24H });
    return formatToolResult(data, [url]);
  },
});

const Filing8KItemsInputSchema = z.object({
  ticker: z.string().describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  accession_number: z
    .string()
    .describe(
      "The SEC accession number for the 8-K filing. For example, '0000320193-24-000123'. This can be retrieved from the get_filings tool."
    ),
});

export const get8KFilingItems = new DynamicStructuredTool({
  name: 'get_8K_filing_items',
  description: `Retrieves specific sections (items) from a company's 8-K current report. 8-K filings report material events such as acquisitions, financial results, management changes, and other significant corporate events. The accession_number parameter can be retrieved using the get_filings tool by filtering for 8-K filings.`,
  schema: Filing8KItemsInputSchema,
  func: async (input) => {
    const params: Record<string, string | undefined> = {
      ticker: input.ticker.toUpperCase(),
      filing_type: '8-K',
      accession_number: input.accession_number,
    };
    // SEC filings are legally immutable once filed
    const { data, url } = await api.get('/filings/items/', params, { cacheable: true, ttlMs: TTL_24H });
    return formatToolResult(data, [url]);
  },
});

