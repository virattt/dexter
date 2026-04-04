import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { AIMessage, ToolCall } from '@langchain/core/messages';
import { z } from 'zod';
import { callLlm } from '../../model/llm.js';
import { formatToolResult } from '../types.js';
import { getCurrentDate } from '../../agent/prompts.js';

/**
 * Rich description for the get_market_data tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const GET_MARKET_DATA_DESCRIPTION = `
日本株の株価データを取得するインテリジェントなメタツール。自然言語クエリを受け取り、適切な株価データソースに自動ルーティングします。

## 使用すべき場面

- 現在の株価スナップショット（始値・高値・安値・終値・出来高）
- 期間指定の日次株価履歴
- 株価変動の把握

## 使用しない場面

- 財務諸表・投資指標（get_financials を使用）
- 決算データ（get_financials を使用）
- 財務条件でのスクリーニング（stock_screener を使用）
- 一般的なウェブ検索（web_search を使用）

## 注意事項

- クエリ全体を1回渡す（内部で処理）
- 証券コードの解決を自動処理（トヨタ → 7203）
- 日付推論を処理（「先月」「過去1年」等）
- 構造化JSONデータとソースURLを返す
`.trim();

/** Format snake_case tool name to Title Case for progress messages */
function formatSubToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Import market data tools directly (avoid circular deps with index.ts)
import { getStockPrice, getStockPrices } from './stock-price.js';

// All market data tools available for routing
const MARKET_DATA_TOOLS: StructuredToolInterface[] = [
  getStockPrice,
  getStockPrices,
];

// Create a map for quick tool lookup by name
const MARKET_DATA_TOOL_MAP = new Map(MARKET_DATA_TOOLS.map(t => [t.name, t]));

// Build the router system prompt for market data
function buildRouterPrompt(): string {
  return `あなたは日本株の株価データルーティングアシスタントです。
現在日時: ${getCurrentDate()}

ユーザーの自然言語クエリを受け取り、適切な株価データツールを呼び出してください。

## ガイドライン

1. **証券コード解決**: 企業名を4桁証券コードに変換:
   - トヨタ/トヨタ自動車 → 7203
   - ソニー/ソニーグループ → 6758
   - ソフトバンクグループ → 9984
   - キーエンス → 6861
   - 任天堂 → 7974

2. **日付推論**: 期間を具体的な日付に変換:
   - 「先月」→ 1ヶ月前〜今日
   - 「過去1年」→ 1年前〜今日
   - 「2024年」→ 2024-01-01〜2024-12-31

3. **ツール選択**:
   - 最新の株価スナップショット → get_stock_price
   - 期間指定の日次株価履歴 → get_stock_prices

今すぐ適切なツールを呼び出してください。`;
}

// Input schema for the get_market_data tool
const GetMarketDataInputSchema = z.object({
  query: z.string().describe('株価データに関する自然言語クエリ'),
});

/**
 * Create a get_market_data tool configured with the specified model.
 * Uses native LLM tool calling for routing queries to market data tools.
 */
export function createGetMarketData(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_market_data',
    description: `日本株の株価データ取得メタツール。自然言語クエリを受け取り、適切な株価データツールに自動ルーティングします。用途:
- 最新の株価スナップショット（終値・出来高等）
- 期間指定の日次株価履歴`,
    schema: GetMarketDataInputSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      // 1. Call LLM with market data tools bound (native tool calling)
      onProgress?.('株価データを取得中...');
      const { response } = await callLlm(input.query, {
        model,
        systemPrompt: buildRouterPrompt(),
        tools: MARKET_DATA_TOOLS,
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
            const tool = MARKET_DATA_TOOL_MAP.get(tc.name);
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
