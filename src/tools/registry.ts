import { StructuredToolInterface } from '@langchain/core/tools';
import { createGetMarketData, GET_MARKET_DATA_META_DESCRIPTION } from './forex/get-market-data.js';
import { getEconomicCalendar, ECONOMIC_CALENDAR_DESCRIPTION } from './forex/economic-calendar.js';
import { getFintokeiRules, calculatePositionSize, checkAccountHealth, FINTOKEI_RULES_DESCRIPTION } from './forex/fintokei-rules.js';
import { recordTrade, closeTrade, getTradeStats, getTradeHistory, TRADE_JOURNAL_DESCRIPTION } from './forex/trade-journal.js';
import { getZScore, getCorrelationMatrix, getReturnDistribution, getVolatilityRegime, STATISTICAL_ANALYSIS_DESCRIPTION } from './forex/statistical-analysis.js';
import { getRateDifferential, getMacroRegime, getCrossAssetRegime, MACRO_ANALYSIS_DESCRIPTION } from './forex/macro-analysis.js';
import { backtestStrategy, monteCarloSimulation, calculateExpectedValue, QUANT_STRATEGY_DESCRIPTION } from './forex/quant-strategy.js';
import { exaSearch, perplexitySearch, tavilySearch, WEB_SEARCH_DESCRIPTION, xSearchTool, X_SEARCH_DESCRIPTION } from './search/index.js';
import { skillTool, SKILL_TOOL_DESCRIPTION } from './skill.js';
import { webFetchTool, WEB_FETCH_DESCRIPTION } from './fetch/web-fetch.js';
import { browserTool, BROWSER_DESCRIPTION } from './browser/browser.js';
import { readFileTool, READ_FILE_DESCRIPTION } from './filesystem/read-file.js';
import { writeFileTool, WRITE_FILE_DESCRIPTION } from './filesystem/write-file.js';
import { editFileTool, EDIT_FILE_DESCRIPTION } from './filesystem/edit-file.js';
import { heartbeatTool, HEARTBEAT_TOOL_DESCRIPTION } from './heartbeat/heartbeat-tool.js';
import { cronTool, CRON_TOOL_DESCRIPTION } from './cron/cron-tool.js';
import { memoryGetTool, MEMORY_GET_DESCRIPTION, memorySearchTool, MEMORY_SEARCH_DESCRIPTION, memoryUpdateTool, MEMORY_UPDATE_DESCRIPTION } from './memory/index.js';
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
 */
