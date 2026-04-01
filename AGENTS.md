# リポジトリガイドライン

- リポジトリ: https://github.com/yuya-sugita/sapiens
- SapiensはFX・株価指数・コモディティの定量トレード分析に特化したCLIベースのAIエージェント。Fintokeiプロップトレーディングに最適化。TypeScript、Ink（CLI用React）、LangChainで構築。

## プロジェクト構成

- ソースコード: `src/`
  - エージェントコア: `src/agent/`（エージェントループ、プロンプト、スクラッチパッド、トークンカウント、型定義）
  - CLIインターフェース: `src/cli.tsx`（Ink/React）、エントリポイント: `src/index.tsx`
  - コンポーネント: `src/components/`（Ink UIコンポーネント）
  - フック: `src/hooks/`（エージェントランナー、モデル選択、入力履歴用Reactフック）
  - モデル/LLM: `src/model/llm.ts`（マルチプロバイダLLM抽象化）
  - ツール: `src/tools/`（FX/CFDツール、Web検索、ブラウザ、スキルツール）
  - Forexツール: `src/tools/forex/`（市場データ、テクニカル分析、統計分析、マクロ分析、クオンツ戦略、経済カレンダー、Fintokeiルール、トレードジャーナル）
  - 検索ツール: `src/tools/search/`（Exa優先、Perplexity、Tavilyフォールバック）
  - ブラウザ: `src/tools/browser/`（PlaywrightベースのWebスクレイピング）
  - スキル: `src/skills/`（SKILL.mdベースの拡張可能ワークフロー: 定量トレード分析、Fintokeiチャレンジ最適化、リスク管理）
  - ユーティリティ: `src/utils/`（env、設定、キャッシュ、トークン推定、マークダウンテーブル）
  - 評価: `src/evals/`（LangSmith評価ランナー + Ink UI）
- 設定: `.sapiens/settings.json`（モデル/プロバイダ選択の永続化）
- トレードジャーナル: `.sapiens/journal/trades.json`（トレード記録）
- 環境変数: `.env`（APIキー、`env.example`参照）
- スクリプト: `scripts/release.sh`

## ビルド・テスト・開発コマンド

- ランタイム: Bun（プライマリ）。すべてのコマンドに`bun`を使用。
- 依存関係インストール: `bun install`
- 実行: `bun run start` または `bun run src/index.tsx`
- 開発（ウォッチモード）: `bun run dev`
- 型チェック: `bun run typecheck`
- テスト: `bun test`
- 評価: `bun run src/evals/run.ts`（全件）または `bun run src/evals/run.ts --sample 10`（サンプル）
- CIはpush/PRで `bun run typecheck` と `bun test` を実行。

## コーディングスタイルと規約

- 言語: TypeScript（ESM、strictモード）。JSXはReact経由（Ink CLIレンダリング）。
- 厳密な型付け推奨。`any`を避ける。
- ファイルは簡潔に。重複よりヘルパー抽出。
- トリッキーな部分や非自明なロジックには簡潔なコメント。
- 明示的に求められない限りログを追加しない。
- 明示的に求められない限りREADMEやドキュメントファイルを作成しない。

## LLMプロバイダ

- 対応: OpenAI（デフォルト）、Anthropic、Google、xAI（Grok）、Moonshot、DeepSeek、OpenRouter、Ollama（ローカル）。
- デフォルトモデル: `gpt-5.4`。プロバイダ検出はプレフィックスベース（`claude-` → Anthropic、`gemini-` → Google等）。
- 軽量タスク用ファストモデル: `src/model/llm.ts`の`FAST_MODELS`マップ参照。
- Anthropicはプロンプトキャッシュのコスト削減のためシステムプロンプトに明示的な`cache_control`を使用。
- ユーザーはCLIの`/model`コマンドでプロバイダ/モデルを切り替え。

## ツール

