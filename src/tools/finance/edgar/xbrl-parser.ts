/**
 * XBRL data extraction from SEC EDGAR Company Facts API.
 *
 * Parses the /api/xbrl/companyfacts/CIK{cik}.json response to extract
 * financial facts by concept, with period filtering and fallback chains.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single XBRL data point from the Company Facts API */
interface XbrlUnit {
  start?: string;   // period start (absent for instant/point-in-time)
  end: string;      // period end (or instant date)
  val: number;
  accn: string;     // accession number
  fy: number;       // fiscal year
  fp: string;       // fiscal period: FY, Q1, Q2, Q3, Q4
  form: string;     // 10-K, 10-Q, etc.
  filed: string;    // filing date
  frame?: string;   // e.g. "CY2023Q4I" for instant, "CY2023Q4" for duration
}

/** The units object — usually keyed by "USD", "USD/shares", or "pure" */
type UnitsMap = Record<string, XbrlUnit[]>;

/** A single concept within a taxonomy */
interface ConceptData {
  label: string;
  description: string;
  units: UnitsMap;
}

/** Top-level Company Facts response shape */
export interface CompanyFacts {
  cik: number;
  entityName: string;
  facts: {
    'us-gaap'?: Record<string, ConceptData>;
    dei?: Record<string, ConceptData>;
    ifrs?: Record<string, ConceptData>;
    [taxonomy: string]: Record<string, ConceptData> | undefined;
  };
}

/** Extracted financial data point */
export interface FactValue {
  value: number;
  period: string;     // end date (YYYY-MM-DD)
  periodStart?: string;
  fiscalYear: number;
  fiscalPeriod: string;  // FY, Q1, Q2, Q3, Q4
  form: string;
  filed: string;
}

export type PeriodFilter = 'annual' | 'quarterly';

// ---------------------------------------------------------------------------
// Concept fallback chains
// ---------------------------------------------------------------------------

/** Common XBRL concept names with fallback alternatives */
export const CONCEPT_CHAINS: Record<string, string[]> = {
  // Income Statement
  revenue: [
    'Revenues',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'SalesRevenueNet',
    'SalesRevenueGoodsNet',
  ],
  costOfRevenue: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold'],
  grossProfit: ['GrossProfit'],
  operatingIncome: [
    'OperatingIncomeLoss',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
  ],
  netIncome: [
    'NetIncomeLoss',
    'NetIncomeLossAvailableToCommonStockholdersBasic',
    'ProfitLoss',
  ],
  epsBasic: ['EarningsPerShareBasic'],
  epsDiluted: ['EarningsPerShareDiluted'],
  researchAndDevelopment: [
    'ResearchAndDevelopmentExpense',
    'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost',
  ],
  sellingGeneralAdmin: [
    'SellingGeneralAndAdministrativeExpense',
    'GeneralAndAdministrativeExpense',
  ],
  operatingExpenses: ['OperatingExpenses', 'CostsAndExpenses'],

  // Balance Sheet
  totalAssets: ['Assets'],
  totalLiabilities: ['Liabilities'],
  stockholdersEquity: [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  ],
  cash: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsAndShortTermInvestments',
  ],
  currentAssets: ['AssetsCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
  longTermDebt: [
    'LongTermDebt',
    'LongTermDebtNoncurrent',
    'LongTermDebtAndCapitalLeaseObligations',
  ],
  totalDebt: [
    'LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities',
    'DebtAndCapitalLeaseObligations',
  ],
  shortTermDebt: [
    'ShortTermBorrowings',
    'DebtCurrent',
  ],

  // Cash Flow Statement
  operatingCashFlow: [
    'NetCashProvidedByUsedInOperatingActivities',
    'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ],
  investingCashFlow: [
    'NetCashProvidedByUsedInInvestingActivities',
    'NetCashProvidedByUsedInInvestingActivitiesContinuingOperations',
  ],
  financingCashFlow: [
    'NetCashProvidedByUsedInFinancingActivities',
    'NetCashProvidedByUsedInFinancingActivitiesContinuingOperations',
  ],
  capitalExpenditures: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PaymentsToAcquireProductiveAssets',
  ],
  depreciation: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAndAmortization',
    'Depreciation',
  ],

  // DEI (Document and Entity Information)
  sharesOutstanding: [
    'EntityCommonStockSharesOutstanding',
    'CommonStockSharesOutstanding',
  ],
};

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract facts for a concept name from company facts data.
 * Tries the us-gaap taxonomy first, then dei, then ifrs.
 */
