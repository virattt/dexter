import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { ITEMS_10K_MAP, ITEMS_10Q_MAP, formatItemsDescription } from './constants.js';
import { formatToolResult } from '../types.js';

const FilingsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch filings for. For example, 'AAPL' for Apple."),
  filing_type: z
    .enum(['10-K', '10-Q', '8-K'])
    .optional()
    .describe(
      "REQUIRED when searching for a specific filing type. Use '10-K' for annual reports, '10-Q' for quarterly reports, or '8-K' for current reports. If omitted, returns most recent filings of ANY type."
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
    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker,
      limit: input.limit,
      filing_type: input.filing_type,
    };
    const { data, url } = await callApi('/filings/', params);
    return formatToolResult(data.filings || [], [url]);
  },
});

const Filing10KItemsInputSchema = z.object({
  ticker: z.string().describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  year: z.number().describe('The year of the 10-K filing. For example, 2023.'),
  item: z
    .array(z.string())
    .optional()
    .describe(
      `Optional list of specific items to retrieve from the 10-K. Valid items are:\n${formatItemsDescription(ITEMS_10K_MAP)}\nIf not specified, all available items will be returned.`
    ),
});

export const get10KFilingItems = new DynamicStructuredTool({
  name: 'get_10K_filing_items',
  description: `Retrieves specific sections (items) from a company's 10-K annual report. Use this to extract detailed information from specific sections of a 10-K filing, such as: Item-1: Business, Item-1A: Risk Factors, Item-7: Management's Discussion and Analysis, Item-8: Financial Statements and Supplementary Data. The optional 'item' parameter allows you to filter for specific sections.`,
  schema: Filing10KItemsInputSchema,
  func: async (input) => {
    const params: Record<string, string | number | string[] | undefined> = {
      ticker: input.ticker.toUpperCase(),
      filing_type: '10-K',
      year: input.year,
      item: input.item,
    };
    const { data, url } = await callApi('/filings/items/', params);
    return formatToolResult(data, [url]);
  },
});

const Filing10QItemsInputSchema = z.object({
  ticker: z.string().describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  year: z.number().describe('The year of the 10-Q filing. For example, 2023.'),
  quarter: z.number().describe('The quarter of the 10-Q filing (1, 2, 3, or 4).'),
  item: z
    .array(z.string())
    .optional()
    .describe(
      `Optional list of specific items to retrieve from the 10-Q. Valid items are:\n${formatItemsDescription(ITEMS_10Q_MAP)}\nIf not specified, all available items will be returned.`
    ),
});

export const get10QFilingItems = new DynamicStructuredTool({
  name: 'get_10Q_filing_items',
  description: `Retrieves specific sections (items) from a company's 10-Q quarterly report. Use this to extract detailed information from specific sections of a 10-Q filing, such as: Item-1: Financial Statements, Item-2: Management's Discussion and Analysis, Item-3: Quantitative and Qualitative Disclosures About Market Risk, Item-4: Controls and Procedures.`,
  schema: Filing10QItemsInputSchema,
  func: async (input) => {
    const params: Record<string, string | number | string[] | undefined> = {
      ticker: input.ticker.toUpperCase(),
      filing_type: '10-Q',
      year: input.year,
      quarter: input.quarter,
      item: input.item,
    };
    const { data, url } = await callApi('/filings/items/', params);
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
    const { data, url } = await callApi('/filings/items/', params);
    return formatToolResult(data, [url]);
  },
});

