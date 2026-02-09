import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import {
  edgarFetch,
  resolveCik,
  companyFactsUrl,
  extractFacts,
  computeTtm,
  CONCEPT_CHAINS,
  type CompanyFacts,
  type PeriodFilter,
} from './edgar/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch and cache company facts from EDGAR */
async function fetchCompanyFacts(ticker: string): Promise<{ facts: CompanyFacts; url: string }> {
  const { cik } = await resolveCik(ticker);
  const factsUrl = companyFactsUrl(cik);
  const { data, url } = await edgarFetch(factsUrl, {
    cacheable: true,
    cacheKey: `edgar/companyfacts/${ticker.toUpperCase()}`,
    cacheParams: { ticker: ticker.toUpperCase() },
  });
  return { facts: data as unknown as CompanyFacts, url };
}

/** Safe division — returns null if divisor is 0 or null */
function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/** Fetch current stock quote from Yahoo Finance (yahoo-finance2) */
async function fetchYahooQuote(ticker: string): Promise<{
  price: number | null;
  marketCap: number | null;
}> {
  try {
    const quote = await yahooFinance.quote(ticker) as Record<string, unknown>;
    return {
      price: (quote.regularMarketPrice as number) ?? null,
      marketCap: (quote.marketCap as number) ?? null,
    };
  } catch {
    return { price: null, marketCap: null };
  }
}

// ---------------------------------------------------------------------------
// Ratio computation
// ---------------------------------------------------------------------------

interface ComputedRatios {
  // Profitability
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  // Liquidity
  currentRatio: number | null;
  // Leverage
  debtToEquity: number | null;
  // Per share
  epsBasic: number | null;
  epsDiluted: number | null;
  // Market-based (require Yahoo price data)
  priceToEarnings: number | null;
  marketCap: number | null;
  priceNote?: string;
}

function computeRatiosFromFacts(
  facts: CompanyFacts,
  period: PeriodFilter | undefined,
  limit: number
): ComputedRatios[] {
  // Get needed metrics
  const revenues = extractFacts(facts, CONCEPT_CHAINS.revenue, { period, limit });
  const grossProfits = extractFacts(facts, CONCEPT_CHAINS.grossProfit, { period, limit });
  const operatingIncomes = extractFacts(facts, CONCEPT_CHAINS.operatingIncome, { period, limit });
  const netIncomes = extractFacts(facts, CONCEPT_CHAINS.netIncome, { period, limit });
  const totalAssets = extractFacts(facts, CONCEPT_CHAINS.totalAssets, { period, limit });
  const totalEquity = extractFacts(facts, CONCEPT_CHAINS.stockholdersEquity, { period, limit });
  const currentAssetsFacts = extractFacts(facts, CONCEPT_CHAINS.currentAssets, { period, limit });
  const currentLiabilitiesFacts = extractFacts(facts, CONCEPT_CHAINS.currentLiabilities, { period, limit });
  const longTermDebtFacts = extractFacts(facts, CONCEPT_CHAINS.longTermDebt, { period, limit });
  const epsBasicFacts = extractFacts(facts, CONCEPT_CHAINS.epsBasic, { period, limit });
  const epsDilutedFacts = extractFacts(facts, CONCEPT_CHAINS.epsDiluted, { period, limit });

  // Build ratios per period using revenue periods as anchor
  return revenues.map((rev, index) => {
    const grossProfit = grossProfits[index]?.value ?? null;
    const operatingIncome = operatingIncomes[index]?.value ?? null;
    const netIncome = netIncomes[index]?.value ?? null;
    const assets = totalAssets[index]?.value ?? null;
    const equity = totalEquity[index]?.value ?? null;
    const curAssets = currentAssetsFacts[index]?.value ?? null;
    const curLiabilities = currentLiabilitiesFacts[index]?.value ?? null;
    const debt = longTermDebtFacts[index]?.value ?? null;

    return {
      period: rev.period,
      fiscalYear: rev.fiscalYear,
      fiscalPeriod: rev.fiscalPeriod,
      grossMargin: safeDivide(grossProfit, rev.value),
      operatingMargin: safeDivide(operatingIncome, rev.value),
      netMargin: safeDivide(netIncome, rev.value),
      returnOnEquity: safeDivide(netIncome, equity),
      returnOnAssets: safeDivide(netIncome, assets),
      currentRatio: safeDivide(curAssets, curLiabilities),
      debtToEquity: safeDivide(debt, equity),
      epsBasic: epsBasicFacts[index]?.value ?? null,
      epsDiluted: epsDilutedFacts[index]?.value ?? null,
      priceToEarnings: null,
      marketCap: null,
      priceNote: 'P/E and market cap require real-time price data from Yahoo Finance (available via get_key_ratios_snapshot)',
    } as ComputedRatios & { period: string; fiscalYear: number; fiscalPeriod: string };
  });
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const KeyRatiosSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch key ratios snapshot for. For example, 'AAPL' for Apple."
    ),
});

