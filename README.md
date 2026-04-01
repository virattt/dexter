# Sapiens

Sapiensは、FX・株価指数・ゴールド等のCFD銘柄に特化した自律型定量トレード分析エージェントです。Fintokeiプロップトレーディングチャレンジに最適化されています。統計分析、計量経済モデル、モンテカルロシミュレーション、ケリー基準によるポジションサイジングなど、クオンツレベルの分析をターミナル上で実行します。

## 目次

- [概要](#概要)
- [前提条件](#前提条件)
- [インストール方法](#インストール方法)
- [実行方法](#実行方法)
- [ツールと分析機能](#ツールと分析機能)
- [スキル](#スキル)
- [Fintokei対応](#fintokei対応)
- [デバッグ方法](#デバッグ方法)
- [WhatsAppでの利用](#whatsappでの利用)
- [コントリビューション](#コントリビューション)
- [ライセンス](#ライセンス)


## 概要

Sapiensはトレードアイデアや市場に関する質問を受け取り、統計学・計量経済学・確率論を用いた包括的な定量分析を実行します。常にFintokeiチャレンジのルール内で分析を行います。

**主要機能：**
- **統計レジーム判定**: Hurst指数、自己相関分析によりトレンド/平均回帰/ランダムウォークを統計的に分類
- **リターン分布分析**: 歪度、尖度、VaR/CVaR、Jarque-Bera正規性検定でテールリスクを定量化
- **ボラティリティレジーム分類**: LOW/NORMAL/HIGH/CRISISの4段階判定、vol-of-volによるレジーム変化予測
- **マクロ計量経済分析**: 金利差、先行指標複合スコア、マクロレジーム分類（GDP/PMI/CPI/失業率/小売）
- **クロスアセットレジーム検出**: S&P500/金/JPY/AUD/JPYの加重スコアからリスクオン/オフを判定
- **戦略バックテスト**: 5つの定量戦略をヒストリカルデータで検証（Sharpe/Sortino/最大DD/プロフィットファクター/ケリー基準）
- **モンテカルロシミュレーション**: 10,000パスでFintokeiチャレンジ通過確率をシミュレーション
- **期待値計算**: 確率加重シナリオから数学的エッジの有無を判定
- **ケリー基準ポジションサイジング**: 数学的に最適な賭け金をFintokei制約下で計算
- **トレードジャーナル**: Sharpe比率/Sortino比率/破産確率を含む高度なパフォーマンス分析
- **持続的メモリ**: Fintokeiプラン、好みの銘柄、トレーディングスタイルをセッション間で記憶

**対応銘柄：**
- **FXメジャー**: EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD
- **FXマイナー/クロス**: EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY 他15ペア以上
- **株価指数**: JP225（日経）, US30（ダウ）, US500（S&P）, NAS100（ナスダック）, GER40（DAX）, UK100（FTSE）, FRA40, AUS200, HK50
- **コモディティ**: XAUUSD（金）, XAGUSD（銀）, USOIL（WTI）, UKOIL（ブレント）


## 前提条件

- [Bun](https://bun.com) ランタイム（v1.0以上）
- LLM APIキー（OpenAI, Anthropic, Google, xAI等いずれか1つ）
- Twelve Data APIキー（[twelvedata.com](https://twelvedata.com/) で無料取得）— 市場データ・指標・経済カレンダー用
- Exa APIキー（任意、Web検索用）— [exa.ai](https://exa.ai) で取得

#### Bunのインストール

**macOS/Linux:**
```bash
curl -fsSL https://bun.com/install | bash
```

**Windows:**
```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

インストール後、ターミナルを再起動して確認：
```bash
bun --version
```

## インストール方法

1. リポジトリをクローン：
```bash
git clone https://github.com/yuya-sugita/sapiens.git
cd sapiens
```

2. 依存関係をインストール：
```bash
bun install
```

3. 環境変数を設定：
```bash
cp env.example .env

# .env を編集してAPIキーを追加：
# OPENAI_API_KEY=your-openai-api-key        (または ANTHROPIC_API_KEY 等)
# TWELVE_DATA_API_KEY=your-twelve-data-key   (市場データ・指標用)
# EXASEARCH_API_KEY=your-exa-api-key         (任意: Web検索)
```

## 実行方法

対話モードで起動：
```bash
bun start
```

開発用ウォッチモード：
```bash
bun dev
```

### クエリの例

```
> EUR/USDの統計レジームを判定して（Hurst指数、自己相関）
> ゴールドのリターン分布を分析して（歪度、尖度、VaR）
> USD/JPYとEUR/USDとGBP/USDの相関行列を出して
> 日米の金利差と政策ダイバージェンスを分析して
> 日本のマクロレジームを先行指標から判定して
> EUR/USDで平均回帰戦略をバックテストして
> 勝率55%、平均勝ち1.5%、平均負け-0.75%でFintokeiチャレンジのモンテカルロを回して
> 現在のボラティリティレジームに基づいてポジションサイジングを計算して
> 今週のトレード成績をSharpe/Sortino付きで分析して
```


## ツールと分析機能

### 統計分析エンジン

| ツール | 分析内容 |
|--------|----------|
| `get_zscore` | z-スコア、パーセンタイルランク、平均回帰確率 |
| `get_correlation_matrix` | 2-8銘柄間のリターン相関行列（ポートフォリオリスク分解用） |
| `get_return_distribution` | 歪度、尖度、VaR/CVaR、Hurst指数、自己相関、Jarque-Bera検定 |
| `get_volatility_regime` | ボラティリティレジーム判定（LOW/NORMAL/HIGH/CRISIS）、vol期間構造 |

### マクロ計量経済分析

| ツール | 分析内容 |
|--------|----------|
| `get_rate_differential` | 金利差分析、キャリートレード利回り、政策ダイバージェンス |
| `get_macro_regime` | GDP/PMI/CPI/失業率/小売の複合分析からマクロレジーム判定 |
| `get_cross_asset_regime` | S&P500/金/JPY/AUD/JPYからリスクオン/オフ検出 |

### クオンツ戦略エンジン

| ツール | 分析内容 |
|--------|----------|
| `backtest_strategy` | 5戦略のバックテスト（Sharpe/Sortino/最大DD/ケリー基準付き） |
| `monte_carlo_simulation` | Fintokeiチャレンジ通過確率のモンテカルロシミュレーション |
| `calculate_expected_value` | 確率加重シナリオからの期待値計算 |

### 市場データ・テクニカル指標

| ツール | 分析内容 |
|--------|----------|
| `get_market_data` | リアルタイム価格、OHLCV履歴、テクニカル指標（メタツール） |
| `economic_calendar` | 経済指標カレンダー（影響度・対象通貨ペア付き） |

### Fintokeiリスク管理

| ツール | 分析内容 |
|--------|----------|
| `get_fintokei_rules` | チャレンジルール（利益目標、DD上限、日次ロス制限） |
| `calculate_position_size` | ケリー基準ベースのポジションサイジング |
| `check_account_health` | アカウントヘルスチェック（DD状況、目標進捗） |

### トレードジャーナル

| ツール | 分析内容 |
|--------|----------|
| `record_trade` / `close_trade` | トレード記録・決済（R:R自動計算） |
| `get_trade_stats` | Sharpe/Sortino/ケリー基準/破産確率を含む高度な統計分析 |
| `get_trade_history` | トレード履歴・オープンポジション一覧 |


## スキル

スキルは複雑な分析タスクに対するステップバイステップのワークフローです：

| スキル | トリガー | ワークフロー |
|--------|---------|-------------|
| `trade-analysis` | 「分析して」「セットアップを評価して」「エッジを探して」 | 8ステップ定量分析：レジーム判定→分布分析→ボラティリティ→マクロ→クロスアセット→相関→イベント→期待値 |
| `fintokei-challenge` | 「チャレンジの確率」「通過戦略」「アカウント状況」 | モンテカルロベースのチャレンジ最適化：統計監査→MC Sim→最適パラメータ→リスク予算配分 |
| `risk-management` | 「ポジションサイジング」「相関リスク」「ケリー基準」 | ケリー基準＋ボラティリティ調整＋相関ファクター分解＋ドローダウン回復モデリング |


## Fintokei対応

SapiensはFintokeiチャレンジのルールを制約付き最適化問題として扱います：

**対応プラン：**
- **ProTrader**（2ステップ）: Phase 1（8%目標、5%日次/10%全体DD）→ Phase 2（5%目標）→ Funded（80%分配）
- **SwiftTrader**（1ステップ）: 10%目標、5%日次/10%全体DD → Funded（80%分配）
- **StartTrader**（即時ファンド）: チャレンジなし、50-90%スケーリング分配

**口座サイズ**: ¥200,000 / ¥500,000 / ¥1,000,000 / ¥2,000,000 / ¥5,000,000

**定量的リスク管理機能：**
- ケリー基準とボラティリティレジームに基づくポジションサイジング
- モンテカルロシミュレーションによるチャレンジ通過確率の事前計算
- 相関行列によるファクターエクスポージャー分解
- ドローダウン回復の確率モデリング
- HEALTHY / WARNING / DANGER / FAILEDの自動ステータス判定


## デバッグ方法

すべてのツール呼び出しは `.sapiens/scratchpad/` にJSONLファイルとして記録されます：

```
.sapiens/scratchpad/
├── 2026-03-30-111400_9a8f10723f79.jsonl
└── ...
```

各ファイルにはクエリ、ツール呼び出しと結果、エージェントの推論が記録されます。

トレードジャーナルのデータは `.sapiens/journal/trades.json` に保存されます。


## WhatsAppでの利用

WhatsApp経由でSapiensとチャット：

```bash
# WhatsAppアカウントをリンク（QRコードスキャン）
bun run gateway:login

# ゲートウェイを起動
bun run gateway
```

WhatsApp上で自分自身にメッセージを送り、分析クエリを入力します。

詳細なセットアップについては [WhatsApp Gateway README](src/gateway/channels/whatsapp/README.md) を参照。


## コントリビューション

1. リポジトリをフォーク
2. フィーチャーブランチを作成
3. 変更をコミット
4. ブランチにプッシュ
5. プルリクエストを作成

**重要**: プルリクエストは小さく、フォーカスを絞ってください。


## ライセンス

このプロジェクトはMITライセンスの下でライセンスされています。
