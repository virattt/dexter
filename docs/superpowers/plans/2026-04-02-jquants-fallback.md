# J-Quants APIフォールバック実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** J-Quants APIが利用不可の場合に、yahoo-finance2（財務諸表）とTSE公開CSV（銘柄マスタ）へ自動フォールバックするプロバイダー層を実装する。

**Architecture:** 既存の株価プロバイダー（`providers/index.ts`）と同じパターンで、財務諸表・銘柄マスタのプロバイダー抽象を追加する。`FINANCE_PROVIDER=auto|jquants|yahoo` 環境変数で切替え。既存の `fundamentals.ts` と `screen-stocks.ts` をプロバイダー経由に変更する。

**Tech Stack:** TypeScript, Bun, yahoo-finance2, xlsx, vitest

---

## ファイルマップ

| アクション | ファイル | 責務 |
|---|---|---|
| 新規作成 | `src/tools/finance/providers/types.ts` | 共通インターフェース（`FinancialSummaryRecord`, `CompanyInfo`, `FundamentalsProvider`, `CompanyMasterProvider`） |
| 新規作成 | `src/tools/finance/providers/yahoo-finance.ts` | yahoo-finance2 を使った財務諸表取得 |
| 新規作成 | `src/tools/finance/providers/tse-master.ts` | TSE公開ExcelをダウンロードしてパースするCompanyMasterプロバイダー |
| 新規作成 | `src/tools/finance/providers/fundamentals.ts` | J-Quants/Yahoo切替えロジック（`fetchFinancialSummary`関数を公開） |
| 新規作成 | `src/tools/finance/providers/company-master.ts` | J-Quants/TSE CSV切替えロジック（`fetchCompanyMaster`関数を公開） |
| 変更 | `src/tools/finance/fundamentals.ts` | `jquantsApi.get('/fins/summary')` を `fetchFinancialSummary` に置き換え |
| 変更 | `src/tools/finance/screen-stocks.ts` | `/equities/master` と `/fins/summary` をプロバイダー経由に変更 |
| 変更 | `env.example` | `FINANCE_PROVIDER` 変数を追加 |
| 新規作成 | `src/tools/finance/providers/__tests__/types.test.ts` | 型の正規化ロジックのテスト |
| 新規作成 | `src/tools/finance/providers/__tests__/fundamentals.test.ts` | プロバイダー切替えロジックのテスト |
| 新規作成 | `src/tools/finance/providers/__tests__/company-master.test.ts` | 銘柄マスタプロバイダー切替えのテスト |

---

### Task 1: 依存パッケージのインストール

**Files:**
- Modify: `package.json`

- [ ] **Step 1: パッケージをインストール**

```bash
cd /home/shumpeim/kabuto
bun add yahoo-finance2 xlsx
```

Expected: `bun.lock` が更新される。

- [ ] **Step 2: インストール確認**

```bash
bun -e "import yf from 'yahoo-finance2'; console.log('ok')"
```

Expected: `ok` と出力される。

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add yahoo-finance2 and xlsx dependencies"
```

---

### Task 2: 共通型定義（`providers/types.ts`）

**Files:**
- Create: `src/tools/finance/providers/types.ts`

- [ ] **Step 1: テストファイルを作成**

```bash
mkdir -p src/tools/finance/providers/__tests__
```

`src/tools/finance/providers/__tests__/types.test.ts` を作成:

```typescript
import { describe, test, expect } from 'vitest';
import type { FinancialSummaryRecord, CompanyInfo } from '../types.js';

