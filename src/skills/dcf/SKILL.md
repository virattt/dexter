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

**For India valuations, use these defaults instead of US-centric assumptions:**

### India-Specific Valuation Assumptions

**Risk-Free Rate:**
- Use the CURRENT 10-year Indian Government Bond (G-Sec) yield
- Source: rbi.org.in (RBI website) — ALWAYS retrieve this live
- NEVER use a memorised rate from training data

**Equity Risk Premium (ERP):**
- India ERP: 6.5–8.0%
- Preferred source: Damodaran's annual country ERP table (pages.stern.nyu.edu)
- If Damodaran not available, use 7.0% as conservative default
- State source explicitly in every valuation

**WACC:**
- Cost of equity = Risk-free rate + Beta × India ERP
- Cost of debt: use current Indian corporate bond yield for equivalent rating
  - AAA-rated: ~7.5–8.5%
  - AA-rated: ~8.5–9.5%
  - Retrieve live if possible; state source and date
- Tax shield for WACC: 25.17% (Section 115BAA flat rate)
  OR 22% base rate (confirm from company's latest Annual Report)

**Terminal Growth Rate:**
- Default: India's nominal GDP growth = real GDP (~6.5%) + CPI (~4.5%) = ~7–8%
- For mature / global companies operating in India: 5–6%
- For high-growth consumer/tech companies: consult concall guidance + analyst consensus
- NEVER use US/Western terminal growth rates (2–3%) for Indian companies

**Working Capital:**
- All cash flow projections in INR
- Compare working capital cycle to Indian sector peers (not global benchmarks)
- Flag if DSO/DIO/DPO is unusually long vs NSE-listed sector comps

**Discount Rate Sanity Check:**
- Typical WACC range for Indian large-caps: 10–14%
- If your WACC is below 9% or above 18%, re-verify inputs — likely an error

**Reasonableness check:** WACC should be 2-4% below `return_on_invested_capital` for value-creating companies.

**Sector adjustments:** Apply adjustment factors from [sector-wacc.md](sector-wacc.md) based on company-specific characteristics.

## Step 4: Project Future Cash Flows

**Years 1-5:** Apply growth rate with 5% annual decay (multiply growth rate by 0.95, 0.90, 0.85, 0.80 for years 2-5). This reflects competitive dynamics.

**Terminal value:** Use Gordon Growth Model with India-appropriate terminal growth:
- Default 7% for India (nominal GDP growth)
- Mature/legacy businesses: 5%
- High-growth consumer/tech: use concall guidance + analyst consensus
- NEVER use 2.5% (this is a US/Western assumption)

## Step 5: Calculate Present Value

Discount all FCFs → sum for Enterprise Value → subtract Net Debt → divide by `outstanding_shares` for fair value per share.

## Step 6: Sensitivity Analysis

Create 3×3 matrix: WACC (base ±1%) vs terminal growth (5%, 7%, 9% for India).

## Step 7: Validate Results

Before presenting, verify these sanity checks:

1. **EV comparison**: Calculated EV should be within 30% of reported `enterprise_value`
   - If off by >30%, revisit WACC or growth assumptions

2. **Terminal value ratio**: Terminal value should be 50-80% of total EV for mature companies
   - If >90%, growth rate may be too high
   - If <40%, near-term projections may be aggressive

3. **Per-share cross-check**: Compare to `free_cash_flow_per_share × 15-25` as rough sanity check

If validation fails, reconsider assumptions before presenting results.

## Step 8: Output Format

Present a structured summary including:
1. **Valuation Summary**: Current price vs. fair value, upside/downside percentage
2. **Key Inputs Table**: All assumptions with their sources
3. **Projected FCF Table**: 5-year projections with present values
4. **Sensitivity Matrix**: 3×3 grid varying WACC (±1%) and terminal growth (2.0%, 2.5%, 3.0%)
5. **Caveats**: Standard DCF limitations plus company-specific risks
