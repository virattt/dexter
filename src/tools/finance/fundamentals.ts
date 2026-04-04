/**
 * J-Quants 財務諸表ツール (v2)
 * /fins/summary エンドポイントで損益計算書・貸借対照表・CF計算書を取得。
 * 日本の会計基準（J-GAAP / IFRS）に対応。
 *
 * v2 フィールド対応表:
 *   Sales=売上高, OP=営業利益, OdP=経常利益, NP=当期純利益
 *   EPS=一株益, BPS=一株純資産, TA=総資産, Eq=自己資本
 *   EqAR=自己資本比率(0〜1), CFO/CFI/CFF=CF計算書
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { fetchFinancialSummary } from './providers/fundamentals.js';
import type { FinancialSummaryRecord } from './providers/types.js';
import { formatToolResult } from '../types.js';

const FinancialStatementsInputSchema = z.object({
  code: z
    .string()
    .describe("銘柄の証券コード（4桁）。例: '7203' はトヨタ自動車。"),
  period: z
    .enum(['annual', 'quarterly'])
    .default('annual')
    .describe("取得期間。'annual' は通期、'quarterly' は四半期。"),
  limit: z
    .number()
    .default(4)
    .describe('取得する期数の上限（デフォルト4）。最新のN期分を返します。'),
});

type FinStatementsInput = z.infer<typeof FinancialStatementsInputSchema>;

/** プロバイダー経由で財務サマリーを取得 */
async function fetchSummary(input: FinStatementsInput) {
  const code = input.code.trim().padStart(4, '0');
  const { records, url } = await fetchFinancialSummary(code, input.period, input.limit);
  return { records, url };
}

/** 損益計算書フィールドを抽出 */
function mapIncomeStatement(s: FinancialSummaryRecord): Record<string, unknown> {
  return {
    fiscalYearEnd: s.fiscalYearEnd,
    period: s.period,
    disclosureDate: s.disclosureDate,
    netSales: s.netSales,
    operatingProfit: s.operatingProfit,
    ordinaryProfit: s.ordinaryProfit,
    netIncome: s.netIncome,
    eps: s.eps,
    dilutedEps: null,
    dividendPerShare: s.dividendPerShare,
    forecastSales: s.forecastSales,
    forecastOperatingProfit: s.forecastOperatingProfit,
    forecastOrdinaryProfit: null,
    forecastNetIncome: s.forecastNetIncome,
    forecastEps: null,
    forecastDividend: null,
  };
}

/** 貸借対照表フィールドを抽出 */
function mapBalanceSheet(s: FinancialSummaryRecord): Record<string, unknown> {
  return {
    fiscalYearEnd: s.fiscalYearEnd,
    period: s.period,
    totalAssets: s.totalAssets,
    equity: s.equity,
    bps: s.bps,
    equityToAssetRatio: s.equityToAssetRatio,
  };
}

/** CF計算書フィールドを抽出 */
function mapCashFlow(s: FinancialSummaryRecord): Record<string, unknown> {
  return {
    fiscalYearEnd: s.fiscalYearEnd,
    period: s.period,
    cashFlowsFromOperating: s.cashFlowsFromOperating,
    cashFlowsFromInvesting: s.cashFlowsFromInvesting,
    cashFlowsFromFinancing: s.cashFlowsFromFinancing,
    cashAndEquivalents: null,
  };
}

// ============================================================================
// ツール定義
// ============================================================================

export const getIncomeStatements = new DynamicStructuredTool({
  name: 'get_income_statements',
  description: '日本企業の損益計算書を取得します。売上高・営業利益・経常利益・当期純利益・EPS・配当などを含みます。業績予想も含まれます。',
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { records, url } = await fetchSummary(input);
    return formatToolResult(records.map(mapIncomeStatement), [url]);
  },
});

export const getBalanceSheets = new DynamicStructuredTool({
  name: 'get_balance_sheets',
  description: '日本企業の貸借対照表を取得します。総資産・純資産・BPS・自己資本比率などを含みます。',
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { records, url } = await fetchSummary(input);
    return formatToolResult(records.map(mapBalanceSheet), [url]);
  },
});

export const getCashFlowStatements = new DynamicStructuredTool({
  name: 'get_cash_flow_statements',
  description: '日本企業のキャッシュフロー計算書を取得します。営業CF・投資CF・財務CF・現金残高を含みます。',
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { records, url } = await fetchSummary(input);
    return formatToolResult(records.map(mapCashFlow), [url]);
  },
});

export const getAllFinancialStatements = new DynamicStructuredTool({
  name: 'get_all_financial_statements',
  description: '日本企業の財務三表（損益計算書・貸借対照表・CF計算書）を一括取得します。包括的な財務分析に使用します。',
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { records, url } = await fetchSummary(input);
    const result = records.map((s) => ({
      ...mapIncomeStatement(s),
      ...mapBalanceSheet(s),
      ...mapCashFlow(s),
    }));
    return formatToolResult(result, [url]);
  },
});