function getConceptUnits(facts: CompanyFacts['facts'], conceptName: string): XbrlUnit[] {
  for (const taxonomy of ['us-gaap', 'dei', 'ifrs']) {
    const taxFacts = facts[taxonomy];
    if (taxFacts && taxFacts[conceptName]) {
      // Prefer USD, then USD/shares, then pure, then first available
      const units = taxFacts[conceptName].units;
      return units['USD'] ?? units['USD/shares'] ?? units['pure'] ?? Object.values(units)[0] ?? [];
    }
  }
  return [];
}

/**
 * Extract fact values for a concept, using a fallback chain of concept names.
 * Filters by period type (annual=10-K, quarterly=10-Q) and optional date range.
 */
export function extractFacts(
  companyFacts: CompanyFacts,
  conceptChain: string[],
  options?: {
    period?: PeriodFilter;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): FactValue[] {
  const { period, startDate, endDate, limit } = options ?? {};

  // Try each concept in the fallback chain
  for (const conceptName of conceptChain) {
    const units = getConceptUnits(companyFacts.facts, conceptName);
    if (units.length === 0) continue;

    // Filter by form type
    let filtered = units.filter((u) => {
      if (period === 'annual') return u.form === '10-K';
      if (period === 'quarterly') return u.form === '10-Q';
      return u.form === '10-K' || u.form === '10-Q';
    });

    // Filter by date range
    if (startDate) {
      filtered = filtered.filter((u) => u.end >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((u) => u.end <= endDate);
    }

    // Deduplicate by period end date (keep latest filing)
    const byPeriod = new Map<string, XbrlUnit>();
    for (const unit of filtered) {
      const key = `${unit.end}_${unit.fp}`;
      const existing = byPeriod.get(key);
      if (!existing || unit.filed > existing.filed) {
        byPeriod.set(key, unit);
      }
    }

    let results = Array.from(byPeriod.values())
      .sort((a, b) => b.end.localeCompare(a.end)); // newest first

    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }

    if (results.length > 0) {
      return results.map((u) => ({
        value: u.val,
        period: u.end,
        periodStart: u.start,
        fiscalYear: u.fy,
        fiscalPeriod: u.fp,
        form: u.form,
        filed: u.filed,
      }));
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Statement assembly
// ---------------------------------------------------------------------------

/** A row in an assembled financial statement */
export interface StatementRow {
  period: string;
  fiscalYear: number;
  fiscalPeriod: string;
  [metric: string]: string | number;
}

/**
 * Assemble multiple concepts into a unified statement table.
 * Each concept becomes a column, rows are periods.
 */
export function assembleStatement(
  companyFacts: CompanyFacts,
  conceptMap: Record<string, string[]>,
  options?: {
    period?: PeriodFilter;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): StatementRow[] {
  // Extract all concepts
  const extracted: Record<string, FactValue[]> = {};
  const allPeriods = new Set<string>();

  for (const [label, chain] of Object.entries(conceptMap)) {
    const facts = extractFacts(companyFacts, chain, options);
    extracted[label] = facts;
    for (const fact of facts) {
      allPeriods.add(`${fact.period}|${fact.fiscalYear}|${fact.fiscalPeriod}`);
    }
  }

  // Build rows sorted by period (newest first)
  const sortedPeriods = Array.from(allPeriods).sort().reverse();

  const limitCount = options?.limit ?? sortedPeriods.length;
  const limitedPeriods = sortedPeriods.slice(0, limitCount);

  return limitedPeriods.map((periodKey) => {
    const [period, fyStr, fiscalPeriod] = periodKey.split('|');
    const row: StatementRow = {
      period,
      fiscalYear: Number(fyStr),
      fiscalPeriod,
    };

    for (const [label, facts] of Object.entries(extracted)) {
      const match = facts.find(
        (f) => f.period === period && f.fiscalPeriod === fiscalPeriod
      );
      row[label] = match?.value ?? null as unknown as number;
    }

    return row;
  });
}

/**
 * Compute TTM (trailing twelve months) by summing the most recent 4 quarterly values.
 * For balance sheet items (point-in-time), returns the latest quarter value.
 */
export function computeTtm(
  companyFacts: CompanyFacts,
  conceptChain: string[],
  isBalanceSheet = false
): number | null {
  const quarterlyFacts = extractFacts(companyFacts, conceptChain, {
    period: 'quarterly',
    limit: 4,
  });

  if (quarterlyFacts.length === 0) return null;

  if (isBalanceSheet) {
    return quarterlyFacts[0].value;
  }

  if (quarterlyFacts.length < 4) return null;
  return quarterlyFacts.reduce((sum, f) => sum + f.value, 0);
}
