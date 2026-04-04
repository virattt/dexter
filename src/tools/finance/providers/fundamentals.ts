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

const VALID_PERIOD_VALUES = new Set<string>(['FY', '4Q', 'Annual', 'Q1', 'Q2', 'Q3', 'Q4']);

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
    period: (() => {
      const v = s.CurPerType != null ? String(s.CurPerType) : null;
      return (v !== null && VALID_PERIOD_VALUES.has(v)) ? (v as FinancialSummaryRecord['period']) : null;
    })(),
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
