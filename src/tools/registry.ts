import { StructuredToolInterface } from '@langchain/core/tools';
import {
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  getFilings,
  get10KFilingItems,
  get10QFilingItems,
  get8KFilingItems,
  getPriceSnapshot,
  getPrices,
  getCryptoPriceSnapshot,
  getCryptoPrices,
  getCryptoTickers,
  getFinancialMetricsSnapshot,
  getFinancialMetrics,
  getNews,
  getAnalystEstimates,
  getSegmentedRevenues,
  getInsiderTrades,
} from './finance/index.js';

/**
 * Registry of finance tools used internally by financial_search.
 * Maps tool names to their implementations for dynamic execution.
 */
export const TOOL_REGISTRY: Record<string, StructuredToolInterface> = {
  get_income_statements: getIncomeStatements,
  get_balance_sheets: getBalanceSheets,
  get_cash_flow_statements: getCashFlowStatements,
  get_all_financial_statements: getAllFinancialStatements,
  get_filings: getFilings,
  get_10K_filing_items: get10KFilingItems,
  get_10Q_filing_items: get10QFilingItems,
  get_8K_filing_items: get8KFilingItems,
  get_price_snapshot: getPriceSnapshot,
  get_prices: getPrices,
  get_crypto_price_snapshot: getCryptoPriceSnapshot,
  get_crypto_prices: getCryptoPrices,
  get_available_crypto_tickers: getCryptoTickers,
  get_financial_metrics_snapshot: getFinancialMetricsSnapshot,
  get_financial_metrics: getFinancialMetrics,
  get_news: getNews,
  get_analyst_estimates: getAnalystEstimates,
  get_segmented_revenues: getSegmentedRevenues,
  get_insider_trades: getInsiderTrades,
};

/**
 * Execute a tool by name with given arguments.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<string> {
  const tool = TOOL_REGISTRY[toolName];

  if (!tool) {
    return `Error: Tool '${toolName}' not found`;
  }

  try {
    const result = await tool.invoke(args, signal ? { signal } : undefined);
    return typeof result === 'string' ? result : JSON.stringify(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error executing ${toolName}: ${message}`;
  }
}
