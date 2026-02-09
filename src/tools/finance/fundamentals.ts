import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import {
  edgarFetch,
  resolveCik,
  companyFactsUrl,
  assembleStatement,
  computeTtm,
  CONCEPT_CHAINS,
  type CompanyFacts,
  type PeriodFilter,
} from './edgar/index.js';

// ---------------------------------------------------------------------------
// Shared schema & helpers
// ---------------------------------------------------------------------------

const FinancialStatementsInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch financial statements for. For example, 'AAPL' for Apple."
    ),
  period: z
    .enum(['annual', 'quarterly', 'ttm'])
    .describe(
      "The reporting period for the financial statements. 'annual' for yearly, 'quarterly' for quarterly, and 'ttm' for trailing twelve months."
    ),
  limit: z
    .number()
    .default(10)
    .describe(
      'Maximum number of report periods to return (default: 10). Returns the most recent N periods based on the period type.'
    ),
  report_period_gt: z
    .string()
    .optional()
    .describe('Filter for financial statements with report periods after this date (YYYY-MM-DD).'),
  report_period_gte: z
    .string()
    .optional()
    .describe(
      'Filter for financial statements with report periods on or after this date (YYYY-MM-DD).'
    ),
  report_period_lt: z
    .string()
    .optional()
    .describe('Filter for financial statements with report periods before this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe(
      'Filter for financial statements with report periods on or before this date (YYYY-MM-DD).'
    ),
});

type StatementsInput = z.infer<typeof FinancialStatementsInputSchema>;

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

/** Convert input date filters to startDate/endDate for XBRL parser */
function dateFilters(input: StatementsInput): { startDate?: string; endDate?: string } {
  // Use the most restrictive filter provided
  const startDate = input.report_period_gt
    ? input.report_period_gt
    : input.report_period_gte;
  const endDate = input.report_period_lt
    ? input.report_period_lt
    : input.report_period_lte;
  return { startDate, endDate };
}

// ---------------------------------------------------------------------------
// Income Statement concepts
// ---------------------------------------------------------------------------

const INCOME_STATEMENT_CONCEPTS: Record<string, string[]> = {
  revenue: CONCEPT_CHAINS.revenue,
  costOfRevenue: CONCEPT_CHAINS.costOfRevenue,
  grossProfit: CONCEPT_CHAINS.grossProfit,
  researchAndDevelopment: CONCEPT_CHAINS.researchAndDevelopment,
  sellingGeneralAdmin: CONCEPT_CHAINS.sellingGeneralAdmin,
  operatingExpenses: CONCEPT_CHAINS.operatingExpenses,
  operatingIncome: CONCEPT_CHAINS.operatingIncome,
  netIncome: CONCEPT_CHAINS.netIncome,
  epsBasic: CONCEPT_CHAINS.epsBasic,
  epsDiluted: CONCEPT_CHAINS.epsDiluted,
};

// ---------------------------------------------------------------------------
// Balance Sheet concepts
// ---------------------------------------------------------------------------

const BALANCE_SHEET_CONCEPTS: Record<string, string[]> = {
  totalAssets: CONCEPT_CHAINS.totalAssets,
  currentAssets: CONCEPT_CHAINS.currentAssets,
  cash: CONCEPT_CHAINS.cash,
  totalLiabilities: CONCEPT_CHAINS.totalLiabilities,
  currentLiabilities: CONCEPT_CHAINS.currentLiabilities,
  longTermDebt: CONCEPT_CHAINS.longTermDebt,
  stockholdersEquity: CONCEPT_CHAINS.stockholdersEquity,
};

// ---------------------------------------------------------------------------
// Cash Flow concepts
// ---------------------------------------------------------------------------

const CASH_FLOW_CONCEPTS: Record<string, string[]> = {
  operatingCashFlow: CONCEPT_CHAINS.operatingCashFlow,
  investingCashFlow: CONCEPT_CHAINS.investingCashFlow,
  financingCashFlow: CONCEPT_CHAINS.financingCashFlow,
  capitalExpenditures: CONCEPT_CHAINS.capitalExpenditures,
  depreciation: CONCEPT_CHAINS.depreciation,
};

// ---------------------------------------------------------------------------
// TTM builder
// ---------------------------------------------------------------------------

