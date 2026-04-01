# J-Quants APIフォールバック実装 設計書

**日付:** 2026-04-01
**対象プロジェクト:** Kabuto（日本株AI金融リサーチエージェント）

---

## 概要

現在J-Quants APIに直接依存している財務諸表・銘柄マスタ取得処理に、株価データと同様のプロバイダーパターンを適用する。J-Quantsが利用不可の場合にyahoo-finance2（財務諸表）およびTSE公開CSV（銘柄マスタ）へ自動フォールバックする。

---

## 1. アーキテクチャ

### ファイル構成

```
src/tools/finance/providers/
  index.ts            ← 既存（株価プロバイダー、変更なし）
  stooq.ts            ← 既存（変更なし）
  yahoo-finance.ts    ← 新規：yahoo-finance2 財務諸表実装
  tse-master.ts       ← 新規：TSE CSV ダウンロード・パース・キャッシュ
  fundamentals.ts     ← 新規：財務諸表プロバイダー抽象（J-Quants / Yahoo）
  company-master.ts   ← 新規：銘柄マスタプロバイダー抽象（J-Quants / TSE CSV）
```

### 制御フロー（`FINANCE_PROVIDER=auto`時）

```
財務諸表 / 銘柄マスタ 呼び出し
  ↓
J-Quantsを試す（JQUANTS_API_KEY があれば）
  → 成功: そのまま返す
  → 失敗 / キーなし: yahoo-finance2 / TSE CSV にフォールバック
```

### 環境変数

| 変数 | 値 | デフォルト |
|---|---|---|
| `STOCK_PROVIDER` | `auto \| jquants \| stooq` | `auto`（既存） |
| `FINANCE_PROVIDER` | `auto \| jquants \| yahoo` | `auto`（新規） |

---

## 2. 正規化インターフェース

### `FinancialSummaryRecord`

```typescript
interface FinancialSummaryRecord {
  fiscalYearEnd: string | null;
  period: string | null;          // 'FY' | '4Q' | 'Annual' | 'Q1' etc
  disclosureDate: string | null;
  // P&L
  netSales: number | null;
  operatingProfit: number | null;
  ordinaryProfit: number | null;  // J-Quants のみ。Yahoo fallback時は null
  netIncome: number | null;
  eps: number | null;
  dividendPerShare: number | null;
  // 業績予想（J-Quants のみ。Yahoo fallback時は null）
  forecastSales: number | null;
  forecastOperatingProfit: number | null;
  forecastNetIncome: number | null;
  // BS
  totalAssets: number | null;
  equity: number | null;
  bps: number | null;
  equityToAssetRatio: number | null;
  // CF
  cashFlowsFromOperating: number | null;
  cashFlowsFromInvesting: number | null;
  cashFlowsFromFinancing: number | null;
}
```

### `CompanyInfo`

```typescript
interface CompanyInfo {
  code: string;   // '7203'
  name: string;
  market: 'Prime' | 'Standard' | 'Growth' | 'Other';
}
```

### プロバイダーインターフェース

```typescript
interface FundamentalsProvider {
  fetchSummary(
    code: string,
    period: 'annual' | 'quarterly',
    limit: number,
  ): Promise<{
    records: FinancialSummaryRecord[];
    source: 'jquants' | 'yahoo';
  }>;
}

interface CompanyMasterProvider {
  fetchAll(): Promise<{
    companies: CompanyInfo[];
    source: 'jquants' | 'tse-csv';
  }>;
}
```

---

## 3. プロバイダー実装

### `yahoo-finance.ts`

- パッケージ: `yahoo-finance2`（npmに追加）
- シンボル変換: `7203` → `7203.T`
- 年次データ: `incomeStatementHistory`, `balanceSheetHistory`, `cashflowStatementHistory`, `defaultKeyStatistics`
- 四半期データ: 上記の `*Quarterly` モジュール
- 日付: `endDate.fmt`（`"2024-03-31"` 形式）
- **注意:** `ordinaryProfit`（経常利益）・業績予想はYahoo Financeに存在しないため `null` を返す
- **`period` フィールド:** Yahoo fallback時は年次を `'Annual'`、四半期を `'Q1'`〜`'Q4'`（`endDate`から決算月を推定）とする

### `tse-master.ts`

- データソース: JPX公開Excel `https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls`
- パース: `xlsx` パッケージ（npm追加）
- キャッシュ: `.kabuto/cache/tse-master.json`（TTL: 24時間）
- 市場区分マッピング:
  - `"プライム"` → `Prime`
  - `"スタンダード"` → `Standard`
  - `"グロース"` → `Growth`
  - その他 → `Other`

### `fundamentals.ts`（プロバイダー抽象）

```
FINANCE_PROVIDER=jquants → J-Quantsのみ
FINANCE_PROVIDER=yahoo   → Yahoo Financeのみ
FINANCE_PROVIDER=auto    → J-Quantsを試し、失敗したらYahoo Finance
```

### `company-master.ts`（プロバイダー抽象）

同様のauto切替え。TSE CSVはキャッシュが有効（24時間以内）ならHTTPリクエストをスキップ。

---

## 4. 既存ファイルへの変更

### `src/tools/finance/fundamentals.ts`

`fetchSummary`内の `jquantsApi.get('/fins/summary', ...)` を `fetchFinancialSummary(code, period, limit)` に置き換え。

各 `mapIncomeStatement` / `mapBalanceSheet` / `mapCashFlow` 関数を `FinancialSummaryRecord` を入力として受け取るよう更新（フィールド名は既に正規化済みのため軽微な変更）。

### `src/tools/finance/screen-stocks.ts`

以下の3箇所を変更:

1. `/equities/master` 呼び出し → `fetchCompanyMaster()` に変更
2. 各社の `/fins/summary` 呼び出し → `fetchFinancialSummary(code, 'annual', 1)` に変更
3. 株価取得（`/equities/bars/daily`）は既存の `fetchPrices`（stooq fallback済み）をそのまま利用

### `env.example`

```bash
# データプロバイダー切替え
STOCK_PROVIDER=auto       # auto | jquants | stooq
FINANCE_PROVIDER=auto     # auto | jquants | yahoo
```

---

## 5. 追加依存パッケージ

| パッケージ | 用途 |
|---|---|
| `yahoo-finance2` | 財務諸表フォールバック |
| `xlsx` | TSE公開Excelのパース |

---

## 6. スコープ外

以下は本設計に含まない:

- `earnings.ts`, `estimates.ts`, `segments.ts`, `insider_trades.ts` — J-Quants固有エンドポイントを使用しており、代替ソースが存在しないため変更なし
- `key-ratios.ts` — 株価に依存するため既存の`fetchPrices`（fallback済み）で間接的にカバー
- `get-market-data.ts`, `get-financials.ts` — プロバイダー変更後の上位ツールのため自動的に恩恵を受ける
