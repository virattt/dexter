/**
 * Analyst Estimates Tool - Provider-agnostic implementation
 *
 * Uses provider abstraction layer for analyst estimates data.
 * Currently supports Financial Datasets API as the only provider with this capability.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { providerRegistry } from './providers/index.js';
import { formatToolResult } from '../types.js';
import { logger } from '@/utils';

export const ANALYST_ESTIMATES_DESCRIPTION = `
Fetches analyst estimates using provider abstraction:
- Consensus EPS, revenue estimates, price targets
- Currently uses Financial Datasets API (only provider with analyst estimates)
`.trim();

const AnalystEstimatesInputSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(20)
    .describe("Stock ticker symbol (e.g., 'AAPL', 'MSFT')"),
  period: z
    .enum(['annual', 'quarterly'])
    .default('annual')
    .describe("The period for the estimates, either 'annual' or 'quarterly'"),
  provider: z
    .enum(['financial-datasets', 'auto'])
    .optional()
    .describe("Data provider (default: auto)"),
});

export const getAnalystEstimates = new DynamicStructuredTool({
  name: 'get_analyst_estimates',
  description: ANALYST_ESTIMATES_DESCRIPTION,
  schema: AnalystEstimatesInputSchema,
  func: async (input: any) => {
    const ticker = input.ticker.trim().toUpperCase();

    // Get provider for analyst estimates capability
    const provider = providerRegistry.getProviderForCapability(
      'analystEstimates',
      input.provider === 'auto' ? undefined : input.provider
    );

    if (!provider) {
      return formatToolResult(
        {
          error: 'No provider available for analyst estimates',
          ticker,
          message: 'Configure FINANCIAL_DATASETS_API_KEY for analyst estimates',
        },
        []
      );
    }

    // Check if provider supports getAnalystEstimates method
    // TODO: Backend needs to implement getAnalystEstimates() in FinancialDatasetsProvider
    // For now, we'll use the direct API approach if the method is not available
    if (!('getAnalystEstimates' in provider)) {
      logger.warn(`[Estimates] Provider ${provider.config.id} does not implement getAnalystEstimates method`);

      // Fallback to direct API call using existing implementation
      // This maintains backward compatibility while we wait for the backend implementation
      return getAnalystEstimatesDirect(input);
    }

    try {
      const estimates = await (provider as any).getAnalystEstimates({
        ticker,
        period: input.period,
      });

      return formatToolResult(
        {
          ticker: estimates.ticker,
          provider: estimates.provider,
          analyst_estimates: estimates.analystEstimates,
          period: estimates.period,
        },
        [estimates.sourceUrl]
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[Estimates] Failed for ${ticker}: ${errorMessage}`);

      // Try fallback
      try {
        const result = await providerRegistry.executeWithFallback(
          'analystEstimates',
          async (p) => {
            if (!('getAnalystEstimates' in p)) {
              throw new Error('Provider does not support analyst estimates');
            }
            return (p as any).getAnalystEstimates({ ticker, period: input.period });
          }
        );

        return formatToolResult(
          {
            ticker: result.ticker,
            provider: result.provider,
            analyst_estimates: result.analystEstimates,
            period: result.period,
          },
          [result.sourceUrl]
        );
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        return formatToolResult(
          {
            error: `Failed to fetch analyst estimates for ${ticker}`,
            details: errorMessage,
            fallback_error: fallbackMessage,
          },
          []
        );
      }
    }
  },
});

/**
 * Direct API fallback for analyst estimates
 * Used when provider method is not yet implemented
 * TODO: Remove this once backend implements getAnalystEstimates() in FinancialDatasetsProvider
 */
async function getAnalystEstimatesDirect(input: any) {
  const { callApi } = await import('./api.js');

  const params = {
    ticker: input.ticker,
    period: input.period,
  };

  const { data, url } = await callApi('/analyst-estimates/', params);
  return formatToolResult(data.analyst_estimates || [], [url]);
}