- `get_market_data`: すべての市場データクエリ用メタツール（価格、ヒストリカルOHLCV、テクニカル指標）。内部でサブツールにルーティング。
- `get_zscore`: z-スコア分析（パーセンタイルランク、平均回帰確率）。
- `get_correlation_matrix`: 2-8銘柄間のリターン相関行列。
- `get_return_distribution`: リターン分布の完全統計分析（歪度、尖度、VaR/CVaR、Hurst指数、自己相関、Jarque-Bera検定）。
- `get_volatility_regime`: ボラティリティレジーム検出（LOW/NORMAL/HIGH/CRISIS）。
- `get_rate_differential`: 金利差分析と政策ダイバージェンススコアリング。
- `get_macro_regime`: 先行指標（GDP/PMI/CPI/失業率/小売）からのマクロレジーム分類。
- `get_cross_asset_regime`: クロスアセットリスクオン/オフ検出。
- `backtest_strategy`: 5つの定量戦略のバックテスト（SMAクロス、z-score平均回帰、RSIモメンタム、ボリンジャーブレイクアウト、ドンチャンチャネル）。
- `monte_carlo_simulation`: Fintokeiチャレンジ結果のモンテカルロシミュレーション。
- `calculate_expected_value`: 確率加重シナリオからの期待値計算。
- `economic_calendar`: 影響度付き経済指標イベントの取得。
- `get_fintokei_rules`: Fintokeiチャレンジルール（利益目標、DD制限、日次ロス制限）。
- `calculate_position_size`: ケリー基準ベースのポジションサイジング。
- `check_account_health`: アカウントヘルス評価。
- `record_trade` / `close_trade`: トレードジャーナルの記録・決済。
- `get_trade_stats` / `get_trade_history`: Sharpe/Sortino/ケリー基準付きパフォーマンス分析。
- `web_search`: 汎用Web検索（`EXASEARCH_API_KEY`設定時はExa、なければPerplexity/Tavily）。
- `browser`: Playwrightベースのブラウザ操作。
- `skill`: SKILL.md定義ワークフローの呼び出し。各スキルはクエリあたり最大1回実行。
- ツールレジストリ: `src/tools/registry.ts`。ツールは環境変数に基づいて条件付きで含まれる。

## スキル

- スキルはYAMLフロントマター（`name`、`description`）とマークダウン本文（手順）を持つ`SKILL.md`ファイル。
- ビルトインスキル:
  - `src/skills/trade-analysis/SKILL.md` — 8ステップ定量トレード分析ワークフロー
  - `src/skills/fintokei-challenge/SKILL.md` — モンテカルロベースのFintokeiチャレンジ最適化
  - `src/skills/risk-management/SKILL.md` — ケリー基準＋ボラティリティ調整＋相関分解のリスク管理
- 検出: `src/skills/registry.ts`が起動時にSKILL.mdファイルをスキャン。
- スキルはシステムプロンプトにメタデータとして公開。LLMが`skill`ツールで呼び出す。

## エージェントアーキテクチャ

- エージェントループ: `src/agent/agent.ts`。最大反復回数（デフォルト10）の反復ツール呼び出しループ。
- スクラッチパッド: `src/agent/scratchpad.ts`。クエリ内のすべてのツール結果の単一真実のソース。
- コンテキスト管理: Anthropicスタイル。フルツール結果をコンテキストに保持。トークン閾値超過時に最も古い結果をクリア。
- 最終回答: フルスクラッチパッドコンテキストで別のLLM呼び出しで生成（ツールバインドなし）。
- イベント: エージェントは型付きイベント（`tool_start`、`tool_end`、`thinking`、`answer_start`、`done`等）をリアルタイムUI更新用にyield。

## Fintokei対応銘柄

- FXメジャー: EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD
- FXマイナー/クロス: EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY 他15ペア以上
- 株価指数: JP225, US30, US500, NAS100, GER40, UK100, FRA40, AUS200, HK50
- コモディティ: XAUUSD（金）, XAGUSD（銀）, USOIL（WTI）, UKOIL（ブレント）
- 銘柄マッピングとpipサイズは `src/tools/forex/api.ts` で定義

## 環境変数

- LLMキー: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `MOONSHOT_API_KEY`, `DEEPSEEK_API_KEY`
- Ollama: `OLLAMA_BASE_URL`（デフォルト `http://127.0.0.1:11434`）
- 市場データ: `TWELVE_DATA_API_KEY`（価格、指標、経済カレンダー）
- 検索: `EXASEARCH_API_KEY`（優先）, `PERPLEXITY_API_KEY`, `TAVILY_API_KEY`（フォールバック）
- トレース: `LANGSMITH_API_KEY`, `LANGSMITH_ENDPOINT`, `LANGSMITH_PROJECT`, `LANGSMITH_TRACING`
- `.env`ファイルや実際のAPIキーを絶対にコミットしない。

## バージョンとリリース

- バージョン形式: CalVer `YYYY.M.D`（ゼロパディングなし）。タグプレフィックス: `v`。
- リリーススクリプト: `bash scripts/release.sh [version]`（デフォルトは今日の日付）。
- リリースフロー: `package.json`のバージョンバンプ → gitタグ作成 → タグプッシュ → `gh`でGitHubリリース作成。
- ユーザー確認なしにプッシュ・公開しない。

## テスト

- フレームワーク: Bunビルトインテストランナー（プライマリ）、Jestコンフィグはレガシー互換のために存在。
- テストは `*.test.ts` としてソースと同じ場所に配置。
- ロジックを変更したらプッシュ前に `bun test` を実行。

## セキュリティ

- APIキーは `.env`（gitignore済み）に保存。ユーザーはCLIでインタラクティブにキーを入力することも可能。
- 設定は `.sapiens/settings.json`（gitignore済み）に保存。
- トレードジャーナルは `.sapiens/journal/`（gitignore済み）に保存。
- 実際のAPIキー、トークン、資格情報を絶対に公開・コミットしない。