describe('FinancialSummaryRecord', () => {
  test('allows null for J-Quants-only fields', () => {
    const record: FinancialSummaryRecord = {
      fiscalYearEnd: '2024-03-31',
      period: 'Annual',
      disclosureDate: null,
      netSales: 10000000,
      operatingProfit: 1000000,
      ordinaryProfit: null,
      netIncome: 800000,
      eps: 100.5,
      dividendPerShare: 30,
      forecastSales: null,
      forecastOperatingProfit: null,
      forecastNetIncome: null,
      totalAssets: 50000000,
      equity: 20000000,
      bps: 2500,
      equityToAssetRatio: 40.0,
      cashFlowsFromOperating: 1500000,
      cashFlowsFromInvesting: -500000,
      cashFlowsFromFinancing: -300000,
    };
    expect(record.ordinaryProfit).toBeNull();
    expect(record.forecastSales).toBeNull();
    expect(record.netSales).toBe(10000000);
  });

  test('CompanyInfo has correct market union type', () => {
    const prime: CompanyInfo = { code: '7203', name: 'トヨタ自動車', market: 'Prime' };
    const growth: CompanyInfo = { code: '1234', name: 'テスト株式会社', market: 'Growth' };
    expect(prime.market).toBe('Prime');
    expect(growth.market).toBe('Growth');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
cd /home/shumpeim/kabuto
bun test src/tools/finance/providers/__tests__/types.test.ts
```

Expected: `Cannot find module '../types.js'` のようなエラー。

- [ ] **Step 3: `types.ts` を作成**

`src/tools/finance/providers/types.ts`:

```typescript
/**
 * 財務データプロバイダーの共通インターフェース定義。
 * J-Quants / Yahoo Finance / TSE CSV に依らない正規化済み型。
 */

export interface FinancialSummaryRecord {
  fiscalYearEnd: string | null;
  period: string | null;           // 'FY' | '4Q' | 'Annual' | 'Q1'〜'Q4'
  disclosureDate: string | null;
  // P&L
  netSales: number | null;
  operatingProfit: number | null;
  ordinaryProfit: number | null;   // J-Quants のみ。Yahoo fallback時は null
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
  equityToAssetRatio: number | null;  // %表示（40.0 = 40%）
  // CF
  cashFlowsFromOperating: number | null;
  cashFlowsFromInvesting: number | null;
  cashFlowsFromFinancing: number | null;
}

export interface CompanyInfo {
  code: string;   // '7203'（4桁、ゼロ埋め）
  name: string;
  market: 'Prime' | 'Standard' | 'Growth' | 'Other';
}

export interface FundamentalsProvider {
  fetchSummary(
    code: string,
    period: 'annual' | 'quarterly',
    limit: number,
  ): Promise<{
    records: FinancialSummaryRecord[];
    source: 'jquants' | 'yahoo';
    url: string;
  }>;
}

export interface CompanyMasterProvider {
  fetchAll(): Promise<{
    companies: CompanyInfo[];
    source: 'jquants' | 'tse-csv';
  }>;
}
```

- [ ] **Step 4: テストを実行してパスを確認**

```bash
cd /home/shumpeim/kabuto
bun test src/tools/finance/providers/__tests__/types.test.ts
```

Expected: `2 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/tools/finance/providers/types.ts src/tools/finance/providers/__tests__/types.test.ts
git commit -m "feat: add shared FinancialSummaryRecord and CompanyInfo types"
```

---

### Task 3: Yahoo Finance プロバイダー（`providers/yahoo-finance.ts`）

**Files:**
- Create: `src/tools/finance/providers/yahoo-finance.ts`

- [ ] **Step 1: yahoo-finance2 の型を確認**

```bash
cd /home/shumpeim/kabuto
bun -e "
import yf from 'yahoo-finance2';
const result = await yf.quoteSummary('7203.T', { modules: ['incomeStatementHistory'] });
console.log(JSON.stringify(result.incomeStatementHistory?.incomeStatementHistory?.[0], null, 2));
"
```

Expected: `totalRevenue`, `operatingIncome`, `netIncome`, `endDate` などのフィールドが確認できる。

- [ ] **Step 2: `yahoo-finance.ts` を作成**

`src/tools/finance/providers/yahoo-finance.ts`:

```typescript
/**
 * Yahoo Finance プロバイダー（yahoo-finance2 パッケージ使用）
 * J-Quants が利用不可の場合のフォールバック。
 * シンボル: '7203' → '7203.T'
 *
 * 注意:
 *   - ordinaryProfit（経常利益）はYahoo Financeに存在しないため null
 *   - 業績予想（forecastSales等）はYahoo Financeに存在しないため null
 *   - period フィールド: 年次='Annual', 四半期は endDate の月から推定('Q1'〜'Q4')
 */
import type { FinancialSummaryRecord, FundamentalsProvider } from './types.js';

function toYahooSymbol(code: string): string {
  return `${code.padStart(4, '0')}.T`;
}

/**
 * endDate（Date または {raw, fmt} オブジェクト）から YYYY-MM-DD 文字列を返す
 */
function toDateString(endDate: unknown): string | null {
  if (!endDate) return null;
  if (endDate instanceof Date) return endDate.toISOString().slice(0, 10);
  if (typeof endDate === 'object' && endDate !== null && 'fmt' in endDate) {
    return String((endDate as Record<string, unknown>).fmt);
  }
  return null;
}

/**
 * YYYY-MM-DD 形式の決算期末日から四半期番号を推定。
 * 3月決算（3月=Q4, 6月=Q1, 9月=Q2, 12月=Q3）を基準にする。
 * 実際の企業の決算期に関わらず月だけで判定するシンプルな近似。
 */
function estimateQuarter(dateStr: string): string {
  const month = parseInt(dateStr.slice(5, 7), 10);
  // 日本の多数派（3月決算）に基づくマッピング
  const map: Record<number, string> = { 3: 'Q4', 6: 'Q1', 9: 'Q2', 12: 'Q3' };
  return map[month] ?? 'Q?';
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'object' && 'raw' in (v as Record<string, unknown>)) {
    const raw = (v as Record<string, unknown>).raw;
    const n = Number(raw);
    return isNaN(n) ? null : n;
  }
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export class YahooFinanceProvider implements FundamentalsProvider {
  async fetchSummary(
    code: string,
    period: 'annual' | 'quarterly',
    limit: number,
  ): Promise<{ records: FinancialSummaryRecord[]; source: 'jquants' | 'yahoo'; url: string }> {
    const symbol = toYahooSymbol(code);
    const url = `https://finance.yahoo.com/quote/${symbol}/financials/`;

    // Dynamic import to avoid loading at module init time
    const yf = (await import('yahoo-finance2')).default;

    const modules = period === 'annual'
      ? ['incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory', 'defaultKeyStatistics'] as const
      : ['incomeStatementHistoryQuarterly', 'balanceSheetHistoryQuarterly', 'cashflowStatementHistoryQuarterly'] as const;

    const result = await yf.quoteSummary(symbol, { modules: modules as unknown as string[] });

    const incomeList = period === 'annual'
      ? result.incomeStatementHistory?.incomeStatementHistory ?? []
      : result.incomeStatementHistoryQuarterly?.incomeStatementHistoryQuarterly ?? [];

    const balanceList = period === 'annual'
      ? result.balanceSheetHistory?.balanceSheetStatements ?? []
      : result.balanceSheetHistoryQuarterly?.balanceSheetStatementsQuarterly ?? [];

    const cfList = period === 'annual'
      ? result.cashflowStatementHistory?.cashflowStatements ?? []
      : result.cashflowStatementHistoryQuarterly?.cashflowStatementsQuarterly ?? [];

    const keyStats = result.defaultKeyStatistics;

    const records: FinancialSummaryRecord[] = incomeList.slice(0, limit).map((income, i) => {
      const balance = balanceList[i] ?? {};
      const cf = cfList[i] ?? {};

      const endDate = toDateString((income as Record<string, unknown>).endDate);
      const periodStr = endDate
        ? (period === 'annual' ? 'Annual' : estimateQuarter(endDate))
        : null;

      const equity = numOrNull((balance as Record<string, unknown>).totalStockholderEquity);
      const totalAssets = numOrNull((balance as Record<string, unknown>).totalAssets);
      const netSales = numOrNull((income as Record<string, unknown>).totalRevenue);
      const netIncome = numOrNull((income as Record<string, unknown>).netIncome);
      const eps = numOrNull(keyStats?.trailingEps) ?? null;
      const bps = equity !== null && keyStats?.sharesOutstanding
        ? Math.round(equity / numOrNull(keyStats.sharesOutstanding)!)
        : null;
      const equityToAssetRatio =
        equity !== null && totalAssets !== null && totalAssets > 0
          ? Math.round((equity / totalAssets) * 1000) / 10
          : null;

      return {
        fiscalYearEnd: endDate,
        period: periodStr,
        disclosureDate: null,
        netSales,
        operatingProfit: numOrNull((income as Record<string, unknown>).operatingIncome),
        ordinaryProfit: null,
        netIncome,
        eps: i === 0 ? eps : null,
        dividendPerShare: numOrNull(keyStats?.trailingAnnualDividendRate) ?? null,
        forecastSales: null,
        forecastOperatingProfit: null,
        forecastNetIncome: null,
        totalAssets,
        equity,
        bps,
        equityToAssetRatio,
        cashFlowsFromOperating: numOrNull((cf as Record<string, unknown>).totalCashFromOperatingActivities),
        cashFlowsFromInvesting: numOrNull((cf as Record<string, unknown>).totalCashflowsFromInvestingActivities),
        cashFlowsFromFinancing: numOrNull((cf as Record<string, unknown>).totalCashFromFinancingActivities),
      };
    });

    return { records, source: 'yahoo', url };
  }
}
```

- [ ] **Step 3: 手動での動作確認（ネット接続必要）**

```bash
cd /home/shumpeim/kabuto
bun -e "
import { YahooFinanceProvider } from './src/tools/finance/providers/yahoo-finance.ts';
const p = new YahooFinanceProvider();
const { records, source } = await p.fetchSummary('7203', 'annual', 2);
console.log('source:', source);
console.log('records[0]:', JSON.stringify(records[0], null, 2));
"
```

Expected: `source: yahoo` と財務データが表示される。

- [ ] **Step 4: Commit**

```bash
git add src/tools/finance/providers/yahoo-finance.ts
git commit -m "feat: add YahooFinanceProvider for financial statements fallback"
```

---

### Task 4: TSE銘柄マスタプロバイダー（`providers/tse-master.ts`）

**Files:**
- Create: `src/tools/finance/providers/tse-master.ts`

- [ ] **Step 1: テストファイルを作成**

`src/tools/finance/providers/__tests__/company-master.test.ts`:

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TseMasterProvider } from '../tse-master.js';

// TSE Excel のfetchをモック
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe('TseMasterProvider.parseMarket', () => {
  test.each([
    ['東証プライム', 'Prime'],
    ['プライム', 'Prime'],
    ['東証スタンダード', 'Standard'],
    ['東証グロース', 'Growth'],
    ['札幌', 'Other'],
    ['', 'Other'],
  ])('市場名 "%s" → "%s"', (input, expected) => {
    const provider = new TseMasterProvider();
    expect(provider.parseMarket(input)).toBe(expected);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
cd /home/shumpeim/kabuto
bun test src/tools/finance/providers/__tests__/company-master.test.ts
```

Expected: `Cannot find module '../tse-master.js'` のようなエラー。

- [ ] **Step 3: `tse-master.ts` を作成**

`src/tools/finance/providers/tse-master.ts`:

```typescript
/**
 * TSE（東証）公開Excelから上場銘柄マスタを取得するプロバイダー。
 * URL: https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls
 * キャッシュ: .kabuto/cache/tse-master.json（TTL: 24時間）
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CompanyInfo, CompanyMasterProvider } from './types.js';

const CACHE_DIR = '.kabuto/cache';
const CACHE_FILE = join(CACHE_DIR, 'tse-master.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間
const TSE_EXCEL_URL =
  'https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls';

interface CacheEntry {
  updatedAt: number;
  companies: CompanyInfo[];
}

export class TseMasterProvider implements CompanyMasterProvider {
  /** 市場区分文字列を正規化 */
  parseMarket(marketName: string): CompanyInfo['market'] {
    if (marketName.includes('プライム')) return 'Prime';
    if (marketName.includes('スタンダード')) return 'Standard';
    if (marketName.includes('グロース')) return 'Growth';
    return 'Other';
  }

  private readCache(): CompanyInfo[] | null {
    if (!existsSync(CACHE_FILE)) return null;
    try {
      const raw = readFileSync(CACHE_FILE, 'utf-8');
      const entry = JSON.parse(raw) as CacheEntry;
      if (Date.now() - entry.updatedAt > CACHE_TTL_MS) return null;
      return entry.companies;
    } catch {
      return null;
    }
  }

  private writeCache(companies: CompanyInfo[]): void {
    mkdirSync(CACHE_DIR, { recursive: true });
    const entry: CacheEntry = { updatedAt: Date.now(), companies };
    writeFileSync(CACHE_FILE, JSON.stringify(entry));
  }

  async fetchAll(): Promise<{ companies: CompanyInfo[]; source: 'jquants' | 'tse-csv' }> {
    const cached = this.readCache();
    if (cached) return { companies: cached, source: 'tse-csv' };

    const response = await fetch(TSE_EXCEL_URL);
    if (!response.ok) {
      throw new Error(`[TSE Master] fetch failed: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Dynamic import to avoid loading xlsx at startup
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    const companies: CompanyInfo[] = rows
      .map((row) => {
        // Excelのカラム名は「コード」「銘柄名」「市場・商品区分」
        const rawCode = String(row['コード'] ?? row['code'] ?? '').trim();
        const name = String(row['銘柄名'] ?? row['name'] ?? '').trim();
        const marketRaw = String(row['市場・商品区分'] ?? row['market'] ?? '').trim();
        if (!rawCode || !name) return null;
        const code = rawCode.padStart(4, '0').slice(0, 4);
        return { code, name, market: this.parseMarket(marketRaw) };
      })
      .filter((c): c is CompanyInfo => c !== null);

    this.writeCache(companies);
    return { companies, source: 'tse-csv' };
  }
}
```

- [ ] **Step 4: テストを実行してパスを確認**

```bash
cd /home/shumpeim/kabuto
bun test src/tools/finance/providers/__tests__/company-master.test.ts
```

Expected: `6 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/tools/finance/providers/tse-master.ts src/tools/finance/providers/__tests__/company-master.test.ts
git commit -m "feat: add TseMasterProvider with TSE Excel download and 24h cache"
```

---

### Task 5: 財務諸表プロバイダー抽象（`providers/fundamentals.ts`）

**Files:**
- Create: `src/tools/finance/providers/fundamentals.ts`
- Create: `src/tools/finance/providers/__tests__/fundamentals.test.ts`

- [ ] **Step 1: テストファイルを作成**

`src/tools/finance/providers/__tests__/fundamentals.test.ts`:

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';

// モック設定
const mockJQuantsFetch = vi.fn();
const mockYahooFetch = vi.fn();

vi.mock('../../jquants-api.js', () => ({
  jquantsApi: { get: mockJQuantsFetch },
}));

vi.mock('../yahoo-finance.js', () => ({
  YahooFinanceProvider: vi.fn().mockImplementation(() => ({
    fetchSummary: mockYahooFetch,
  })),
}));

import { fetchFinancialSummary } from '../fundamentals.js';
import type { FinancialSummaryRecord } from '../types.js';

const SAMPLE_RECORD: FinancialSummaryRecord = {
  fiscalYearEnd: '2024-03-31',
  period: 'Annual',
  disclosureDate: null,
  netSales: 10000000,
  operatingProfit: 1000000,
  ordinaryProfit: null,
  netIncome: 800000,
  eps: 100,
  dividendPerShare: 30,
  forecastSales: null,
  forecastOperatingProfit: null,
  forecastNetIncome: null,
  totalAssets: 50000000,
  equity: 20000000,
  bps: 2500,
  equityToAssetRatio: 40.0,
  cashFlowsFromOperating: 1500000,
  cashFlowsFromInvesting: -500000,
  cashFlowsFromFinancing: -300000,
};

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.FINANCE_PROVIDER;
  delete process.env.JQUANTS_API_KEY;
});

describe('fetchFinancialSummary', () => {
  test('FINANCE_PROVIDER=yahoo → Yahooのみ使う', async () => {
    process.env.FINANCE_PROVIDER = 'yahoo';
    mockYahooFetch.mockResolvedValue({ records: [SAMPLE_RECORD], source: 'yahoo', url: 'https://yahoo' });

    const result = await fetchFinancialSummary('7203', 'annual', 1);

    expect(mockYahooFetch).toHaveBeenCalledOnce();
    expect(mockJQuantsFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('yahoo');
    expect(result.records).toHaveLength(1);
  });

  test('FINANCE_PROVIDER=auto, APIキーなし → Yahooにフォールバック', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    // JQUANTS_API_KEY は未設定
    mockYahooFetch.mockResolvedValue({ records: [SAMPLE_RECORD], source: 'yahoo', url: 'https://yahoo' });

    const result = await fetchFinancialSummary('7203', 'annual', 1);

    expect(mockJQuantsFetch).not.toHaveBeenCalled();
    expect(mockYahooFetch).toHaveBeenCalledOnce();
    expect(result.source).toBe('yahoo');
  });

  test('FINANCE_PROVIDER=auto, J-Quants成功 → J-Quantsを使う', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    process.env.JQUANTS_API_KEY = 'test-key';
    mockJQuantsFetch.mockResolvedValue({
      data: {
        data: [{
          CurFYEn: '2024-03-31', CurPerType: 'FY', DiscDate: '2024-05-10',
          Sales: 10000000, OP: 1000000, OdP: 900000, NP: 800000,
          EPS: 100, DivAnn: 30, EqAR: 0.4, TA: 50000000, Eq: 20000000, BPS: 2500,
          CFO: 1500000, CFI: -500000, CFF: -300000,
          FSales: null, FOP: null, FNP: null,
        }],
      },
      url: 'https://jquants',
    });

    const result = await fetchFinancialSummary('7203', 'annual', 1);

    expect(mockJQuantsFetch).toHaveBeenCalledOnce();
    expect(mockYahooFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('jquants');
    expect(result.records[0]?.netSales).toBe(10000000);
    expect(result.records[0]?.ordinaryProfit).toBe(900000);
  });

  test('FINANCE_PROVIDER=auto, J-Quants失敗 → Yahooにフォールバック', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    process.env.JQUANTS_API_KEY = 'test-key';
    mockJQuantsFetch.mockRejectedValue(new Error('401 Unauthorized'));
    mockYahooFetch.mockResolvedValue({ records: [SAMPLE_RECORD], source: 'yahoo', url: 'https://yahoo' });

    const result = await fetchFinancialSummary('7203', 'annual', 1);

    expect(mockJQuantsFetch).toHaveBeenCalledOnce();
    expect(mockYahooFetch).toHaveBeenCalledOnce();
    expect(result.source).toBe('yahoo');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
cd /home/shumpeim/kabuto
bun test src/tools/finance/providers/__tests__/fundamentals.test.ts
```

Expected: `Cannot find module '../fundamentals.js'` のようなエラー。

- [ ] **Step 3: `fundamentals.ts` を作成**

`src/tools/finance/providers/fundamentals.ts`:

```typescript
/**
 * 財務諸表プロバイダー抽象層。
 * FINANCE_PROVIDER 環境変数で切替:
 *   auto    - J-Quantsを試して失敗/キーなしならYahooへフォールバック（デフォルト）
 *   jquants - J-Quants API v2のみ
 *   yahoo   - Yahoo Finance（yahoo-finance2）のみ
 */
import { jquantsApi } from '../jquants-api.js';
import { YahooFinanceProvider } from './yahoo-finance.js';
import type { FinancialSummaryRecord } from './types.js';

export interface FetchSummaryResult {
  records: FinancialSummaryRecord[];
  source: 'jquants' | 'yahoo';
  url: string;
}

function getProvider(): 'jquants' | 'yahoo' | 'auto' {
  const p = (process.env.FINANCE_PROVIDER ?? 'auto').toLowerCase();
  if (p === 'jquants') return 'jquants';
  if (p === 'yahoo') return 'yahoo';
  return 'auto';
}

/** J-Quants v2 /fins/summary レスポンスを FinancialSummaryRecord に変換 */
function mapJQuantsRecord(s: Record<string, unknown>): FinancialSummaryRecord {
  const eqAR = Number(s.EqAR ?? 0);
  return {
    fiscalYearEnd: s.CurFYEn != null ? String(s.CurFYEn) : null,
    period: s.CurPerType != null ? String(s.CurPerType) : null,
    disclosureDate: s.DiscDate != null ? String(s.DiscDate) : null,
    netSales: s.Sales != null ? Number(s.Sales) : null,
    operatingProfit: s.OP != null ? Number(s.OP) : null,
    ordinaryProfit: s.OdP != null ? Number(s.OdP) : null,
    netIncome: s.NP != null ? Number(s.NP) : null,
    eps: s.EPS != null ? Number(s.EPS) : null,
    dividendPerShare: s.DivAnn != null ? Number(s.DivAnn) : null,
    forecastSales: s.FSales != null ? Number(s.FSales) : null,
    forecastOperatingProfit: s.FOP != null ? Number(s.FOP) : null,
    forecastNetIncome: s.FNP != null ? Number(s.FNP) : null,
    totalAssets: s.TA != null ? Number(s.TA) : null,
    equity: s.Eq != null ? Number(s.Eq) : null,
    bps: s.BPS != null ? Number(s.BPS) : null,
    equityToAssetRatio: eqAR ? Math.round(eqAR * 1000) / 10 : null,
    cashFlowsFromOperating: s.CFO != null ? Number(s.CFO) : null,
    cashFlowsFromInvesting: s.CFI != null ? Number(s.CFI) : null,
    cashFlowsFromFinancing: s.CFF != null ? Number(s.CFF) : null,
  };
}

async function fetchFromJQuants(
  code: string,
  period: 'annual' | 'quarterly',
  limit: number,
): Promise<FetchSummaryResult> {
  const { data, url } = await jquantsApi.get('/fins/summary', { code }, { cacheable: true });
  let records = (data.data as Record<string, unknown>[] | undefined) ?? [];

  if (period === 'annual') {
    records = records.filter((s) => {
      const t = String(s.CurPerType ?? '');
      return t === 'FY' || t === '4Q' || t === 'Annual';
    });
  }

  const sorted = records
    .sort((a, b) =>
      String(b.CurFYEn ?? b.DiscDate ?? '').localeCompare(String(a.CurFYEn ?? a.DiscDate ?? '')),
    )
    .slice(0, limit)
    .map(mapJQuantsRecord);

  return { records: sorted, source: 'jquants', url };
}

/** 財務諸表を取得。FINANCE_PROVIDER に応じてプロバイダーを選択 */
export async function fetchFinancialSummary(
  code: string,
  period: 'annual' | 'quarterly',
  limit: number,
): Promise<FetchSummaryResult> {
  const provider = getProvider();
  const yahoo = new YahooFinanceProvider();

  if (provider === 'yahoo') {
    return yahoo.fetchSummary(code, period, limit);
  }

  if (provider === 'jquants') {
    return fetchFromJQuants(code, period, limit);
  }

  // auto: J-Quants APIキーがなければ即座にYahooへ
  if (!process.env.JQUANTS_API_KEY) {
    return yahoo.fetchSummary(code, period, limit);
  }

  // auto: J-Quantsを試してダメならYahoo
  try {
    return await fetchFromJQuants(code, period, limit);
  } catch {
    return yahoo.fetchSummary(code, period, limit);
  }
}
```

- [ ] **Step 4: テストを実行してパスを確認**

```bash
cd /home/shumpeim/kabuto
bun test src/tools/finance/providers/__tests__/fundamentals.test.ts
```

Expected: `4 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/tools/finance/providers/fundamentals.ts src/tools/finance/providers/__tests__/fundamentals.test.ts
git commit -m "feat: add fetchFinancialSummary with J-Quants/Yahoo auto fallback"
```

---

### Task 6: 銘柄マスタプロバイダー抽象（`providers/company-master.ts`）

**Files:**
- Create: `src/tools/finance/providers/company-master.ts`

- [ ] **Step 1: テストを `company-master.test.ts` に追記**

`src/tools/finance/providers/__tests__/company-master.test.ts` に以下を追加（既存のファイルを置き換え）:

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockJQuantsFetch = vi.fn();
const mockTseFetchAll = vi.fn();

vi.mock('../../jquants-api.js', () => ({
  jquantsApi: { get: mockJQuantsFetch },
}));

vi.mock('../tse-master.js', () => ({
  TseMasterProvider: vi.fn().mockImplementation(() => ({
    fetchAll: mockTseFetchAll,
    parseMarket: (s: string) => {
      if (s.includes('プライム')) return 'Prime';
      if (s.includes('スタンダード')) return 'Standard';
      if (s.includes('グロース')) return 'Growth';
      return 'Other';
    },
  })),
}));

import { fetchCompanyMaster } from '../company-master.js';
import { TseMasterProvider } from '../tse-master.js';

const SAMPLE_COMPANIES = [
  { code: '7203', name: 'トヨタ自動車', market: 'Prime' as const },
  { code: '9984', name: 'ソフトバンクグループ', market: 'Prime' as const },
];

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.FINANCE_PROVIDER;
  delete process.env.JQUANTS_API_KEY;
});

