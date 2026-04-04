import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';

/**
 * Rich description for the get_financials tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const GET_FINANCIALS_DESCRIPTION = `
日本株の財務データを取得するインテリジェントなメタツール。自然言語クエリを受け取り、適切な財務データソースに自動ルーティングします。

## 使用すべき場面

- 企業の財務諸表（損益計算書・貸借対照表・CF計算書）
- 投資指標・財務指標（PER・PBR・配当利回り・ROE・ROA・営業利益率）
- 過去の指標推移・トレンド分析
- 決算発表スケジュール・決算短信
- 複数銘柄比較（クエリをそのまま渡す、内部でルーティング）

## 使用しない場面

- 株価データ（get_market_data を使用）
- 一般的なウェブ検索（web_search を使用）
- 外部データ不要の質問（知識から直接回答）
- 財務条件でのスクリーニング（stock_screener を使用）

## 注意事項

- クエリ全体を1回渡す（内部で複雑さを処理）
- 「トヨタ vs ソニーの売上比較」のようなクエリもそのまま渡す
- 証券コードの解決を自動処理（トヨタ → 7203、ソフトバンク → 9984）
- 日付推論を処理（「前期」「直近5年」等）
- 構造化JSONデータとソースURLを返す
`.trim();

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Import all finance tools directly (avoid circular deps with index.ts)
import { getIncomeStatements, getBalanceSheets, getCashFlowStatements, getAllFinancialStatements } from './fundamentals.js';
import { getKeyRatios, getHistoricalKeyRatios } from './key-ratios.js';
import { getEarnings } from './earnings.js';

// All finance tools available for routing
const FINANCE_TOOLS: StructuredToolInterface[] = [
  // Fundamentals
  getIncomeStatements,
  getBalanceSheets,
  getCashFlowStatements,
  getAllFinancialStatements,
  // Earnings / 決算発表
  getEarnings,
  // Key Ratios & Snapshots
  getKeyRatios,
  getHistoricalKeyRatios,
];

// Create a map for quick tool lookup by name
const FINANCE_TOOL_MAP = new Map(FINANCE_TOOLS.map(t => [t.name, t]));

// Build the router system prompt
function buildRouterPrompt(): string {
  return `あなたは日本株の財務データルーティングアシスタントです。
現在日時: ${getCurrentDate()}

ユーザーの自然言語クエリを受け取り、適切な財務データツールを呼び出してください。

## ガイドライン

1. **証券コード解決**: 企業名を4桁証券コードに変換:
   - トヨタ/トヨタ自動車 → 7203
   - ソニー/ソニーグループ → 6758
   - ソフトバンク/ソフトバンクグループ → 9984
   - キーエンス → 6861
   - 任天堂 → 7974
   - リクルート → 6098
   - 三菱UFJ → 8306

2. **日付推論**: 日本の会計年度に対応:
   - 「前期」→ 直近の通期（FY）決算
   - 「直近5年」→ limit 5 (annual)
   - 「四半期」→ period "quarterly"
   - 多くの企業は3月決算（3月31日が期末）

3. **ツール選択**:
   - 最新の投資指標スナップショット（PER・PBR・ROE・配当利回り）→ get_key_ratios
   - 過去の指標推移 → get_historical_key_ratios
   - 売上・利益・EPS → get_income_statements
   - 決算発表予定・スケジュール → get_earnings
   - 資産・純資産・自己資本比率 → get_balance_sheets
   - キャッシュフロー → get_cash_flow_statements
   - 包括的な財務分析 → get_all_financial_statements

4. **効率性**:
   - 可能な限り具体的なツールを優先
   - 複数銘柄比較は同じツールを各コードに対して呼び出す
   - 最小のlimitで回答できる質問に最大のlimitを使わない:
     - 最新値のみ → limit 1
     - 短期トレンド → limit 3
     - 中期トレンド → limit 5

今すぐ適切なツールを呼び出してください。`;
}

// Input schema for the get_financials tool
const GetFinancialsInputSchema = z.object({
  query: z.string().describe('財務データに関する自然言語クエリ'),
});

/**
 * Create a get_financials tool configured with the specified model.
 * Uses native LLM tool calling for routing queries to finance tools.
 */
export function createGetFinancials(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_financials',
    description: `日本株の財務データ取得メタツール。自然言語クエリを受け取り、適切な財務データツールに自動ルーティングします。用途:
- 財務諸表（損益計算書・貸借対照表・CF計算書）
- 投資指標（PER・PBR・ROE・ROA・配当利回り）
- 過去の指標推移・トレンド分析
- 決算発表スケジュール`,
    schema: GetFinancialsInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. Call LLM with finance tools bound (native tool calling)
      onProgress?.('財務データを取得中...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: FINANCE_TOOLS,
      });
      const aiMessage = response as AIMessage;

      // 2. Check for tool calls
      const toolCalls = aiMessage.tool_calls as ToolCall[];
      if (!toolCalls || toolCalls.length === 0) {
        return formatToolResult({ error: 'クエリに対するツールが選択されませんでした' }, []);
      }

      // 3. Execute tool calls in parallel
      const toolNames = [...new Set(toolCalls.map(tc => formatSubToolName(tc.name)))];
      onProgress?.(`取得中: ${toolNames.join(', ')}...`);
      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          try {
            const tool = FINANCE_TOOL_MAP.get(tc.name);
            if (!tool) {
              throw new Error(`Tool '${tc.name}' not found`);
            }
            const rawResult = await tool.invoke(tc.args);
            const result = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
            const parsed = JSON.parse(result);
            return {
              tool: tc.name,
              args: tc.args,
              data: parsed.data,
              sourceUrls: parsed.sourceUrls || [],
              error: null,
            };
          } catch (error) {
            return {
              tool: tc.name,
              args: tc.args,
              data: null,
              sourceUrls: [],
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      // 4. Combine results
      const successfulResults = results.filter((r) => r.error === null);
      const failedResults = results.filter((r) => r.error !== null);

      // Collect all source URLs
      const allUrls = results.flatMap((r) => r.sourceUrls);

      // Build combined data structure
      const combinedData: Record<string, unknown> = {};

      for (const result of successfulResults) {
        // Use tool name as key, or tool_code for multiple calls to same tool
        const code = (result.args as Record<string, unknown>).code as string | undefined;
        const key = code ? `${result.tool}_${code}` : result.tool;
        combinedData[key] = result.data;
      }

      // Add errors if any
      if (failedResults.length > 0) {
        combinedData._errors = failedResults.map((r) => ({
          tool: r.tool,
          args: r.args,
          error: r.error,
        }));
      }

      return formatToolResult(combinedData, allUrls);
    },
  });
}
