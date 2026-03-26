import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { fmp } from './api.js';
import { formatToolResult } from '../types.js';

export const getSegmentedRevenues = new DynamicStructuredTool({
  name: 'get_segmented_revenues',
  description: `Provides a breakdown of a company's revenue by product segments and geographic regions via FMP. Useful for analyzing revenue composition and geographic diversification.`,
  schema: z.object({
    ticker: z
      .string()
      .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
    segment_type: z
      .enum(['product', 'geographic'])
      .default('product')
      .describe("Type of segmentation: 'product' for business lines, 'geographic' for regions."),
  }),
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const endpoint =
      input.segment_type === 'geographic'
        ? `/revenue-geographic-segmentation/${ticker}`
        : `/revenue-product-segmentation/${ticker}`;
    const { data, url } = await fmp.get(endpoint, { structure: 'flat' });
    return formatToolResult(Array.isArray(data) ? data : [], [url]);
  },
});
