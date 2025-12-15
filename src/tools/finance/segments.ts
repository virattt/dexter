import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

const SegmentedRevenuesInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch segmented revenues for. For example, 'AAPL' for Apple."
    ),
  period: z
    .enum(['annual', 'quarterly'])
    .describe(
      "The reporting period for the segmented revenues. 'annual' for yearly, 'quarterly' for quarterly."
    ),
  limit: z.number().default(10).describe('The number of past periods to retrieve.'),
});

export const getSegmentedRevenues = new DynamicStructuredTool({
  name: 'get_segmented_revenues',
  description: `Provides a detailed breakdown of a company's revenue by operating segments, such as products, services, or geographic regions. Useful for analyzing the composition of a company's revenue.`,
  schema: SegmentedRevenuesInputSchema,
  func: async (input) => {
    const params = {
      ticker: input.ticker,
      period: input.period,
      limit: input.limit,
    };
    const { data, url } = await callApi('/financials/segmented-revenues/', params);
    return formatToolResult(data.segmented_revenues || {}, [url]);
  },
});

