/**
 * Pure WACC / CAPM utilities.
 *
 * All functions are side-effect free and accept plain numbers so they can be
 * unit-tested without any API or file-system dependencies.
 *
 * Formulas used:
 *   CAPM:  Ke = Rfr + β × ERP
 *   WACC:  E/V × Ke  +  D/V × Kd × (1 − T)
 *   where  E/V = 1/(1 + D/E),  D/V = (D/E)/(1 + D/E)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WaccInputs {
  /** Equity beta (market sensitivity). 1.0 = moves 1:1 with the market. */
  beta: number;
  /** Annual risk-free rate as a decimal (e.g. 0.043 for 4.3%). */
  rfr: number;
  /** Equity risk premium as a decimal (e.g. 0.055 for 5.5%). */
  erp: number;
  /** Debt-to-Equity ratio (e.g. 0.5 means $0.50 debt per $1 equity). */
  deRatio: number;
  /** Pre-tax annual cost of debt as a decimal (e.g. 0.055 for 5.5%). */
  costOfDebt: number;
  /** Effective corporate tax rate as a decimal (e.g. 0.21 for 21%). */
  taxRate: number;
}

export interface WaccBreakdown {
  beta: number;
  rfr: number;
  erp: number;
  deRatio: number;
  costOfDebt: number;
  taxRate: number;
  /** Cost of equity via CAPM (Rfr + β × ERP) */
  ke: number;
  /** After-tax cost of debt (Kd × (1 − T)) */
  kdAfterTax: number;
  /** Equity weight in capital structure (E/V) */
  equityWeight: number;
  /** Debt weight in capital structure (D/V) */
  debtWeight: number;
  /** Weighted-Average Cost of Capital */
  wacc: number;
}

// ─── Core functions ──────────────────────────────────────────────────────────

/**
 * Cost of equity via the Capital Asset Pricing Model (CAPM).
 *   Ke = Rfr + β × ERP
 */
export function computeCostOfEquity(beta: number, rfr: number, erp: number): number {
  return rfr + beta * erp;
}

/**
 * Weighted-Average Cost of Capital using the CAPM cost of equity.
 *   WACC = E/V × Ke  +  D/V × Kd × (1 − T)
 *
 * Capital structure weights are derived from the Debt/Equity ratio:
 *   E/V = 1 / (1 + D/E)
 *   D/V = (D/E) / (1 + D/E)
 *
 * When deRatio = 0 (no debt), WACC collapses to Ke.
 */
export function computeWacc(inputs: WaccInputs): number {
  const { beta, rfr, erp, deRatio, costOfDebt, taxRate } = inputs;
  const ke = computeCostOfEquity(beta, rfr, erp);
  const equityWeight = 1 / (1 + deRatio);
  const debtWeight = deRatio / (1 + deRatio);
  const kdAfterTax = costOfDebt * (1 - taxRate);
  return equityWeight * ke + debtWeight * kdAfterTax;
}

/**
 * Full WACC breakdown including all intermediate values.
 * Useful for transparency / reporting in the DCF output.
 */
export function computeWaccBreakdown(inputs: WaccInputs): WaccBreakdown {
  const { beta, rfr, erp, deRatio, costOfDebt, taxRate } = inputs;
  const ke = computeCostOfEquity(beta, rfr, erp);
  const equityWeight = 1 / (1 + deRatio);
  const debtWeight = deRatio / (1 + deRatio);
  const kdAfterTax = costOfDebt * (1 - taxRate);
  const wacc = equityWeight * ke + debtWeight * kdAfterTax;
  return { beta, rfr, erp, deRatio, costOfDebt, taxRate, ke, kdAfterTax, equityWeight, debtWeight, wacc };
}

// ─── Sector beta defaults ────────────────────────────────────────────────────

/**
 * Median unlevered betas by GICS sector (Damodaran, January 2025 update).
 * Used as a fallback when no market-derived beta is available.
 *
 * Source: https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/Betas.html
 */
export const SECTOR_BETA_DEFAULTS: Record<string, number> = {
  'Communication Services': 1.00,
  'Consumer Discretionary': 1.20,
  'Consumer Staples': 0.60,
  'Energy': 1.10,
  'Financials': 1.00,
  'Health Care': 0.85,
  'Industrials': 1.05,
  'Information Technology': 1.30,
  'Materials': 1.10,
  'Real Estate': 0.80,
  'Utilities': 0.40,
};

/**
 * Return a sector-median beta as a fallback when no market data is available.
 * Defaults to 1.0 (market average) for unknown or missing sectors.
 */
export function estimateBetaFromSector(sector: string): number {
  return SECTOR_BETA_DEFAULTS[sector] ?? 1.0;
}
