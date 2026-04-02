/**
 * 財務データプロバイダーの共通インターフェース定義。
 * J-Quants / Yahoo Finance / TSE CSV に依らない正規化済み型。
 */

export interface FinancialSummaryRecord {
  fiscalYearEnd: string | null;
  period: 'FY' | '4Q' | 'Annual' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | null;
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