describe('TseMasterProvider.parseMarket', () => {
  test.each([
    ['東証プライム', 'Prime'],
    ['プライム', 'Prime'],
    ['東証スタンダード', 'Standard'],
    ['東証グロース', 'Growth'],
    ['札幌', 'Other'],
    ['', 'Other'],
  ])('市場名 "%s" → "%s"', (input, expected) => {
    const provider = new TseMasterProvider();
    expect(provider.parseMarket(input)).toBe(expected);
  });
});

describe('fetchCompanyMaster', () => {
  test('FINANCE_PROVIDER=yahoo → TSE CSVを使う', async () => {
    process.env.FINANCE_PROVIDER = 'yahoo';
    mockTseFetchAll.mockResolvedValue({ companies: SAMPLE_COMPANIES, source: 'tse-csv' });

    const result = await fetchCompanyMaster();

    expect(mockTseFetchAll).toHaveBeenCalledOnce();
    expect(mockJQuantsFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('tse-csv');
    expect(result.companies).toHaveLength(2);
  });

  test('FINANCE_PROVIDER=auto, APIキーなし → TSE CSVにフォールバック', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    mockTseFetchAll.mockResolvedValue({ companies: SAMPLE_COMPANIES, source: 'tse-csv' });

    const result = await fetchCompanyMaster();

    expect(mockJQuantsFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('tse-csv');
  });

  test('FINANCE_PROVIDER=auto, J-Quants成功 → J-Quantsを使う', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    process.env.JQUANTS_API_KEY = 'test-key';
    mockJQuantsFetch.mockResolvedValue({
      data: {
        data: [
          { Code: '72030', Name: 'トヨタ自動車', MktNm: 'プライム' },
          { Code: '99840', Name: 'ソフトバンクグループ', MktNm: 'プライム' },
        ],
      },
      url: 'https://jquants',
    });

    const result = await fetchCompanyMaster();

    expect(mockJQuantsFetch).toHaveBeenCalledOnce();
    expect(mockTseFetchAll).not.toHaveBeenCalled();
    expect(result.source).toBe('jquants');
    expect(result.companies[0]?.code).toBe('7203');
  });

  test('FINANCE_PROVIDER=auto, J-Quants失敗 → TSE CSVにフォールバック', async () => {
    process.env.FINANCE_PROVIDER = 'auto';
    process.env.JQUANTS_API_KEY = 'test-key';
    mockJQuantsFetch.mockRejectedValue(new Error('403 Forbidden'));
    mockTseFetchAll.mockResolvedValue({ companies: SAMPLE_COMPANIES, source: 'tse-csv' });

    const result = await fetchCompanyMaster();

    expect(mockTseFetchAll).toHaveBeenCalledOnce();
    expect(result.source).toBe('tse-csv');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
cd /home/shumpeim/kabuto
bun test src/tools/finance/providers/__tests__/company-master.test.ts
```

Expected: `Cannot find module '../company-master.js'` のようなエラー。

- [ ] **Step 3: `company-master.ts` を作成**

`src/tools/finance/providers/company-master.ts`:

```typescript
/**
 * 銘柄マスタプロバイダー抽象層。
 * FINANCE_PROVIDER 環境変数で切替:
 *   auto    - J-Quantsを試して失敗/キーなしならTSE CSVへフォールバック（デフォルト）
 *   jquants - J-Quants API v2 /equities/master のみ
 *   yahoo   - TSE公開CSV（yahoo は銘柄一覧を提供しないためTSEを使う）
 */
import { jquantsApi } from '../jquants-api.js';
import { TseMasterProvider } from './tse-master.js';
import type { CompanyInfo } from './types.js';

export interface FetchCompanyMasterResult {
  companies: CompanyInfo[];
  source: 'jquants' | 'tse-csv';
}

const MARKET_NAME_MAP: Record<string, CompanyInfo['market']> = {
  プライム: 'Prime',
  スタンダード: 'Standard',
  グロース: 'Growth',
};

function parseJQuantsMarket(mktNm: string): CompanyInfo['market'] {
  for (const [key, value] of Object.entries(MARKET_NAME_MAP)) {
    if (mktNm.includes(key)) return value;
  }
  return 'Other';
}

async function fetchFromJQuants(): Promise<FetchCompanyMasterResult> {
  const { data } = await jquantsApi.get('/equities/master', {}, { cacheable: true });
  const infos = (data.data as Record<string, unknown>[] | undefined) ?? [];

  const companies: CompanyInfo[] = infos
    .map((c) => {
      const rawCode = String(c.Code ?? '').trim();
      if (!rawCode) return null;
      // J-Quantsのコードは5桁（末尾0付き）→ 先頭4桁を使う
      const code = rawCode.slice(0, 4);
      return {
        code,
        name: String(c.Name ?? ''),
        market: parseJQuantsMarket(String(c.MktNm ?? '')),
      };
    })
    .filter((c): c is CompanyInfo => c !== null);

  // 重複除去
  const seen = new Set<string>();
  const unique = companies.filter((c) => {
    if (seen.has(c.code)) return false;
    seen.add(c.code);
    return true;
  });

  return { companies: unique, source: 'jquants' };
}

/** 銘柄マスタを取得。FINANCE_PROVIDER に応じてプロバイダーを選択 */
export async function fetchCompanyMaster(): Promise<FetchCompanyMasterResult> {
  const provider = (process.env.FINANCE_PROVIDER ?? 'auto').toLowerCase();
  const tse = new TseMasterProvider();

  if (provider === 'yahoo') {
    // Yahoo は銘柄一覧を提供しないので TSE CSV を使う
    return tse.fetchAll();
  }

  if (provider === 'jquants') {
    return fetchFromJQuants();
  }

  // auto: J-Quants APIキーがなければ即座にTSE CSVへ
  if (!process.env.JQUANTS_API_KEY) {
    return tse.fetchAll();
  }

  // auto: J-Quantsを試してダメならTSE CSV
  try {
    return await fetchFromJQuants();
  } catch {
    return tse.fetchAll();
  }
}
```

- [ ] **Step 4: テストを実行してパスを確認**

```bash
cd /home/shumpeim/kabuto
bun test src/tools/finance/providers/__tests__/company-master.test.ts
```

Expected: `10 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/tools/finance/providers/company-master.ts src/tools/finance/providers/__tests__/company-master.test.ts
git commit -m "feat: add fetchCompanyMaster with J-Quants/TSE CSV auto fallback"
```

---

### Task 7: `fundamentals.ts` をプロバイダー経由に変更

**Files:**
- Modify: `src/tools/finance/fundamentals.ts`

- [ ] **Step 1: 既存の `fetchSummary` 関数を `fetchFinancialSummary` 呼び出しに置き換え**

`src/tools/finance/fundamentals.ts` の `import` 行（先頭）を変更:

```typescript
// 削除する import:
// import { jquantsApi } from './jquants-api.js';

// 追加する import:
import { fetchFinancialSummary } from './providers/fundamentals.js';
import type { FinancialSummaryRecord } from './providers/types.js';
```

- [ ] **Step 2: `FinStatementsInput` 型と `fetchSummary` 関数を置き換え**

既存の `fetchSummary` 関数（`jquantsApi.get` を呼んでいる部分）を以下に置き換え:

```typescript
/** プロバイダー経由で財務サマリーを取得 */
async function fetchSummary(input: FinStatementsInput) {
  const code = input.code.trim().padStart(4, '0');
  const { records, url } = await fetchFinancialSummary(code, input.period, input.limit);
  return { records, url };
}
```

- [ ] **Step 3: `mapIncomeStatement` / `mapBalanceSheet` / `mapCashFlow` の入力型を変更**

各 map 関数のシグネチャを `Record<string, unknown>` から `FinancialSummaryRecord` に変更し、フィールド参照を正規化済みフィールド名に更新:

```typescript
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
    dilutedEps: null,           // yahoo-finance2 では未対応
    dividendPerShare: s.dividendPerShare,
    forecastSales: s.forecastSales,
    forecastOperatingProfit: s.forecastOperatingProfit,
    forecastOrdinaryProfit: null,
    forecastNetIncome: s.forecastNetIncome,
    forecastEps: null,
    forecastDividend: null,
  };
}

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

function mapCashFlow(s: FinancialSummaryRecord): Record<string, unknown> {
  return {
    fiscalYearEnd: s.fiscalYearEnd,
    period: s.period,
    cashFlowsFromOperating: s.cashFlowsFromOperating,
    cashFlowsFromInvesting: s.cashFlowsFromInvesting,
    cashFlowsFromFinancing: s.cashFlowsFromFinancing,
    cashAndEquivalents: null,  // yahoo-finance2 では未対応
  };
}
```

- [ ] **Step 4: 型チェックを実行**

```bash
cd /home/shumpeim/kabuto
bun run typecheck
```

Expected: エラーなし。

- [ ] **Step 5: Commit**

```bash
git add src/tools/finance/fundamentals.ts
git commit -m "refactor: fundamentals.ts to use fetchFinancialSummary provider"
```

---

### Task 8: `screen-stocks.ts` をプロバイダー経由に変更

**Files:**
- Modify: `src/tools/finance/screen-stocks.ts`

- [ ] **Step 1: import を変更**

`screen-stocks.ts` の先頭の import を変更:

```typescript
// 削除する import:
// import { jquantsApi } from './jquants-api.js';

// 追加する import:
import { fetchFinancialSummary } from './providers/fundamentals.js';
import { fetchCompanyMaster } from './providers/company-master.js';
```

- [ ] **Step 2: `/equities/master` 呼び出しを置き換え**

`fetchAll()` で銘柄リストを取得する箇所（約205〜220行目）を置き換え:

```typescript
// Before:
const { data } = await jquantsApi.get('/equities/master', {}, { cacheable: true });
const infos = (data.data as Record<string, unknown>[] | undefined) ?? [];
listedCodes = infos
  .filter((c) => {
    if (filters.market === 'All') return true;
    const mktNm = String(c.MktNm ?? '');
    return mktNm.includes(MARKET_NAME_MAP[filters.market] ?? filters.market);
  })
  .map((c) => String(c.Code ?? '').slice(0, 4))
  .filter(Boolean);
listedCodes = [...new Set(listedCodes)];

// After:
const { companies } = await fetchCompanyMaster();
listedCodes = companies
  .filter((c) => filters.market === 'All' || c.market === filters.market)
  .map((c) => c.code);
listedCodes = [...new Set(listedCodes)];
```

- [ ] **Step 3: `MARKET_NAME_MAP` 定数を削除**

既存の `MARKET_NAME_MAP` 定数（約163〜168行目）はプロバイダー層が持つため削除:

```typescript
// 削除:
const MARKET_NAME_MAP: Record<string, string> = {
  Prime: 'プライム',
  Standard: 'スタンダード',
  Growth: 'グロース',
};
```

- [ ] **Step 4: 各社の `/fins/summary` 呼び出しを置き換え**

バッチ処理内（約237〜270行目）の `/fins/summary` 呼び出しを置き換え:

```typescript
// Before:
const { data } = await jquantsApi.get('/fins/summary', { code }, { cacheable: true });
const records = (data.data as Record<string, unknown>[] | undefined) ?? [];
const latest = records
  .filter((s) => { const t = String(s.CurPerType ?? ''); return t === 'FY' || t === '4Q' || t === 'Annual'; })
  .sort((a, b) => String(b.CurFYEn ?? b.DiscDate ?? '').localeCompare(String(a.CurFYEn ?? a.DiscDate ?? '')))[0];
if (!latest) return;

const eps = Number(latest.EPS ?? 0);
const bps = Number(latest.BPS ?? 0);
const divAnn = Number(latest.DivAnn ?? 0);
const netIncome = Number(latest.NP ?? 0);
const equity = Number(latest.Eq ?? 0);
const totalAssets = Number(latest.TA ?? 0);
const sales = Number(latest.Sales ?? 0);
const opProfit = Number(latest.OP ?? 0);
const eqAR = Number(latest.EqAR ?? 0);

// After:
const { records } = await fetchFinancialSummary(code, 'annual', 1);
const latest = records[0];
if (!latest) return;

const eps = latest.eps ?? 0;
const bps = latest.bps ?? 0;
const divAnn = latest.dividendPerShare ?? 0;
const netIncome = latest.netIncome ?? 0;
const equity = latest.equity ?? 0;
const totalAssets = latest.totalAssets ?? 0;
const sales = latest.netSales ?? 0;
const opProfit = latest.operatingProfit ?? 0;
const eqAR = latest.equityToAssetRatio != null ? latest.equityToAssetRatio / 100 : 0;
```

また、株価取得部分（`/equities/bars/daily`）は **変更不要**（既存の `jquantsApi.get` を直接使っているがフォールバックは `fetchPrices` 経由に変更が望ましい）。以下に差し替え:

```typescript
// Before（screen-stocks.ts内の価格取得）:
const { data: pd } = await jquantsApi.get('/equities/bars/daily', {
  code,
  from: from.toISOString().slice(0, 10),
  to: to.toISOString().slice(0, 10),
});
const quotes = (pd.data as Record<string, unknown>[] | undefined) ?? [];
if (quotes.length > 0) {
  price = Number((quotes[quotes.length - 1] as Record<string, unknown>).AdjC ?? (quotes[quotes.length - 1] as Record<string, unknown>).C);
  break;
}

// After（fetchPrices で stooq フォールバックを活用）:
import { fetchPrices } from './providers/index.js'; // 先頭のimportに追加

const { records: priceRecords } = await fetchPrices(
  code,
  from.toISOString().slice(0, 10),
  to.toISOString().slice(0, 10),
);
if (priceRecords.length > 0) {
  price = priceRecords[priceRecords.length - 1]!.adjustmentClose
    ?? priceRecords[priceRecords.length - 1]!.close;
  break;
}
```

- [ ] **Step 5: 型チェックを実行**

```bash
cd /home/shumpeim/kabuto
bun run typecheck
```

Expected: エラーなし。

- [ ] **Step 6: Commit**

```bash
git add src/tools/finance/screen-stocks.ts
git commit -m "refactor: screen-stocks.ts to use provider layer for master and financials"
```

---

### Task 9: `env.example` を更新してテスト実行

**Files:**
- Modify: `env.example`

- [ ] **Step 1: `env.example` に `FINANCE_PROVIDER` を追加**

`env.example` を開き、`STOCK_PROVIDER` の下に追加:

```bash
# データプロバイダー切替え
STOCK_PROVIDER=auto       # auto | jquants | stooq
FINANCE_PROVIDER=auto     # auto | jquants | yahoo
```

- [ ] **Step 2: 全テストを実行**

```bash
cd /home/shumpeim/kabuto
bun test
```

Expected: 既存テストも含めて全パス（新規テストは4+6+10=20件追加）。

- [ ] **Step 3: 型チェックを最終確認**

```bash
cd /home/shumpeim/kabuto
bun run typecheck
```

Expected: エラーなし。

- [ ] **Step 4: Commit**

```bash
git add env.example
git commit -m "docs: add FINANCE_PROVIDER env var to env.example"
```

---

## セルフレビュー

**スペックカバレッジ確認:**

| スペック要件 | 対応タスク |
|---|---|
| `providers/types.ts`（型定義） | Task 2 |
| `yahoo-finance.ts`（Yahoo財務諸表） | Task 3 |
| `tse-master.ts`（TSE CSV + キャッシュ） | Task 4 |
| `providers/fundamentals.ts`（auto切替え） | Task 5 |
| `providers/company-master.ts`（auto切替え） | Task 6 |
| `fundamentals.ts` の変更 | Task 7 |
| `screen-stocks.ts` の変更 | Task 8 |
| `env.example` の更新 | Task 9 |
| `yahoo-finance2` + `xlsx` パッケージ追加 | Task 1 |

**型一貫性:** `FinancialSummaryRecord` は Task 2 で定義し、Task 3〜8 で一貫して参照。`fetchFinancialSummary` は Task 5 で定義し Task 7・8 で使用。`fetchCompanyMaster` は Task 6 で定義し Task 8 で使用。
