import { StructuredToolInterface } from '@langchain/core/tools';
import { createFinancialSearch, createFinancialMetrics, createReadFilings } from './finance/index.js';
import { exaSearch, perplexitySearch, tavilySearch, WEB_SEARCH_DESCRIPTION, xSearchTool, X_SEARCH_DESCRIPTION } from './search/index.js';
import { skillTool, SKILL_TOOL_DESCRIPTION } from './skill.js';
import { webFetchTool, WEB_FETCH_DESCRIPTION } from './fetch/web-fetch.js';
import { browserTool, BROWSER_DESCRIPTION } from './browser/browser.js';
import { readFileTool, READ_FILE_DESCRIPTION } from './filesystem/read-file.js';
import { writeFileTool, WRITE_FILE_DESCRIPTION } from './filesystem/write-file.js';
import { editFileTool, EDIT_FILE_DESCRIPTION } from './filesystem/edit-file.js';
import { FINANCIAL_SEARCH_DESCRIPTION } from './finance/financial-search.js';
import { FINANCIAL_METRICS_DESCRIPTION } from './finance/financial-metrics.js';
import { READ_FILINGS_DESCRIPTION } from './finance/read-filings.js';
import { heartbeatTool, HEARTBEAT_TOOL_DESCRIPTION } from './heartbeat/heartbeat-tool.js';
import { memoryGetTool, MEMORY_GET_DESCRIPTION, memorySearchTool, MEMORY_SEARCH_DESCRIPTION, memoryUpdateTool, MEMORY_UPDATE_DESCRIPTION } from './memory/index.js';
import { portfolioTool, PORTFOLIO_TOOL_DESCRIPTION } from './portfolio/portfolio-tool.js';
import { reportTool, REPORT_TOOL_DESCRIPTION } from './report/report-tool.js';
import { fundConfigTool, FUND_CONFIG_TOOL_DESCRIPTION } from './fund-config/fund-config-tool.js';
import { performanceHistoryTool, PERFORMANCE_HISTORY_TOOL_DESCRIPTION } from './performance-history/performance-history-tool.js';
import {
  hyperliquidPricesTool,
  hyperliquidLiquidityTool,
  hyperliquidPerformanceTool,
  hyperliquidPortfolioOpsTool,
  hyperliquidOrderPreviewTool,
  hyperliquidLiveOrdersTool,
  hyperliquidSubmitOrderTool,
  hyperliquidCancelOrderTool,
  hyperliquidPositionsTool,
  hyperliquidSyncPortfolioTool,
  HYPERLIQUID_PRICES_DESCRIPTION,
  HYPERLIQUID_LIQUIDITY_DESCRIPTION,
  HYPERLIQUID_PERFORMANCE_DESCRIPTION,
  HYPERLIQUID_PORTFOLIO_OPS_DESCRIPTION,
  HYPERLIQUID_ORDER_PREVIEW_DESCRIPTION,
  HYPERLIQUID_LIVE_ORDERS_DESCRIPTION,
  HYPERLIQUID_SUBMIT_ORDER_DESCRIPTION,
  HYPERLIQUID_CANCEL_ORDER_DESCRIPTION,
  HYPERLIQUID_POSITIONS_DESCRIPTION,
  HYPERLIQUID_SYNC_PORTFOLIO_DESCRIPTION,
  isHLAccountConfigured,
  isHLOrderExecutionConfigured,
} from './hyperliquid/index.js';
import {
  tastytradeAccountsTool,
  tastytradeBalancesTool,
  tastytradePositionsTool,
  tastytradeOptionChainTool,
  tastytradeQuoteTool,
  tastytradeSymbolSearchTool,
  tastytradeSyncPortfolioTool,
  tastytradePositionRiskTool,
  tastytradeThetaScanTool,
  tastytradeStrategyPreviewTool,
  tastytradeRollShortOptionTool,
  tastytradeRepairPositionTool,
  tastytradeTransactionsTool,
  tastytradeEarningsCalendarTool,
  tastytradeWatchlistTool,
  tastytradeRiskMetricsTool,
  tastytradeLiveOrdersTool,
  tastytradeOrderDryRunTool,
  tastytradeSubmitOrderTool,
  tastytradeCancelOrderTool,
  TASTYTRADE_ACCOUNTS_DESCRIPTION,
  TASTYTRADE_BALANCES_DESCRIPTION,
  TASTYTRADE_POSITIONS_DESCRIPTION,
  TASTYTRADE_OPTION_CHAIN_DESCRIPTION,
  TASTYTRADE_QUOTE_DESCRIPTION,
  TASTYTRADE_SYMBOL_SEARCH_DESCRIPTION,
  TASTYTRADE_SYNC_PORTFOLIO_DESCRIPTION,
  TASTYTRADE_POSITION_RISK_DESCRIPTION,
  TASTYTRADE_THETA_SCAN_DESCRIPTION,
  TASTYTRADE_STRATEGY_PREVIEW_DESCRIPTION,
  TASTYTRADE_ROLL_SHORT_OPTION_DESCRIPTION,
  TASTYTRADE_REPAIR_POSITION_DESCRIPTION,
  TASTYTRADE_TRANSACTIONS_DESCRIPTION,
  TASTYTRADE_EARNINGS_CALENDAR_DESCRIPTION,
  TASTYTRADE_WATCHLIST_DESCRIPTION,
  TASTYTRADE_RISK_METRICS_DESCRIPTION,
  TASTYTRADE_LIVE_ORDERS_DESCRIPTION,
  TASTYTRADE_ORDER_DRY_RUN_DESCRIPTION,
  TASTYTRADE_SUBMIT_ORDER_DESCRIPTION,
  TASTYTRADE_CANCEL_ORDER_DESCRIPTION,
  hasConfiguredClient,
  hasUsableCredentials,
} from './tastytrade/index.js';
import {
  aihfDoubleCheckTool,
  AIHF_DOUBLE_CHECK_DESCRIPTION,
  isAIHFConfigured,
} from './aihf/index.js';
import { discoverSkills } from '../skills/index.js';

