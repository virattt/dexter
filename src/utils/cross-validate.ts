/**
 * Multi-source financial data validation utilities.
 *
 * Compares key metrics from two data sources and returns a warning when
 * they diverge beyond an acceptable threshold.  All comparisons are
 * symmetric (no assumption about which source is "right").
 */

export interface FinancialRecord {
  /** Calendar year the record covers */
  year: number;
  /** Total revenue / net sales in USD */
  totalRevenue?: number;
  /** Net income (loss) in USD */
  netIncome?: number;
}

export interface ValidationResult {
  /** true when no meaningful discrepancy was found */
  ok: boolean;
  /** Human-readable warning lines (empty when ok === true) */
  warnings: string[];
}

const DEFAULT_THRESHOLD = 0.15; // 15 %

/**
 * Compare two arrays of annual financial records (e.g. from FinancialDatasets
 * vs FMP) and flag fields that diverge by more than `threshold` for the same
 * year.
 *
 * Only years present in BOTH sources are compared.
 */
export function crossValidateFinancials(
  primary: FinancialRecord[],
  secondary: FinancialRecord[],
  threshold = DEFAULT_THRESHOLD,
): ValidationResult {
  const warnings: string[] = [];

  const secondaryByYear = new Map(secondary.map(r => [r.year, r]));

  for (const p of primary) {
    const s = secondaryByYear.get(p.year);
    if (!s) continue;

    for (const field of ['totalRevenue', 'netIncome'] as const) {
      const pv = p[field];
      const sv = s[field];
      if (pv == null || sv == null || pv === 0) continue;

      const pct = Math.abs(pv - sv) / Math.abs(pv);
      if (pct > threshold) {
        const pFmt = formatUSD(pv);
        const sFmt = formatUSD(sv);
        const pctFmt = (pct * 100).toFixed(1);
        warnings.push(
          `⚠️ ${field} for ${p.year}: primary=${pFmt} vs secondary=${sFmt} (${pctFmt}% divergence)`,
        );
      }
    }
  }

  return { ok: warnings.length === 0, warnings };
}

function formatUSD(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}
