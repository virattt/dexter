import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { edgarFetch, resolveCik, submissionsUrl } from './edgar/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilingItemType {
  name: string;
  title: string;
}

export interface FilingItemTypes {
  '10-K': FilingItemType[];
  '10-Q': FilingItemType[];
}

// ---------------------------------------------------------------------------
// Hardcoded filing item types (no API call needed)
// ---------------------------------------------------------------------------

const FILING_ITEM_TYPES: FilingItemTypes = {
  '10-K': [
    { name: 'Item-1', title: 'Business' },
    { name: 'Item-1A', title: 'Risk Factors' },
    { name: 'Item-1B', title: 'Unresolved Staff Comments' },
    { name: 'Item-1C', title: 'Cybersecurity' },
    { name: 'Item-2', title: 'Properties' },
    { name: 'Item-3', title: 'Legal Proceedings' },
    { name: 'Item-4', title: 'Mine Safety Disclosures' },
    { name: 'Item-5', title: 'Market for Common Equity' },
    { name: 'Item-6', title: 'Reserved' },
    { name: 'Item-7', title: "Management's Discussion and Analysis (MD&A)" },
    { name: 'Item-7A', title: 'Quantitative and Qualitative Disclosures About Market Risk' },
    { name: 'Item-8', title: 'Financial Statements and Supplementary Data' },
    { name: 'Item-9', title: 'Changes in and Disagreements with Accountants' },
    { name: 'Item-9A', title: 'Controls and Procedures' },
    { name: 'Item-10', title: 'Directors, Executive Officers and Corporate Governance' },
    { name: 'Item-11', title: 'Executive Compensation' },
    { name: 'Item-12', title: 'Security Ownership' },
    { name: 'Item-13', title: 'Certain Relationships and Related Transactions' },
    { name: 'Item-14', title: 'Principal Accountant Fees and Services' },
    { name: 'Item-15', title: 'Exhibits and Financial Statement Schedules' },
  ],
  '10-Q': [
    { name: 'Part-1,Item-1', title: 'Financial Statements' },
    { name: 'Part-1,Item-2', title: "Management's Discussion and Analysis (MD&A)" },
    { name: 'Part-1,Item-3', title: 'Quantitative and Qualitative Disclosures About Market Risk' },
    { name: 'Part-1,Item-4', title: 'Controls and Procedures' },
    { name: 'Part-2,Item-1', title: 'Legal Proceedings' },
    { name: 'Part-2,Item-1A', title: 'Risk Factors' },
    { name: 'Part-2,Item-2', title: 'Unregistered Sales of Equity Securities' },
    { name: 'Part-2,Item-5', title: 'Other Information' },
    { name: 'Part-2,Item-6', title: 'Exhibits' },
  ],
};