/**
 * A registered tool with its rich description for system prompt injection.
 */
export interface RegisteredTool {
  /** Tool name (must match the tool's name property) */
  name: string;
  /** The actual tool instance */
  tool: StructuredToolInterface;
  /** Rich description for system prompt (includes when to use, when not to use, etc.) */
  description: string;
}

/**
 * Get all registered tools with their descriptions.
 * Conditionally includes tools based on environment configuration.
 *
 * @param model - The model name (needed for tools that require model-specific configuration)
 * @returns Array of registered tools
 */
export function getToolRegistry(model: string): RegisteredTool[] {
  const tools: RegisteredTool[] = [
    {
      name: 'financial_search',
      tool: createFinancialSearch(model),
      description: FINANCIAL_SEARCH_DESCRIPTION,
    },
    {
      name: 'financial_metrics',
      tool: createFinancialMetrics(model),
      description: FINANCIAL_METRICS_DESCRIPTION,
    },
    {
      name: 'read_filings',
      tool: createReadFilings(model),
      description: READ_FILINGS_DESCRIPTION,
    },
    {
      name: 'web_fetch',
      tool: webFetchTool,
      description: WEB_FETCH_DESCRIPTION,
    },
    {
      name: 'browser',
      tool: browserTool,
      description: BROWSER_DESCRIPTION,
    },
    {
      name: 'read_file',
      tool: readFileTool,
      description: READ_FILE_DESCRIPTION,
    },
    {
      name: 'write_file',
      tool: writeFileTool,
      description: WRITE_FILE_DESCRIPTION,
    },
    {
      name: 'edit_file',
      tool: editFileTool,
      description: EDIT_FILE_DESCRIPTION,
    },
    {
      name: 'heartbeat',
      tool: heartbeatTool,
      description: HEARTBEAT_TOOL_DESCRIPTION,
    },
    {
      name: 'memory_search',
      tool: memorySearchTool,
      description: MEMORY_SEARCH_DESCRIPTION,
    },
    {
      name: 'memory_get',
      tool: memoryGetTool,
      description: MEMORY_GET_DESCRIPTION,
    },
    {
      name: 'memory_update',
      tool: memoryUpdateTool,
      description: MEMORY_UPDATE_DESCRIPTION,
    },
    {
      name: 'portfolio',
      tool: portfolioTool,
      description: PORTFOLIO_TOOL_DESCRIPTION,
    },
    {
      name: 'save_report',
      tool: reportTool,
      description: REPORT_TOOL_DESCRIPTION,
    },
    {
      name: 'fund_config',
      tool: fundConfigTool,
      description: FUND_CONFIG_TOOL_DESCRIPTION,
    },
    {
      name: 'performance_history',
      tool: performanceHistoryTool,
      description: PERFORMANCE_HISTORY_TOOL_DESCRIPTION,
    },
    {
      name: 'hyperliquid_prices',
      tool: hyperliquidPricesTool,
      description: HYPERLIQUID_PRICES_DESCRIPTION,
    },
    {
      name: 'hyperliquid_liquidity',
      tool: hyperliquidLiquidityTool,
      description: HYPERLIQUID_LIQUIDITY_DESCRIPTION,
    },
    {
      name: 'hyperliquid_performance',
      tool: hyperliquidPerformanceTool,
      description: HYPERLIQUID_PERFORMANCE_DESCRIPTION,
    },
    {
      name: 'hyperliquid_portfolio_ops',
      tool: hyperliquidPortfolioOpsTool,
      description: HYPERLIQUID_PORTFOLIO_OPS_DESCRIPTION,
    },
    {
      name: 'hyperliquid_order_preview',
      tool: hyperliquidOrderPreviewTool,
      description: HYPERLIQUID_ORDER_PREVIEW_DESCRIPTION,
    },
  ];

  if (isHLAccountConfigured()) {
    tools.push(
      { name: 'hyperliquid_positions', tool: hyperliquidPositionsTool, description: HYPERLIQUID_POSITIONS_DESCRIPTION },
      { name: 'hyperliquid_sync_portfolio', tool: hyperliquidSyncPortfolioTool, description: HYPERLIQUID_SYNC_PORTFOLIO_DESCRIPTION }
    );
  }
  if (isHLOrderExecutionConfigured()) {
    tools.push(
      { name: 'hyperliquid_live_orders', tool: hyperliquidLiveOrdersTool, description: HYPERLIQUID_LIVE_ORDERS_DESCRIPTION },
      { name: 'hyperliquid_submit_order', tool: hyperliquidSubmitOrderTool, description: HYPERLIQUID_SUBMIT_ORDER_DESCRIPTION },
      { name: 'hyperliquid_cancel_order', tool: hyperliquidCancelOrderTool, description: HYPERLIQUID_CANCEL_ORDER_DESCRIPTION }
    );
  }

  // Include web_search if Exa, Perplexity, or Tavily API key is configured (Exa → Perplexity → Tavily)
  if (process.env.EXASEARCH_API_KEY) {
    tools.push({
      name: 'web_search',
      tool: exaSearch,
      description: WEB_SEARCH_DESCRIPTION,
    });
  } else if (process.env.PERPLEXITY_API_KEY) {
    tools.push({
      name: 'web_search',
      tool: perplexitySearch,
      description: WEB_SEARCH_DESCRIPTION,
    });
  } else if (process.env.TAVILY_API_KEY) {
    tools.push({
      name: 'web_search',
      tool: tavilySearch,
      description: WEB_SEARCH_DESCRIPTION,
    });
  }

  // Include x_search if X Bearer Token is configured
  if (process.env.X_BEARER_TOKEN) {
    tools.push({
      name: 'x_search',
      tool: xSearchTool,
      description: X_SEARCH_DESCRIPTION,
    });
  }

  // Include tastytrade tools when OAuth client is configured and credentials are usable
  if (hasConfiguredClient() && hasUsableCredentials()) {
    tools.push(
      { name: 'tastytrade_accounts', tool: tastytradeAccountsTool, description: TASTYTRADE_ACCOUNTS_DESCRIPTION },
      { name: 'tastytrade_balances', tool: tastytradeBalancesTool, description: TASTYTRADE_BALANCES_DESCRIPTION },
      { name: 'tastytrade_positions', tool: tastytradePositionsTool, description: TASTYTRADE_POSITIONS_DESCRIPTION },
      { name: 'tastytrade_option_chain', tool: tastytradeOptionChainTool, description: TASTYTRADE_OPTION_CHAIN_DESCRIPTION },
      { name: 'tastytrade_quote', tool: tastytradeQuoteTool, description: TASTYTRADE_QUOTE_DESCRIPTION },
      { name: 'tastytrade_symbol_search', tool: tastytradeSymbolSearchTool, description: TASTYTRADE_SYMBOL_SEARCH_DESCRIPTION },
      { name: 'tastytrade_sync_portfolio', tool: tastytradeSyncPortfolioTool, description: TASTYTRADE_SYNC_PORTFOLIO_DESCRIPTION },
      { name: 'tastytrade_position_risk', tool: tastytradePositionRiskTool, description: TASTYTRADE_POSITION_RISK_DESCRIPTION },
      { name: 'tastytrade_theta_scan', tool: tastytradeThetaScanTool, description: TASTYTRADE_THETA_SCAN_DESCRIPTION },
      { name: 'tastytrade_strategy_preview', tool: tastytradeStrategyPreviewTool, description: TASTYTRADE_STRATEGY_PREVIEW_DESCRIPTION },
      { name: 'tastytrade_roll_short_option', tool: tastytradeRollShortOptionTool, description: TASTYTRADE_ROLL_SHORT_OPTION_DESCRIPTION },
      { name: 'tastytrade_repair_position', tool: tastytradeRepairPositionTool, description: TASTYTRADE_REPAIR_POSITION_DESCRIPTION },
      { name: 'tastytrade_transactions', tool: tastytradeTransactionsTool, description: TASTYTRADE_TRANSACTIONS_DESCRIPTION },
      { name: 'tastytrade_earnings_calendar', tool: tastytradeEarningsCalendarTool, description: TASTYTRADE_EARNINGS_CALENDAR_DESCRIPTION },
      { name: 'tastytrade_watchlist', tool: tastytradeWatchlistTool, description: TASTYTRADE_WATCHLIST_DESCRIPTION },
      { name: 'tastytrade_risk_metrics', tool: tastytradeRiskMetricsTool, description: TASTYTRADE_RISK_METRICS_DESCRIPTION },
      { name: 'tastytrade_order_dry_run', tool: tastytradeOrderDryRunTool, description: TASTYTRADE_ORDER_DRY_RUN_DESCRIPTION }
    );
    if (process.env.TASTYTRADE_ORDER_ENABLED === 'true') {
      tools.push(
        { name: 'tastytrade_live_orders', tool: tastytradeLiveOrdersTool, description: TASTYTRADE_LIVE_ORDERS_DESCRIPTION },
        { name: 'tastytrade_submit_order', tool: tastytradeSubmitOrderTool, description: TASTYTRADE_SUBMIT_ORDER_DESCRIPTION },
        { name: 'tastytrade_cancel_order', tool: tastytradeCancelOrderTool, description: TASTYTRADE_CANCEL_ORDER_DESCRIPTION }
      );
    }
  }

  // Include AIHF double-check tool when configured
  if (isAIHFConfigured()) {
    tools.push({
      name: 'aihf_double_check',
      tool: aihfDoubleCheckTool,
      description: AIHF_DOUBLE_CHECK_DESCRIPTION,
    });
  }

  // Include skill tool if any skills are available
  const availableSkills = discoverSkills();
  if (availableSkills.length > 0) {
    tools.push({
      name: 'skill',
      tool: skillTool,
      description: SKILL_TOOL_DESCRIPTION,
    });
  }

  return tools;
}

/**
 * Get just the tool instances for binding to the LLM.
 *
 * @param model - The model name
 * @returns Array of tool instances
 */
export function getTools(model: string): StructuredToolInterface[] {
  return getToolRegistry(model).map((t) => t.tool);
}

/**
 * Build the tool descriptions section for the system prompt.
 * Formats each tool's rich description with a header.
 *
 * @param model - The model name
 * @returns Formatted string with all tool descriptions
 */
export function buildToolDescriptions(model: string): string {
  return getToolRegistry(model)
    .map((t) => `### ${t.name}\n\n${t.description}`)
    .join('\n\n');
}