export function getToolRegistry(model: string): RegisteredTool[] {
  const tools: RegisteredTool[] = [
    // ── Market Data (meta-tool routes to price, history, technical indicators) ──
    {
      name: 'get_market_data',
      tool: createGetMarketData(model),
      description: GET_MARKET_DATA_META_DESCRIPTION,
    },

    // ── Statistical Analysis (Quantitative) ──
    {
      name: 'get_zscore',
      tool: getZScore,
      description: 'Compute z-score of price/returns relative to historical distribution. Includes percentile rank and mean-reversion probability.',
    },
    {
      name: 'get_correlation_matrix',
      tool: getCorrelationMatrix,
      description: 'Compute pairwise return correlation matrix for 2-8 instruments. Essential for portfolio risk decomposition and exposure analysis.',
    },
    {
      name: 'get_return_distribution',
      tool: getReturnDistribution,
      description: STATISTICAL_ANALYSIS_DESCRIPTION,
    },
    {
      name: 'get_volatility_regime',
      tool: getVolatilityRegime,
      description: 'Detect volatility regime (LOW/NORMAL/HIGH/CRISIS) with percentile rank, vol term structure, and position sizing implications.',
    },

    // ── Macro / Econometric Analysis ──
    {
      name: 'get_rate_differential',
      tool: getRateDifferential,
      description: 'Analyze interest rate differential and policy divergence between currencies. The strongest medium-term FX driver.',
    },
    {
      name: 'get_macro_regime',
      tool: getMacroRegime,
      description: MACRO_ANALYSIS_DESCRIPTION,
    },
    {
      name: 'get_cross_asset_regime',
      tool: getCrossAssetRegime,
      description: 'Detect risk-on/risk-off regime via cross-asset analysis (equities, gold, JPY). Returns positioning implications.',
    },

    // ── Quant Strategy Engine ──
    {
      name: 'backtest_strategy',
      tool: backtestStrategy,
      description: QUANT_STRATEGY_DESCRIPTION,
    },
    {
      name: 'monte_carlo_simulation',
      tool: monteCarloSimulation,
      description: 'Run Monte Carlo simulation of Fintokei challenge outcomes. Calculates P(pass), P(fail), drawdown distribution, and optimal risk parameters.',
    },
    {
      name: 'calculate_expected_value',
      tool: calculateExpectedValue,
      description: 'Calculate expected value of a trade setup given probability-weighted scenarios. Determines if mathematical edge exists.',
    },

    // ── Economic Calendar ──
    {
      name: 'economic_calendar',
      tool: getEconomicCalendar,
      description: ECONOMIC_CALENDAR_DESCRIPTION,
    },

    // ── Fintokei Rules & Risk Management ──
    {
      name: 'get_fintokei_rules',
      tool: getFintokeiRules,
      description: FINTOKEI_RULES_DESCRIPTION,
    },
    {
      name: 'calculate_position_size',
      tool: calculatePositionSize,
      description: 'Calculate position size respecting per-trade risk and Fintokei daily loss limits.',
    },
    {
      name: 'check_account_health',
      tool: checkAccountHealth,
      description: 'Evaluate Fintokei account health: drawdown status, daily loss proximity, profit target progress.',
    },

    // ── Trade Journal ──
    {
      name: 'record_trade',
      tool: recordTrade,
      description: TRADE_JOURNAL_DESCRIPTION,
    },
    {
      name: 'close_trade',
      tool: closeTrade,
      description: 'Close trade with exit price. Calculates P&L, actual R:R.',
    },
    {
      name: 'get_trade_stats',
      tool: getTradeStats,
      description: 'Advanced performance analytics: Sharpe, Sortino, Kelly Criterion, risk of ruin, profit factor, equity curve stats.',
    },
    {
      name: 'get_trade_history',
      tool: getTradeHistory,
      description: 'Retrieve recent trades. Filter by status (open/closed) and instrument.',
    },

    // ── Web & Browser ──
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

    // ── Filesystem ──
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

    // ── Scheduling ──
    {
      name: 'heartbeat',
      tool: heartbeatTool,
      description: HEARTBEAT_TOOL_DESCRIPTION,
    },
    {
      name: 'cron',
      tool: cronTool,
      description: CRON_TOOL_DESCRIPTION,
    },

    // ── Memory ──
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
  ];

  // Include web_search if search API key is configured
  if (process.env.EXASEARCH_API_KEY) {
    tools.push({ name: 'web_search', tool: exaSearch, description: WEB_SEARCH_DESCRIPTION });
  } else if (process.env.PERPLEXITY_API_KEY) {
    tools.push({ name: 'web_search', tool: perplexitySearch, description: WEB_SEARCH_DESCRIPTION });
  } else if (process.env.TAVILY_API_KEY) {
    tools.push({ name: 'web_search', tool: tavilySearch, description: WEB_SEARCH_DESCRIPTION });
  }

  if (process.env.X_BEARER_TOKEN) {
    tools.push({ name: 'x_search', tool: xSearchTool, description: X_SEARCH_DESCRIPTION });
  }

  const availableSkills = discoverSkills();
  if (availableSkills.length > 0) {
    tools.push({ name: 'skill', tool: skillTool, description: SKILL_TOOL_DESCRIPTION });
  }

  return tools;
}

export function getTools(model: string): StructuredToolInterface[] {
  return getToolRegistry(model).map((t) => t.tool);
}

export function buildToolDescriptions(model: string): string {
  return getToolRegistry(model)
    .map((t) => `### ${t.name}\n\n${t.description}`)
    .join('\n\n');
}