/** Returns hardcoded filing item types (synchronous — no API call). */
export function getFilingItemTypes(): FilingItemTypes {
  return FILING_ITEM_TYPES;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SubmissionsFilingArrays {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: string[];
  form: string[];
  primaryDocument: string[];
  primaryDocDescription: string[];
  [key: string]: string[];
}

function buildEdgarFilingUrl(accessionNumber: string, primaryDocument: string): string {
  const cleanAccession = accessionNumber.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${cleanAccession.slice(0, 10)}/${cleanAccession}/${primaryDocument}`;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

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
  description: `Retrieves SEC filing metadata for a company from EDGAR. Returns filing dates, accession numbers, form types, and links to filing documents. This tool returns metadata and document URLs — to read actual filing text, visit the returned URLs.`,
  schema: FilingsInputSchema,
  func: async (input) => {
    const resolved = await resolveCik(input.ticker);
    const subUrl = submissionsUrl(resolved.cik);
    const { data, url } = await edgarFetch(subUrl, {
      cacheable: true,
      cacheKey: `edgar/submissions/${input.ticker.toUpperCase()}`,
      cacheParams: { ticker: input.ticker.toUpperCase() },
    });

    const sub = data as Record<string, unknown>;
    const recent = (sub.filings as Record<string, unknown>)?.recent as SubmissionsFilingArrays | undefined;

    if (!recent || !recent.accessionNumber) {
      return formatToolResult([], [url]);
    }

    // Build array of filing objects
    let filings = recent.accessionNumber.map((accession, index) => ({
      accessionNumber: accession,
      filingDate: recent.filingDate[index],
      reportDate: recent.reportDate[index],
      form: recent.form[index],
      primaryDocument: recent.primaryDocument[index],
      description: recent.primaryDocDescription[index],
      documentUrl: buildEdgarFilingUrl(accession, recent.primaryDocument[index]),
    }));

    // Filter by filing type if specified
    if (input.filing_type) {
      filings = filings.filter((f) => f.form === input.filing_type);
    }

    // Apply limit
    filings = filings.slice(0, input.limit);

    return formatToolResult(filings, [url]);
  },
});

const Filing10KItemsInputSchema = z.object({
  ticker: z.string().describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  accession_number: z
    .string()
    .describe(
      "The SEC accession number for the 10-K filing. Can be retrieved from the get_filings tool."
    ),
  items: z
    .array(z.string())
    .optional()
    .describe(
      "Optional list of specific item names to retrieve. Use exact names like 'Item-1', 'Item-1A', 'Item-7'."
    ),
});

export const get10KFilingItems = new DynamicStructuredTool({
  name: 'get_10K_filing_items',
  description: `Returns the EDGAR document URL and metadata for a 10-K annual report. Note: EDGAR does not serve parsed sections — use the returned URL to access the full filing document. Common items: Item-1 (Business), Item-1A (Risk Factors), Item-7 (MD&A), Item-8 (Financial Statements).`,
  schema: Filing10KItemsInputSchema,
  func: async (input) => {
    const resolved = await resolveCik(input.ticker);
    const cleanAccession = input.accession_number.replace(/-/g, '');
    const baseArchiveUrl = `https://www.sec.gov/Archives/edgar/data/${resolved.cikRaw}/${cleanAccession}/`;

    const result = {
      ticker: input.ticker.toUpperCase(),
      accessionNumber: input.accession_number,
      filingType: '10-K',
      archiveUrl: baseArchiveUrl,
      requestedItems: input.items ?? 'all',
      itemTypes: FILING_ITEM_TYPES['10-K'],
      note: 'Visit the archiveUrl to access the filing document. EDGAR provides the full filing — individual section parsing is not available via this API.',
    };

    return formatToolResult(result, [baseArchiveUrl]);
  },
});

const Filing10QItemsInputSchema = z.object({
  ticker: z.string().describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  accession_number: z
    .string()
    .describe(
      "The SEC accession number for the 10-Q filing. Can be retrieved from the get_filings tool."
    ),
  items: z
    .array(z.string())
    .optional()
    .describe(
      "Optional list of specific item names. Use exact names like 'Part-1,Item-1', 'Part-1,Item-2'."
    ),
});

export const get10QFilingItems = new DynamicStructuredTool({
  name: 'get_10Q_filing_items',
  description: `Returns the EDGAR document URL and metadata for a 10-Q quarterly report. Note: EDGAR does not serve parsed sections — use the returned URL to access the full filing document.`,
  schema: Filing10QItemsInputSchema,
  func: async (input) => {
    const resolved = await resolveCik(input.ticker);
    const cleanAccession = input.accession_number.replace(/-/g, '');
    const baseArchiveUrl = `https://www.sec.gov/Archives/edgar/data/${resolved.cikRaw}/${cleanAccession}/`;

    const result = {
      ticker: input.ticker.toUpperCase(),
      accessionNumber: input.accession_number,
      filingType: '10-Q',
      archiveUrl: baseArchiveUrl,
      requestedItems: input.items ?? 'all',
      itemTypes: FILING_ITEM_TYPES['10-Q'],
      note: 'Visit the archiveUrl to access the filing document. EDGAR provides the full filing — individual section parsing is not available via this API.',
    };

    return formatToolResult(result, [baseArchiveUrl]);
  },
});

const Filing8KItemsInputSchema = z.object({
  ticker: z.string().describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  accession_number: z
    .string()
    .describe(
      "The SEC accession number for the 8-K filing. Can be retrieved from the get_filings tool."
    ),
});

export const get8KFilingItems = new DynamicStructuredTool({
  name: 'get_8K_filing_items',
  description: `Returns the EDGAR document URL and metadata for an 8-K current report (material events, acquisitions, earnings).`,
  schema: Filing8KItemsInputSchema,
  func: async (input) => {
    const resolved = await resolveCik(input.ticker);
    const cleanAccession = input.accession_number.replace(/-/g, '');
    const baseArchiveUrl = `https://www.sec.gov/Archives/edgar/data/${resolved.cikRaw}/${cleanAccession}/`;

    const result = {
      ticker: input.ticker.toUpperCase(),
      accessionNumber: input.accession_number,
      filingType: '8-K',
      archiveUrl: baseArchiveUrl,
      note: 'Visit the archiveUrl to access the filing document.',
    };

    return formatToolResult(result, [baseArchiveUrl]);
  },
});
