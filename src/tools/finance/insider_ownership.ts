import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api, stripFieldsDeep } from './api.js';
import { formatToolResult } from '../types.js';
import { TTL_1H } from './utils.js';

const REDUNDANT_OWNERSHIP_FIELDS = ['issuer'] as const;

const InsiderOwnershipInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch insider ownership statements for. For example, 'AAPL' for Apple."),
  limit: z
    .number()
    .default(10)
    .describe('Maximum number of ownership rows to return (default: 10, max: 1000). Increase this for longer historical windows when needed.'),
  name: z
    .string()
    .optional()
    .describe("Filter by insider name (case-insensitive contains, e.g. 'cook'). Names can be discovered via the /insider-ownership/names/?ticker={ticker} endpoint."),
  form_type: z
    .enum(['3', '3/A', '5', '5/A'])
    .optional()
    .describe('Filter by SEC form type: 3 for initial ownership statements (what a new insider owned on day one), 5 for annual statements, or their amendments.'),
  filing_date: z
    .string()
    .optional()
    .describe('Exact filing date to filter by (YYYY-MM-DD).'),
  filing_date_gte: z
    .string()
    .optional()
    .describe('Filter for statements with filing date greater than or equal to this date (YYYY-MM-DD).'),
  filing_date_lte: z
    .string()
    .optional()
    .describe('Filter for statements with filing date less than or equal to this date (YYYY-MM-DD).'),
  filing_date_gt: z
    .string()
    .optional()
    .describe('Filter for statements with filing date greater than this date (YYYY-MM-DD).'),
  filing_date_lt: z
    .string()
    .optional()
    .describe('Filter for statements with filing date less than this date (YYYY-MM-DD).'),
});

export const getInsiderOwnership = new DynamicStructuredTool({
  name: 'get_insider_ownership',
  description: `Retrieves insider ownership statements for a given company ticker: what executives, directors, and 10% owners actually HOLD (common shares, options, RSUs), not what they traded. Sourced from SEC Form 3 (an insider's initial statement of ownership) and Form 5 (the annual statement). Complements get_insider_trades, which covers the buys and sells in between: trades are the events, ownership statements are the state. Positions are returned as reported per filing, newest filings first. Use form_type=3 for "what did a new insider own on day one" questions.`,
  schema: InsiderOwnershipInputSchema,
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker.toUpperCase(),
      limit: input.limit,
      name: input.name,
      form_type: input.form_type,
      filing_date: input.filing_date,
      filing_date_gte: input.filing_date_gte,
      filing_date_lte: input.filing_date_lte,
      filing_date_gt: input.filing_date_gt,
      filing_date_lt: input.filing_date_lt,
    };
    const { data, url } = await api.get('/insider-ownership/', params, { cacheable: true, ttlMs: TTL_1H });
    return formatToolResult(
      stripFieldsDeep(data.insider_ownership || [], REDUNDANT_OWNERSHIP_FIELDS),
      [url]
    );
  },
});
