import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

/**
 * Transform Alpha Vantage TOP_GAINERS_LOSERS response
 */
function transformTopGainersLosers(data: Record<string, unknown>): Record<string, unknown> {
  const transformRanking = (items: Array<Record<string, string>> | undefined) => {
    if (!items) return [];
    return items.map((item) => ({
      ticker: item['ticker'],
      price: parseFloat(item['price']),
      changeAmount: parseFloat(item['change_amount']),
      changePercentage: item['change_percentage'],
      volume: parseInt(item['volume'], 10),
    }));
  };

  return {
    metadata: data['metadata'],
    lastUpdated: data['last_updated'],
    topGainers: transformRanking(data['top_gainers'] as Array<Record<string, string>>),
    topLosers: transformRanking(data['top_losers'] as Array<Record<string, string>>),
    mostActivelyTraded: transformRanking(data['most_actively_traded'] as Array<Record<string, string>>),
  };
}

/**
 * Transform Alpha Vantage INSIDER_TRANSACTIONS response
 */
function transformInsiderTransactions(data: Record<string, unknown>): Record<string, unknown>[] {
  const transactions = data['data'] as Array<Record<string, unknown>> | undefined;
  if (!transactions) return [];

  return transactions.map((tx) => ({
    ticker: tx['ticker'],
    company: tx['company'],
    transactionType: tx['transaction_type'],
    executionDate: tx['execution_date'],
    sharesTraded: tx['shares'],
    sharePrice: tx['share_price'],
    totalValue: tx['total_value'],
    insiderName: tx['name'],
    insiderTitle: tx['title'],
    acquisitionOrDisposal: tx['acquisition_or_disposal'],
    securityType: tx['security_type'],
  }));
}

export const getTopGainersLosers = new DynamicStructuredTool({
  name: 'get_top_gainers_losers',
  description: `Retrieves the top 20 gainers, top 20 losers, and most actively traded tickers in the US market for the current trading day. Useful for identifying market momentum and trading opportunities. Data is updated throughout the trading day.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await callApi('TOP_GAINERS_LOSERS', {});
    return formatToolResult(transformTopGainersLosers(data), [url]);
  },
});

const InsiderTransactionsInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch insider transactions for. For example, 'AAPL' for Apple."
    ),
});

export const getInsiderTransactions = new DynamicStructuredTool({
  name: 'get_insider_transactions',
  description: `Retrieves the latest insider transactions (Form 4 filings) for a specific company. Shows buying and selling activity by company executives, directors, and significant shareholders. Useful for tracking insider sentiment and potential catalysts.`,
  schema: InsiderTransactionsInputSchema,
  func: async (input) => {
    const params = { symbol: input.ticker };
    const { data, url } = await callApi('INSIDER_TRANSACTIONS', params);
    return formatToolResult(transformInsiderTransactions(data), [url]);
  },
});
