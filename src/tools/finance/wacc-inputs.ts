import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api } from './api.js';
import { fmpApi } from './fmp.js';
import { formatToolResult } from '../types.js';
import {
  computeWaccBreakdown,
  estimateBetaFromSector,
  type WaccInputs,
} from '../../utils/wacc.js';

export const WACC_INPUTS_DESCRIPTION = `
Fetches the data needed for a CAPM-based WACC calculation and returns the computed result.

## What this tool does
1. Retrieves the company's equity **beta** from the Financial Datasets API (snapshot).
   Falls back to FMP company profile if beta is missing.
   Falls back to a sector-median beta (Damodaran 2025) if neither source has it.
2. Returns all WACC inputs and the computed WACC using the CAPM formula:
   - **Ke = Rfr + β × ERP**  (cost of equity via CAPM)
   - **WACC = E/V × Ke + D/V × Kd × (1 − T)**

## When to use
- In the DCF skill Step 3 to obtain a fundamental, beta-anchored WACC
- Any time the user asks for WACC or cost of equity

## Inputs
- **ticker** (required): stock ticker symbol
- **cost_of_debt**: pre-tax cost of debt as a decimal (default 0.055 = 5.5%); use the company's weighted average interest rate if available
- **tax_rate**: effective corporate tax rate (default 0.21); use Step 1.7 value from DCF
- **risk_free_rate**: annual risk-free rate (default 0.043 = current ~4.3% 10Y Treasury); override if you have a fresher yield
- **equity_risk_premium**: ERP (default 0.055 = 5.5%; Damodaran long-run US estimate)
- **debt_to_equity**: D/E ratio override; if omitted, uses the ratio from the financial metrics snapshot

## Output (all decimals, not percentages)
- beta, betaSource, rfr, erp, ke, deRatio, costOfDebt, taxRate, kdAfterTax, equityWeight, debtWeight, **wacc**, sector
`.trim();

const WaccInputsSchema = z.object({
  ticker: z
    .string()
    .describe("Stock ticker symbol, e.g. 'AAPL'."),
  cost_of_debt: z
    .number()
    .min(0)
    .max(0.3)
    .default(0.055)
    .describe('Pre-tax cost of debt as a decimal (default 0.055 = 5.5%).'),
  tax_rate: z
    .number()
    .min(0)
    .max(0.5)
    .default(0.21)
    .describe('Effective corporate tax rate as a decimal (default 0.21 = 21%).'),
  risk_free_rate: z
    .number()
    .min(0)
    .max(0.15)
    .default(0.043)
    .describe('Annual risk-free rate as a decimal (default 0.043 = 4.3%, approx 10Y Treasury).'),
  equity_risk_premium: z
    .number()
    .min(0.01)
    .max(0.15)
    .default(0.055)
    .describe('Equity risk premium as a decimal (default 0.055 = 5.5%).'),
  debt_to_equity: z
    .number()
    .min(0)
    .optional()
    .describe('D/E ratio override. Omit to auto-read from the financial metrics snapshot.'),
});

/** Try to read beta from the Financial Datasets snapshot response. */
function extractBetaFromSnapshot(snapshot: Record<string, unknown>): number | null {
  const raw = snapshot['beta'];
  if (typeof raw === 'number' && isFinite(raw) && raw > 0) return raw;
  return null;
}

/** Try to read D/E ratio from the Financial Datasets snapshot. */
function extractDeRatioFromSnapshot(snapshot: Record<string, unknown>): number | null {
  for (const key of ['debt_to_equity', 'debtToEquity', 'debt_equity_ratio']) {
    const raw = snapshot[key];
    if (typeof raw === 'number' && isFinite(raw) && raw >= 0) return raw;
  }
  return null;
}

/** Try to read sector from the snapshot. */
function extractSectorFromSnapshot(snapshot: Record<string, unknown>): string | null {
  const s = snapshot['sector'];
  return typeof s === 'string' && s.length > 0 ? s : null;
}

export const waccInputsTool = new DynamicStructuredTool({
  name: 'wacc_inputs',
  description: WACC_INPUTS_DESCRIPTION,
  schema: WaccInputsSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const sourceUrls: string[] = [];

    // ── 1. Fetch snapshot from Financial Datasets ────────────────────────────
    let snapshot: Record<string, unknown> = {};
    try {
      const { data, url } = await api.get('/financial-metrics/snapshot/', { ticker });
      sourceUrls.push(url);
      snapshot = (data.snapshot as Record<string, unknown>) ?? {};
    } catch {
      // Continue with empty snapshot — we have fallbacks
    }

    // ── 2. Resolve beta ──────────────────────────────────────────────────────
    let beta = extractBetaFromSnapshot(snapshot);
    let betaSource = 'Financial Datasets snapshot';

    if (beta === null && process.env.FMP_API_KEY) {
      try {
        const profile = await fmpApi.get<Array<{ beta?: number; sector?: string }>>('/profile', {
          symbol: ticker,
        });
        const b = profile[0]?.beta;
        if (typeof b === 'number' && isFinite(b) && b > 0) {
          beta = b;
          betaSource = 'FMP company profile';
          // Also grab sector from FMP if we don't have it
          if (!snapshot['sector'] && profile[0]?.sector) {
            snapshot['sector'] = profile[0].sector;
          }
        }
      } catch {
        // FMP unavailable — fall through to sector estimate
      }
    }

    const sector = extractSectorFromSnapshot(snapshot) ?? 'Unknown';

    if (beta === null) {
      beta = estimateBetaFromSector(sector);
      betaSource = `sector median (${sector})`;
    }

    // ── 3. Resolve D/E ratio ─────────────────────────────────────────────────
    const deRatio =
      input.debt_to_equity ??
      extractDeRatioFromSnapshot(snapshot) ??
      0.3; // conservative default when unavailable

    // ── 4. Compute WACC ──────────────────────────────────────────────────────
    const waccInputs: WaccInputs = {
      beta,
      rfr: input.risk_free_rate,
      erp: input.equity_risk_premium,
      deRatio,
      costOfDebt: input.cost_of_debt,
      taxRate: input.tax_rate,
    };

    const breakdown = computeWaccBreakdown(waccInputs);

    return formatToolResult(
      {
        ticker,
        sector,
        betaSource,
        ...breakdown,
        // Round for readability (keeps decimals, not percentages)
        beta: Math.round(breakdown.beta * 1000) / 1000,
        rfr: Math.round(breakdown.rfr * 10000) / 10000,
        erp: Math.round(breakdown.erp * 10000) / 10000,
        ke: Math.round(breakdown.ke * 10000) / 10000,
        deRatio: Math.round(breakdown.deRatio * 1000) / 1000,
        kdAfterTax: Math.round(breakdown.kdAfterTax * 10000) / 10000,
        equityWeight: Math.round(breakdown.equityWeight * 10000) / 10000,
        debtWeight: Math.round(breakdown.debtWeight * 10000) / 10000,
        wacc: Math.round(breakdown.wacc * 10000) / 10000,
        waccPct: `${(breakdown.wacc * 100).toFixed(2)}%`,
        note: `WACC = ${(breakdown.equityWeight * 100).toFixed(1)}% × ${(breakdown.ke * 100).toFixed(2)}% (Ke) + ${(breakdown.debtWeight * 100).toFixed(1)}% × ${(breakdown.kdAfterTax * 100).toFixed(2)}% (Kd after-tax)`,
      },
      sourceUrls,
    );
  },
});
