import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api, stripFieldsDeep } from './api.js';
import { formatToolResult } from '../types.js';
import { validateLimit, validateReportPeriodFilters, validateTicker } from './validation.js';
import { TTL_1H } from './utils.js';

const REDUNDANT_INSIDER_FIELDS = ['issuer'] as const;

const InsiderTradesInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch insider trades for. For example, 'AAPL' for Apple."),
  limit: z
    .number()
    .default(10)
    .describe('Maximum number of insider trades to return (default: 10, max: 1000). Increase this for longer historical windows when needed.'),
  filing_date: z
    .string()
    .optional()
    .describe('Exact filing date to filter by (YYYY-MM-DD).'),
  filing_date_gte: z
    .string()
    .optional()
    .describe('Filter for trades with filing date greater than or equal to this date (YYYY-MM-DD).'),
  filing_date_lte: z
    .string()
    .optional()
    .describe('Filter for trades with filing date less than or equal to this date (YYYY-MM-DD).'),
  filing_date_gt: z
    .string()
    .optional()
    .describe('Filter for trades with filing date greater than this date (YYYY-MM-DD).'),
  filing_date_lt: z
    .string()
    .optional()
    .describe('Filter for trades with filing date less than this date (YYYY-MM-DD).'),
  name: z
    .string()
    .optional()
    .describe("Filter by insider name (e.g., 'HUANG JEN HSUN'). Names can be discovered via the /insider-trades/names/?ticker={ticker} endpoint."),
});

export const getInsiderTrades = new DynamicStructuredTool({
  name: 'get_insider_trades',
  description: `Retrieves insider trading transactions for a given company ticker. Insider trades include purchases and sales of company stock by executives, directors, and other insiders. This data is sourced from SEC Form 4 filings. Use filing_date filters to narrow down results by date range. Use the name parameter to filter by a specific insider.`,
  schema: InsiderTradesInputSchema,
  func: async (input) => {
    const ticker = validateTicker(input.ticker);
    const limit = validateLimit(input.limit, { fieldName: 'limit', min: 1, max: 1000 });
    const filters = validateReportPeriodFilters({
      report_period: input.filing_date,
      report_period_gt: input.filing_date_gt,
      report_period_gte: input.filing_date_gte,
      report_period_lt: input.filing_date_lt,
      report_period_lte: input.filing_date_lte,
    });

    const params: Record<string, string | number | undefined> = {
      ticker,
      limit,
      filing_date: filters.report_period,
      filing_date_gte: filters.report_period_gte,
      filing_date_lte: filters.report_period_lte,
      filing_date_gt: filters.report_period_gt,
      filing_date_lt: filters.report_period_lt,
      name: input.name,
    };
    const { data, url } = await api.get('/insider-trades/', params, { cacheable: true, ttlMs: TTL_1H });
    return formatToolResult(
      stripFieldsDeep(data.insider_trades || [], REDUNDANT_INSIDER_FIELDS),
      [url]
    );
  },
});
