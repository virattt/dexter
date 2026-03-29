/**
 * Number formatting utilities for financial data.
 *
 * Formats raw numeric values from tool results into human-readable strings
 * before they are injected into the LLM context. This reduces interpretation
 * errors and makes large magnitudes immediately legible.
 *
 * Safe to apply recursively to arbitrary JSON objects — non-financial fields
 * are left untouched.
 */

/** Financial field names that represent monetary amounts (USD). */
const MONETARY_FIELDS = new Set([
  'revenue', 'netIncome', 'grossProfit', 'operatingIncome', 'ebitda', 'ebit',
  'totalAssets', 'totalLiabilities', 'totalEquity', 'totalDebt', 'netDebt',
  'freeCashFlow', 'operatingCashFlow', 'capitalExpenditures', 'researchAndDevelopmentExpenses',
  'sellingGeneralAndAdministrativeExpenses', 'costOfRevenue', 'costOfGoodsSold',
  'marketCap', 'enterpriseValue', 'evToEbitda', 'evToRevenue',
  'dividends', 'dividendsPaid', 'retainedEarnings', 'shortTermDebt', 'longTermDebt',
  'cash', 'cashAndCashEquivalents', 'shortTermInvestments', 'longTermInvestments',
  'buybacks', 'shareRepurchases', 'acquisitions',
  'price', 'priceChange', 'open', 'high', 'low', 'close', 'adjClose',
  'fiftyTwoWeekHigh', 'fiftyTwoWeekLow', 'targetHigh', 'targetLow', 'targetMean', 'targetMedian',
]);

/** Financial field names that represent share counts. */
const SHARE_FIELDS = new Set([
  'sharesOutstanding', 'floatShares', 'sharesShort', 'impliedSharesOutstanding',
  'weightedAverageShsOut', 'weightedAverageShsOutDil',
]);

/** Fields that should never be reformatted (identifiers, dates, plain text). */
const SKIP_FIELDS = new Set([
  'symbol', 'ticker', 'date', 'period', 'reportedCurrency', 'cik',
  'acceptedDate', 'fillingDate', 'calendarYear', 'link', 'finalLink',
  'type', 'name', 'description', 'exchange', 'currency', 'sector', 'industry',
]);

/**
 * Format a monetary value to a compact human-readable string.
 * Examples: 12345678901 → "$12.3B", 4500000 → "$4.5M", 980000 → "$980K"
 */
export function formatMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3)  return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

/**
 * Format a share count to a compact string.
 * Examples: 15000000000 → "15.0B shares", 420000000 → "420.0M shares"
 */
export function formatShares(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(abs / 1e9).toFixed(1)}B shares`;
  if (abs >= 1e6) return `${(abs / 1e6).toFixed(1)}M shares`;
  if (abs >= 1e3) return `${(abs / 1e3).toFixed(1)}K shares`;
  return `${abs} shares`;
}

/**
 * Recursively walk a parsed JSON object and annotate financial numbers with
 * human-readable labels. Returns a new object — does not mutate the input.
 *
 * Only annotates known monetary/share fields; all other fields pass through
 * unchanged so downstream calculations still work on raw values.
 */
export function annotateFinancialNumbers(obj: unknown, depth = 0): unknown {
  // Hard depth limit to prevent runaway recursion on deeply nested structures
  if (depth > 8) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => annotateFinancialNumbers(item, depth + 1));
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SKIP_FIELDS.has(key)) {
        result[key] = value;
      } else if (typeof value === 'number' && isFinite(value) && MONETARY_FIELDS.has(key)) {
        // Keep the raw value AND append a human-readable annotation
        result[key] = value;
        result[`${key}_fmt`] = formatMoney(value);
      } else if (typeof value === 'number' && isFinite(value) && SHARE_FIELDS.has(key)) {
        result[key] = value;
        result[`${key}_fmt`] = formatShares(value);
      } else {
        result[key] = annotateFinancialNumbers(value, depth + 1);
      }
    }
    return result;
  }

  return obj;
}
