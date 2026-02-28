/**
 * Fundamentals Tool - Provider-agnostic implementation
 *
 * Uses provider abstraction layer for financial data.
 * Supports income statements, balance sheets, cash flow statements, and key ratios.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { providerRegistry } from './providers/index.js';
import { formatToolResult } from '../types.js';
import { logger } from '@/utils';

export const FUNDAMENTALS_DESCRIPTION = `
Fetches fundamental financial data using provider abstraction:
- Income statements, balance sheets, cash flow statements
- Key financial ratios (P/E, P/B, etc.)
- Currently uses Financial Datasets API as primary source
`.trim();

const FundamentalsInputSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(20)
    .describe("Stock ticker symbol (e.g., 'AAPL', 'MSFT')"),
  provider: z
    .enum(['financial-datasets', 'auto'])
    .optional()
    .describe("Data provider (default: auto)"),
});

export const getFundamentals = new DynamicStructuredTool({
  name: 'get_fundamentals',
  description: FUNDAMENTALS_DESCRIPTION,
  schema: FundamentalsInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();

    // Get provider for income statements capability
    const provider = providerRegistry.getProviderForCapability(
      'incomeStatements',
      input.provider === 'auto' ? undefined : input.provider
    );

    if (!provider) {
      return formatToolResult(
        {
          error: 'No provider available for fundamentals',
          ticker,
          message: 'Configure FINANCIAL_DATASETS_API_KEY for fundamentals data',
        },
        []
      );
    }

    // Check if provider supports getFundamentals
    if (!provider.getFundamentals) {
      return formatToolResult(
        {
          error: 'Provider does not support fundamentals',
          provider: provider.config.id,
        },
        []
      );
    }

    try {
      const fundamentals = await provider.getFundamentals({ ticker });

      return formatToolResult(
        {
          ticker: fundamentals.ticker,
          provider: fundamentals.provider,
          income_statements: fundamentals.incomeStatements,
          balance_sheets: fundamentals.balanceSheets,
          cash_flow_statements: fundamentals.cashFlowStatements,
          key_ratios: fundamentals.keyRatios,
        },
        [fundamentals.sourceUrl]
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`[Fundamentals] Failed for ${ticker}: ${errorMessage}`);

      // Try fallback
      try {
        const result = await providerRegistry.executeWithFallback(
          'incomeStatements',
          async (p) => {
            if (!p.getFundamentals) {
              throw new Error('Provider does not support fundamentals');
            }
            return p.getFundamentals({ ticker });
          }
        );

        return formatToolResult(
          {
            ticker: result.ticker,
            provider: result.provider,
            income_statements: result.incomeStatements,
            balance_sheets: result.balanceSheets,
            cash_flow_statements: result.cashFlowStatements,
            key_ratios: result.keyRatios,
          },
          [result.sourceUrl]
        );
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        return formatToolResult(
          {
            error: `Failed to fetch fundamentals for ${ticker}`,
            details: errorMessage,
            fallback_error: fallbackMessage,
          },
          []
        );
      }
    }
  },
});

// Export legacy tools with new names for direct access
export { getIncomeStatements, getBalanceSheets, getCashFlowStatements, getAllFinancialStatements } from './fundamentals-direct.js';