export const getKeyRatiosSnapshot = new DynamicStructuredTool({
  name: 'get_key_ratios_snapshot',
  description: `Fetches a snapshot of the most current key ratios for a company, computed from SEC EDGAR XBRL data and Yahoo Finance. Includes margins, ROE, ROA, current ratio, debt-to-equity, EPS, and market-based metrics (P/E, market cap) when price data is available.`,
  schema: KeyRatiosSnapshotInputSchema,
  func: async (input) => {
    const [{ facts, url }, yahooData] = await Promise.all([
      fetchCompanyFacts(input.ticker),
      fetchYahooQuote(input.ticker),
    ]);

    // Compute TTM ratios
    const ttmRevenue = computeTtm(facts, CONCEPT_CHAINS.revenue);
    const ttmGrossProfit = computeTtm(facts, CONCEPT_CHAINS.grossProfit);
    const ttmOperatingIncome = computeTtm(facts, CONCEPT_CHAINS.operatingIncome);
    const ttmNetIncome = computeTtm(facts, CONCEPT_CHAINS.netIncome);
    const latestAssets = computeTtm(facts, CONCEPT_CHAINS.totalAssets, true);
    const latestEquity = computeTtm(facts, CONCEPT_CHAINS.stockholdersEquity, true);
    const latestCurrentAssets = computeTtm(facts, CONCEPT_CHAINS.currentAssets, true);
    const latestCurrentLiabilities = computeTtm(facts, CONCEPT_CHAINS.currentLiabilities, true);
    const latestDebt = computeTtm(facts, CONCEPT_CHAINS.longTermDebt, true);
    const ttmEpsBasic = computeTtm(facts, CONCEPT_CHAINS.epsBasic);
    const ttmEpsDiluted = computeTtm(facts, CONCEPT_CHAINS.epsDiluted);

    const snapshot: Record<string, unknown> = {
      ticker: input.ticker.toUpperCase(),
      period: 'TTM',
      grossMargin: safeDivide(ttmGrossProfit, ttmRevenue),
      operatingMargin: safeDivide(ttmOperatingIncome, ttmRevenue),
      netMargin: safeDivide(ttmNetIncome, ttmRevenue),
      returnOnEquity: safeDivide(ttmNetIncome, latestEquity),
      returnOnAssets: safeDivide(ttmNetIncome, latestAssets),
      currentRatio: safeDivide(latestCurrentAssets, latestCurrentLiabilities),
      debtToEquity: safeDivide(latestDebt, latestEquity),
      epsBasic: ttmEpsBasic,
      epsDiluted: ttmEpsDiluted,
      // Market-based metrics from Yahoo Finance
      price: yahooData.price,
      marketCap: yahooData.marketCap,
      priceToEarnings: safeDivide(yahooData.price, ttmEpsDiluted),
    };

    const sourceUrls = [url];

    return formatToolResult(snapshot, sourceUrls);
  },
});

const KeyRatiosInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch key ratios for. For example, 'AAPL' for Apple."
    ),
  period: z
    .enum(['annual', 'quarterly', 'ttm'])
    .default('ttm')
    .describe(
      "The reporting period. 'annual' for yearly, 'quarterly' for quarterly, and 'ttm' for trailing twelve months."
    ),
  limit: z
    .number()
    .default(4)
    .describe('The number of past periods to retrieve.'),
  report_period: z
    .string()
    .optional()
    .describe('Filter for key ratios with an exact report period date (YYYY-MM-DD).'),
  report_period_gt: z
    .string()
    .optional()
    .describe('Filter for key ratios with report periods after this date (YYYY-MM-DD).'),
  report_period_gte: z
    .string()
    .optional()
    .describe(
      'Filter for key ratios with report periods on or after this date (YYYY-MM-DD).'
    ),
  report_period_lt: z
    .string()
    .optional()
    .describe('Filter for key ratios with report periods before this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe(
      'Filter for key ratios with report periods on or before this date (YYYY-MM-DD).'
    ),
});

export const getKeyRatios = new DynamicStructuredTool({
  name: 'get_key_ratios',
  description: `Retrieves historical key ratios for a company, computed from SEC EDGAR XBRL data. Includes profitability margins, ROE, ROA, current ratio, debt-to-equity, and EPS. Note: historical P/E and market cap are not available (require historical price data).`,
  schema: KeyRatiosInputSchema,
  func: async (input) => {
    const { facts, url } = await fetchCompanyFacts(input.ticker);

    if (input.period === 'ttm') {
      // For TTM, delegate to snapshot logic minus Yahoo
      const ttmRevenue = computeTtm(facts, CONCEPT_CHAINS.revenue);
      const ttmGrossProfit = computeTtm(facts, CONCEPT_CHAINS.grossProfit);
      const ttmOperatingIncome = computeTtm(facts, CONCEPT_CHAINS.operatingIncome);
      const ttmNetIncome = computeTtm(facts, CONCEPT_CHAINS.netIncome);
      const latestAssets = computeTtm(facts, CONCEPT_CHAINS.totalAssets, true);
      const latestEquity = computeTtm(facts, CONCEPT_CHAINS.stockholdersEquity, true);
      const latestCurrentAssets = computeTtm(facts, CONCEPT_CHAINS.currentAssets, true);
      const latestCurrentLiabilities = computeTtm(facts, CONCEPT_CHAINS.currentLiabilities, true);
      const latestDebt = computeTtm(facts, CONCEPT_CHAINS.longTermDebt, true);
      const ttmEps = computeTtm(facts, CONCEPT_CHAINS.epsDiluted);

      return formatToolResult(
        [
          {
            period: 'TTM',
            grossMargin: safeDivide(ttmGrossProfit, ttmRevenue),
            operatingMargin: safeDivide(ttmOperatingIncome, ttmRevenue),
            netMargin: safeDivide(ttmNetIncome, ttmRevenue),
            returnOnEquity: safeDivide(ttmNetIncome, latestEquity),
            returnOnAssets: safeDivide(ttmNetIncome, latestAssets),
            currentRatio: safeDivide(latestCurrentAssets, latestCurrentLiabilities),
            debtToEquity: safeDivide(latestDebt, latestEquity),
            epsDiluted: ttmEps,
          },
        ],
        [url]
      );
    }

    const periodFilter = input.period as PeriodFilter;
    const ratios = computeRatiosFromFacts(facts, periodFilter, input.limit);
    return formatToolResult(ratios, [url]);
  },
});
