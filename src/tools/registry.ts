import { StructuredToolInterface } from '@langchain/core/tools';
import {
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  getKeyRatios,
  getHistoricalKeyRatios,
  getStockPrice,
  getStockPrices,
  getEarnings,
  createScreenStocks,
  SCREEN_STOCKS_DESCRIPTION,
} from './finance/index.js';
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
 * Finance tools are registered directly (no meta-tool wrapper) for single-LLM-call performance.
 */
export function getToolRegistry(model: string): RegisteredTool[] {
  const tools: RegisteredTool[] = [
    // ── 財務諸表 ──────────────────────────────────────────
    {
      name: 'get_income_statements',
      tool: getIncomeStatements,
      description: '日本企業の損益計算書（売上高・営業利益・経常利益・当期純利益・EPS・配当）。証券コード（4桁）と期間を指定。',
    },
    {
      name: 'get_balance_sheets',
      tool: getBalanceSheets,
      description: '日本企業の貸借対照表（総資産・純資産・BPS・自己資本比率）。証券コード（4桁）と期間を指定。',
    },
    {
      name: 'get_cash_flow_statements',
      tool: getCashFlowStatements,
      description: '日本企業のキャッシュフロー計算書（営業CF・投資CF・財務CF・現金残高）。証券コード（4桁）と期間を指定。',
    },
    {
      name: 'get_all_financial_statements',
      tool: getAllFinancialStatements,
      description: '日本企業の財務三表を一括取得（損益計算書・貸借対照表・CF計算書）。包括的な財務分析に使用。',
    },
    // ── 投資指標 ──────────────────────────────────────────
    {
      name: 'get_key_ratios',
      tool: getKeyRatios,
      description: '日本株の投資指標スナップショット（PER・PBR・ROE・ROA・配当利回り・自己資本比率）。東証PBR改革の観点からPBRに特に注目。',
    },
    {
      name: 'get_historical_key_ratios',
      tool: getHistoricalKeyRatios,
      description: '日本株の過去の投資指標推移（EPS・BPS・ROE・利益率の時系列）。証券コード（4桁）と期数を指定。',
    },
    // ── 株価データ ────────────────────────────────────────
    {
      name: 'get_stock_price',
      tool: getStockPrice,
      description: '日本株の最新株価スナップショット（始値・高値・安値・終値・出来高）。証券コード（4桁）で指定。',
    },
    {
      name: 'get_stock_prices',
      tool: getStockPrices,
      description: '日本株の期間指定の日次株価一覧（OHLCV・調整後終値）。from/toはYYYY-MM-DD形式。',
    },
    // ── 決算カレンダー ────────────────────────────────────
    {
      name: 'get_earnings',
      tool: getEarnings,
      description: '日本株の決算発表予定・スケジュールを取得。銘柄コード省略で近日中の全発表一覧。',
    },
    // ── スクリーニング ────────────────────────────────────
    {
      name: 'stock_screener',
      tool: createScreenStocks(model),
      description: SCREEN_STOCKS_DESCRIPTION,
    },
    // ── ウェブ・ファイル ──────────────────────────────────
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
    // ── システム ──────────────────────────────────────────
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

  // Include web_search if Exa, Perplexity, or Tavily API key is configured
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
