import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

export const FIXED_INCOME_DESCRIPTION = `
Fetches US fixed income data: Treasury yields (2Y, 5Y, 10Y, 30Y), Fed funds rate, yield curve spread, CPI, and unemployment rate from the FRED API (Federal Reserve). Use for interest rate risk analysis, recession signals (yield curve inversion), and macro context when evaluating bonds, REITs, utilities, or any rate-sensitive asset.

## When to Use
- User asks about interest rates, bond yields, or yield curve
- Analyzing rate-sensitive sectors (REITs, utilities, financials, mortgages)
- Recession probability assessment (yield curve inversion)
- Macro backdrop for any equity analysis

## Example Queries
- "What is the current yield curve?"
- "Are interest rates going up?"
- "Is the yield curve inverted?"
- "What's the 10-year Treasury yield?"
`.trim();

const FRED_BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv';

const SERIES_MAP: Record<string, string> = {
  DGS2: '2Y',
  DGS5: '5Y',
  DGS10: '10Y',
  DGS30: '30Y',
  FEDFUNDS: 'fed_funds',
  CPIAUCSL: 'cpi',
  UNRATE: 'unemployment',
};

/** Fetch a single FRED series CSV and return the latest non-empty value. */
async function fetchFredSeries(seriesId: string): Promise<number | null> {
  const today = new Date().toISOString().slice(0, 10);
  const url = `${FRED_BASE}?id=${seriesId}&vintage_date=${today}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`FRED ${seriesId} HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  // CSV has header row: "DATE,VALUE"
  for (let i = lines.length - 1; i >= 1; i--) {
    const parts = lines[i].split(',');
    const val = parts[1]?.trim();
    if (val && val !== '.' && val !== '') {
      const num = parseFloat(val);
      if (!isNaN(num)) return num;
    }
  }
  return null;
}

const FixedIncomeInputSchema = z.object({
  series: z
    .array(z.enum(['treasury_yields', 'fed_funds', 'yield_curve', 'cpi', 'unemployment']))
    .default(['treasury_yields', 'yield_curve'])
    .describe('Which fixed income data series to fetch'),
});

export const getFixedIncomeTool = new DynamicStructuredTool({
  name: 'get_fixed_income',
  description: FIXED_INCOME_DESCRIPTION,
  schema: FixedIncomeInputSchema,
  func: async (input) => {
    const requested = new Set(input.series);
    const needsTreasuries =
      requested.has('treasury_yields') || requested.has('yield_curve');

    const fetchSafe = async (id: string): Promise<number | null> => {
      try {
        return await fetchFredSeries(id);
      } catch {
        return null;
      }
    };

    const result: Record<string, unknown> = {};

    if (needsTreasuries) {
      const [y2, y5, y10, y30] = await Promise.all([
        fetchSafe('DGS2'),
        fetchSafe('DGS5'),
        fetchSafe('DGS10'),
        fetchSafe('DGS30'),
      ]);

      if (requested.has('treasury_yields')) {
        result.treasury_yields = { '2Y': y2, '5Y': y5, '10Y': y10, '30Y': y30 };
      }

      if (requested.has('yield_curve')) {
        const spread = y10 !== null && y2 !== null ? parseFloat((y10 - y2).toFixed(4)) : null;
        result.yield_curve = {
          spread_10y_2y: spread,
          inverted: spread !== null ? spread < 0 : false,
        };
      }
    }

    if (requested.has('fed_funds')) {
      const rate = await fetchSafe('FEDFUNDS');
      result.fed_funds = { rate };
    }

    if (requested.has('cpi')) {
      const value = await fetchSafe('CPIAUCSL');
      result.cpi = { value };
    }

    if (requested.has('unemployment')) {
      const rate = await fetchSafe('UNRATE');
      result.unemployment = { rate };
    }

    result.as_of = new Date().toISOString().slice(0, 10);

    return formatToolResult(result, [`${FRED_BASE}?id=DGS10`]);
  },
});
