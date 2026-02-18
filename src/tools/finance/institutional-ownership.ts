import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi, getInvestorList } from './api.js';
import { formatToolResult } from '../types.js';

// ---------------------------------------------------------------------------
// By Ticker — "Who are Apple's top institutional holders?"
// ---------------------------------------------------------------------------

const ByTickerInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
  limit: z
    .number()
    .default(10)
    .describe('Maximum number of holdings to return (default: 10).'),
  report_period: z
    .string()
    .optional()
    .describe('Exact report period date to filter by (YYYY-MM-DD).'),
  report_period_gte: z
    .string()
    .optional()
    .describe('Filter for report period greater than or equal to this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe('Filter for report period less than or equal to this date (YYYY-MM-DD).'),
  report_period_gt: z
    .string()
    .optional()
    .describe('Filter for report period greater than this date (YYYY-MM-DD).'),
  report_period_lt: z
    .string()
    .optional()
    .describe('Filter for report period less than this date (YYYY-MM-DD).'),
});

export const getInstitutionalOwnershipByTicker = new DynamicStructuredTool({
  name: 'get_institutional_ownership_by_ticker',
  description:
    `Retrieves institutional ownership data for a given stock ticker from SEC 13-F filings. ` +
    `Shows which institutional investors (hedge funds, mutual funds, pension funds) hold shares ` +
    `of a company, including share quantities, estimated holding prices, and market values. ` +
    `Use report_period filters to narrow results to a specific quarter.`,
  schema: ByTickerInputSchema,
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker.toUpperCase(),
      limit: input.limit,
      report_period: input.report_period,
      report_period_gte: input.report_period_gte,
      report_period_lte: input.report_period_lte,
      report_period_gt: input.report_period_gt,
      report_period_lt: input.report_period_lt,
    };
    const { data, url } = await callApi('/institutional-ownership/', params, { cacheable: true });
    return formatToolResult(data['institutional-ownership'] || data.institutional_ownership || [], [url]);
  },
});

// ---------------------------------------------------------------------------
// Investor name resolution — normalize user input to API format
// ---------------------------------------------------------------------------

async function resolveInvestorName(name: string): Promise<string> {
  const investors = await getInvestorList();
  if (investors.length === 0) return name; // API unavailable, pass through

  // Normalize: uppercase, replace punctuation/spaces with underscores, collapse/trim
  const normalized = name
    .toUpperCase()
    .replace(/[.\-,&'/()]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // Exact match
  if (investors.includes(normalized)) return normalized;

  // Try common suffixes
  for (const suffix of ['_LLC', '_INC', '_LP', '_LTD', '_CO', '_CORP']) {
    const withSuffix = normalized + suffix;
    if (investors.includes(withSuffix)) return withSuffix;
  }

  // Substring match: find investors that contain the normalized name
  const matches = investors.filter(inv => inv.includes(normalized));
  if (matches.length === 1) return matches[0]; // unambiguous match
  if (matches.length > 1) {
    // Prefer shortest match (most specific)
    return matches.sort((a, b) => a.length - b.length)[0];
  }

  // No match found — pass through and let API return the error
  return name;
}

// ---------------------------------------------------------------------------
// By Investor — "What does Berkshire Hathaway own?"
// ---------------------------------------------------------------------------

const ByInvestorInputSchema = z.object({
  investor: z
    .string()
    .describe("The name of the institutional investor. For example, 'Berkshire Hathaway' or 'Bridgewater Associates'."),
  limit: z
    .number()
    .default(10)
    .describe('Maximum number of holdings to return (default: 10).'),
  report_period: z
    .string()
    .optional()
    .describe('Exact report period date to filter by (YYYY-MM-DD).'),
  report_period_gte: z
    .string()
    .optional()
    .describe('Filter for report period greater than or equal to this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe('Filter for report period less than or equal to this date (YYYY-MM-DD).'),
  report_period_gt: z
    .string()
    .optional()
    .describe('Filter for report period greater than this date (YYYY-MM-DD).'),
  report_period_lt: z
    .string()
    .optional()
    .describe('Filter for report period less than this date (YYYY-MM-DD).'),
});

export const getInstitutionalOwnershipByInvestor = new DynamicStructuredTool({
  name: 'get_institutional_ownership_by_investor',
  description:
    `Retrieves the portfolio holdings of a specific institutional investor from SEC 13-F filings. ` +
    `Shows which stocks an investment manager holds, including tickers, share quantities, ` +
    `estimated holding prices, and market values. Covers investment managers with $100M+ in assets. ` +
    `Use report_period filters to narrow results to a specific quarter.`,
  schema: ByInvestorInputSchema,
  func: async (input) => {
    const resolvedInvestor = await resolveInvestorName(input.investor);
    const params: Record<string, string | number | undefined> = {
      investor: resolvedInvestor,
      limit: input.limit,
      report_period: input.report_period,
      report_period_gte: input.report_period_gte,
      report_period_lte: input.report_period_lte,
      report_period_gt: input.report_period_gt,
      report_period_lt: input.report_period_lt,
    };
    const { data, url } = await callApi('/institutional-ownership/', params, { cacheable: true });
    return formatToolResult(data['institutional-ownership'] || data.institutional_ownership || [], [url]);
  },
});
