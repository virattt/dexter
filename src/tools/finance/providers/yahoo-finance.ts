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
 * 不明な月は null を返す。
 */
function estimateQuarter(dateStr: string): FinancialSummaryRecord['period'] {
  const month = parseInt(dateStr.slice(5, 7), 10);
  const map: Record<number, FinancialSummaryRecord['period']> = { 3: 'Q4', 6: 'Q1', 9: 'Q2', 12: 'Q3' };
  return map[month] ?? null;
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

type YahooRecord = Record<string, unknown>;

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

    type YFModule = 'incomeStatementHistory' | 'balanceSheetHistory' | 'cashflowStatementHistory'
      | 'defaultKeyStatistics' | 'summaryDetail' | 'incomeStatementHistoryQuarterly'
      | 'balanceSheetHistoryQuarterly' | 'cashflowStatementHistoryQuarterly';

    const modules: YFModule[] = period === 'annual'
      ? ['incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory', 'defaultKeyStatistics', 'summaryDetail']
      : ['incomeStatementHistoryQuarterly', 'balanceSheetHistoryQuarterly', 'cashflowStatementHistoryQuarterly'];

    const result = await yf.quoteSummary(symbol, { modules });

    const incomeList: YahooRecord[] = (period === 'annual'
      ? result.incomeStatementHistory?.incomeStatementHistory
      : result.incomeStatementHistoryQuarterly?.incomeStatementHistoryQuarterly) ?? [];

    const balanceList: YahooRecord[] = (period === 'annual'
      ? result.balanceSheetHistory?.balanceSheetStatements
      : result.balanceSheetHistoryQuarterly?.balanceSheetStatementsQuarterly) ?? [];

    const cfList: YahooRecord[] = (period === 'annual'
      ? result.cashflowStatementHistory?.cashflowStatements
      : result.cashflowStatementHistoryQuarterly?.cashflowStatementsQuarterly) ?? [];

    const keyStats = result.defaultKeyStatistics;
    const summaryDetail = result.summaryDetail;

    const records: FinancialSummaryRecord[] = incomeList.slice(0, limit).map((income: YahooRecord, i: number) => {
      const balance: YahooRecord = balanceList[i] ?? {};
      const cf: YahooRecord = cfList[i] ?? {};

      const endDate = toDateString(income.endDate);
      const periodStr: FinancialSummaryRecord['period'] = endDate
        ? (period === 'annual' ? 'Annual' : estimateQuarter(endDate))
        : null;

      const equity = numOrNull(balance.totalStockholderEquity);
      const totalAssets = numOrNull(balance.totalAssets);
      const netSales = numOrNull(income.totalRevenue);
      const netIncome = numOrNull(income.netIncome);
      const eps = i === 0 ? (numOrNull(keyStats?.trailingEps) ?? null) : null;  // trailingEps is a TTM value, not period-specific
      const sharesOutstanding = keyStats?.sharesOutstanding ? numOrNull(keyStats.sharesOutstanding) : null;
      const bps = equity !== null && sharesOutstanding !== null && sharesOutstanding > 0
        ? Math.round(equity / sharesOutstanding)
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
        operatingProfit: numOrNull(income.operatingIncome),
        ordinaryProfit: null,
        netIncome,
        eps: i === 0 ? eps : null,  // trailingEps is a TTM value, not period-specific
        dividendPerShare: i === 0 ? (numOrNull(summaryDetail?.trailingAnnualDividendRate) ?? null) : null,  // trailing value, not period-specific
        forecastSales: null,
        forecastOperatingProfit: null,
        forecastNetIncome: null,
        totalAssets,
        equity,
        bps,
        equityToAssetRatio,
        cashFlowsFromOperating: numOrNull(cf.totalCashFromOperatingActivities),
        cashFlowsFromInvesting: numOrNull(cf.totalCashflowsFromInvestingActivities),
        cashFlowsFromFinancing: numOrNull(cf.totalCashFromFinancingActivities),
      };
    });

    return { records, source: 'yahoo', url };
  }
}
