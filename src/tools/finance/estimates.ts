import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { formatToolResult } from '../types.js';
import { getYahooAnalystTargets } from './yahoo-finance.js';

const AnalystEstimatesInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch analyst estimates for. For example, 'AAPL' for Apple or 'VWS.CO' for Vestas Wind Systems."
    ),
  period: z
    .enum(['annual', 'quarterly'])
    .default('annual')
    .describe("The period for the estimates, either 'annual' or 'quarterly'."),
});

export const getAnalystEstimates = new DynamicStructuredTool({
  name: 'get_analyst_estimates',
  description: `Retrieves analyst estimates for a given company ticker, including metrics like estimated EPS and price targets. Covers US and international tickers. Falls back to Yahoo Finance for tickers not covered by the primary data source (e.g. European stocks like VWS.CO, AZN.L).`,
  schema: AnalystEstimatesInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim();
    const params = { ticker, period: input.period };

    // Primary: financialdatasets.ai (richer EPS estimates for US stocks)
    try {
      const { data, url } = await api.get('/analyst-estimates/', params);
      const estimates = data.analyst_estimates as unknown[];
      if (estimates && estimates.length > 0) {
        return formatToolResult(estimates, [url]);
      }
    } catch {
      // Fall through to Yahoo Finance fallback
    }

    // Fallback: Yahoo Finance (covers international tickers and price targets)
    try {
      return await getYahooAnalystTargets.invoke({ ticker });
    } catch (yahooErr) {
      return formatToolResult({ error: `All data sources failed: ${String(yahooErr)}` }, []);
    }
  },
});