function buildTtm(
  facts: CompanyFacts,
  concepts: Record<string, string[]>,
  isBalanceSheet: boolean
): Record<string, unknown> {
  const ttmRow: Record<string, unknown> = { period: 'TTM' };
  for (const [label, chain] of Object.entries(concepts)) {
    ttmRow[label] = computeTtm(facts, chain, isBalanceSheet);
  }
  return ttmRow;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const getIncomeStatements = new DynamicStructuredTool({
  name: 'get_income_statements',
  description: `Fetches a company's income statements from SEC EDGAR XBRL data, detailing revenues, expenses, net income, and EPS over a reporting period. Useful for evaluating profitability and operational efficiency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { facts, url } = await fetchCompanyFacts(input.ticker);
    const { startDate, endDate } = dateFilters(input);

    if (input.period === 'ttm') {
      const ttmData = buildTtm(facts, INCOME_STATEMENT_CONCEPTS, false);
      return formatToolResult([ttmData], [url]);
    }

    const rows = assembleStatement(facts, INCOME_STATEMENT_CONCEPTS, {
      period: input.period as PeriodFilter,
      startDate,
      endDate,
      limit: input.limit,
    });
    return formatToolResult(rows, [url]);
  },
});

export const getBalanceSheets = new DynamicStructuredTool({
  name: 'get_balance_sheets',
  description: `Retrieves a company's balance sheets from SEC EDGAR XBRL data, providing a snapshot of assets, liabilities, and shareholders' equity. Useful for assessing financial position.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { facts, url } = await fetchCompanyFacts(input.ticker);
    const { startDate, endDate } = dateFilters(input);

    if (input.period === 'ttm') {
      const ttmData = buildTtm(facts, BALANCE_SHEET_CONCEPTS, true);
      return formatToolResult([ttmData], [url]);
    }

    const rows = assembleStatement(facts, BALANCE_SHEET_CONCEPTS, {
      period: input.period as PeriodFilter,
      startDate,
      endDate,
      limit: input.limit,
    });
    return formatToolResult(rows, [url]);
  },
});

export const getCashFlowStatements = new DynamicStructuredTool({
  name: 'get_cash_flow_statements',
  description: `Retrieves a company's cash flow statements from SEC EDGAR XBRL data, showing operating, investing, and financing cash flows. Useful for understanding liquidity and solvency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { facts, url } = await fetchCompanyFacts(input.ticker);
    const { startDate, endDate } = dateFilters(input);

    if (input.period === 'ttm') {
      const ttmData = buildTtm(facts, CASH_FLOW_CONCEPTS, false);
      return formatToolResult([ttmData], [url]);
    }

    const rows = assembleStatement(facts, CASH_FLOW_CONCEPTS, {
      period: input.period as PeriodFilter,
      startDate,
      endDate,
      limit: input.limit,
    });
    return formatToolResult(rows, [url]);
  },
});

export const getAllFinancialStatements = new DynamicStructuredTool({
  name: 'get_all_financial_statements',
  description: `Retrieves all three financial statements (income, balance sheet, cash flow) from SEC EDGAR XBRL data in a single call. More efficient than calling each separately.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    const { facts, url } = await fetchCompanyFacts(input.ticker);
    const { startDate, endDate } = dateFilters(input);
    const assemblyOptions = {
      period: input.period === 'ttm' ? undefined : (input.period as PeriodFilter),
      startDate,
      endDate,
      limit: input.limit,
    };

    if (input.period === 'ttm') {
      return formatToolResult(
        {
          income_statement: [buildTtm(facts, INCOME_STATEMENT_CONCEPTS, false)],
          balance_sheet: [buildTtm(facts, BALANCE_SHEET_CONCEPTS, true)],
          cash_flow_statement: [buildTtm(facts, CASH_FLOW_CONCEPTS, false)],
        },
        [url]
      );
    }

    return formatToolResult(
      {
        income_statement: assembleStatement(facts, INCOME_STATEMENT_CONCEPTS, assemblyOptions),
        balance_sheet: assembleStatement(facts, BALANCE_SHEET_CONCEPTS, assemblyOptions),
        cash_flow_statement: assembleStatement(facts, CASH_FLOW_CONCEPTS, assemblyOptions),
      },
      [url]
    );
  },
});
