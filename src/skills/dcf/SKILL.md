---
name: dcf-valuation
description: Performs discounted cash flow (DCF) valuation analysis to estimate intrinsic value per share. Triggers when user asks for fair value, intrinsic value, DCF, valuation, "what is X worth", price target, undervalued/overvalued analysis, or wants to compare current price to fundamental value.
---

# DCF Valuation Skill

## Workflow Checklist

Copy and track progress:
```
DCF Analysis Progress:
- [ ] Step 1: Gather financial data
- [ ] Step 2: Calculate FCF growth rate
- [ ] Step 3: Estimate discount rate (WACC)
- [ ] Step 4: Project future cash flows (Years 1-5 + Terminal)
- [ ] Step 5: Calculate present value and fair value per share
- [ ] Step 6: Run sensitivity analysis
- [ ] Step 7: Validate results
- [ ] Step 8: Present results with caveats
```

## Step 1: Gather Financial Data

Call the `get_financials` tool with these queries:

### 1.1 Cash Flow History
**Query:** `"[TICKER] annual cash flow statements for the last 5 years"`

**Extract:** `free_cash_flow`, `net_cash_flow_from_operations`, `capital_expenditure`

**Fallback:** If `free_cash_flow` missing, calculate: `net_cash_flow_from_operations - capital_expenditure`

### 1.2 Financial Metrics
**Query:** `"[TICKER] financial metrics snapshot"`

**Extract:** `market_cap`, `enterprise_value`, `free_cash_flow_growth`, `revenue_growth`, `return_on_invested_capital`, `debt_to_equity`, `free_cash_flow_per_share`

### 1.3 Balance Sheet
**Query:** `"[TICKER] latest balance sheet"`

**Extract:** `total_debt`, `cash_and_equivalents`, `current_investments`, `outstanding_shares`

**Fallback:** If `current_investments` missing, use 0

### 1.4 Analyst Estimates
**Query:** `"[TICKER] analyst estimates"`

**Extract:** `earnings_per_share` (forward estimates by fiscal year)

**Use:** Calculate implied EPS growth rate for cross-validation

### 1.5 Current Price
Call the `get_market_data` tool:

**Query:** `"[TICKER] price snapshot"`

**Extract:** `price`

### 1.6 Company Facts
Call the `get_financials` tool:

**Query:** `"[TICKER] company facts"`

**Extract:** `sector`, `industry`, `market_cap`

**Use:** Determine appropriate WACC range from [sector-wacc.md](sector-wacc.md)

## Step 2: Calculate FCF Growth Rate

Calculate 5-year FCF CAGR from cash flow history.

**Cross-validate with:** `free_cash_flow_growth` (YoY), `revenue_growth`, analyst EPS growth

**Growth rate selection:**
- Stable FCF history → Use CAGR with 10-20% haircut
- Volatile FCF → Weight analyst estimates more heavily
- **Cap at 15%** (sustained higher growth is rare)

## Step 3: Estimate Discount Rate (WACC)

**Use the `sector` from company facts** to select the appropriate base WACC range from [sector-wacc.md](sector-wacc.md).

**Default assumptions:**
- Risk-free rate: 4%
- Equity risk premium: 5-6%
- Cost of debt: 5-6% pre-tax (~4% after-tax at 30% tax rate)

Calculate WACC using `debt_to_equity` for capital structure weights.

**Reasonableness check:** WACC should be 2-4% below `return_on_invested_capital` for value-creating companies.

**Sector adjustments:** Apply adjustment factors from [sector-wacc.md](sector-wacc.md) based on company-specific characteristics.

## Step 4: Project Future Cash Flows

**Years 1-5:** Apply growth rate with 5% annual decay (multiply growth rate by 0.95, 0.90, 0.85, 0.80 for years 2-5). This reflects competitive dynamics.

**Terminal value:** Use Gordon Growth Model with 2.5% terminal growth (GDP proxy).

## Step 5: Calculate Present Value

Call the `dcf_calculator` tool for all DCF arithmetic.

**Do not calculate terminal value, enterprise value, equity value, value per share, or sensitivity tables manually.**

Pass:
- `baseFcf`: normalized current FCF or owner earnings
- `growthRates`: year-by-year growth assumptions as decimals
- `discountRate`: WACC / required return as a decimal
- `terminalGrowthRate`: terminal growth as a decimal
- `netDebt`: debt minus cash/investments; use a negative number for net cash
- `sharesOutstanding`: share count in the same scale as monetary values
- `units`: `billions`, `millions`, or `raw`

Use the calculator output as the source of truth for:
- projected FCFs
- PV of projected FCFs
- terminal value and PV of terminal value
- enterprise value
- equity value
- value per share

## Step 6: Sensitivity Analysis

Use the `dcf_calculator` sensitivity output. For U.S. companies, use WACC (base ±1%) vs terminal growth (2.0%, 2.5%, 3.0%) unless better case-specific assumptions are justified.

## Step 7: Validate Results

Before presenting, verify these sanity checks:

1. **EV comparison**: Calculated EV should be within 30% of reported `enterprise_value`
   - If off by >30%, revisit WACC or growth assumptions

2. **Terminal value ratio**: Terminal value should be 50-80% of total EV for mature companies
   - If >90%, growth rate may be too high
   - If <40%, near-term projections may be aggressive

3. **Per-share cross-check**: Compare to `free_cash_flow_per_share × 15-25` as rough sanity check

4. **Calculator reconciliation**: Final valuation tables must reconcile to the `dcf_calculator` output. If a manually drafted number differs from the calculator output, use the calculator output or rerun the tool with corrected inputs.

If validation fails, reconsider assumptions before presenting results.

## Step 8: Output Format

Present a structured summary including:
1. **Valuation Summary**: Current price vs. fair value, upside/downside percentage
2. **Key Inputs Table**: All assumptions with their sources
3. **Projected FCF Table**: 5-year projections with present values
4. **Sensitivity Matrix**: 3×3 grid varying WACC (±1%) and terminal growth (2.0%, 2.5%, 3.0%)
5. **Caveats**: Standard DCF limitations plus company-specific risks
