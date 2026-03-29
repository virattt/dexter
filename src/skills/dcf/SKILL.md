---
name: dcf-valuation
description: Performs discounted cash flow (DCF) valuation analysis to estimate intrinsic value per share. Triggers when user asks for fair value, intrinsic value, DCF, valuation, "what is X worth", price target, undervalued/overvalued analysis, or wants to compare current price to fundamental value.
parameters:
  wacc:
    type: number
    description: "Weighted Average Cost of Capital override (e.g. 0.10 for 10%)"
    default: 0.10
    min: 0.03
    max: 0.30
  growth_rate:
    type: number
    description: "Near-term revenue growth rate assumption (e.g. 0.15 for 15%)"
    default: 0.15
    min: -0.20
    max: 2.00
  terminal_growth_rate:
    type: number
    description: "Long-term terminal growth rate (e.g. 0.025 for 2.5%)"
    default: 0.025
    min: 0.00
    max: 0.10
  years:
    type: number
    description: "DCF projection horizon in years"
    default: 5
    min: 1
    max: 20
---

# DCF Valuation Skill

## Workflow Checklist

Copy and track progress:
```
DCF Analysis Progress:
- [ ] Step 1: Gather financial data
- [ ] Step 2: Calculate FCF growth rate
- [ ] Step 3: Estimate discount rate — call `wacc_inputs` tool (CAPM-based WACC)
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

### 1.7 Effective Tax Rate
Call the `get_financials` tool:

**Query:** `"[TICKER] effective tax rate income tax expense"`

**Extract:** `effective_tax_rate` or `income_tax_rate` (as a decimal, e.g. 0.21 = 21%)

**Fallback sector medians (use when unavailable):**

| Sector | Median Effective Rate |
|--------|-----------------------|
| Technology / Software | 18–22% |
| Healthcare | 20–23% |
| Industrials / Materials | 22–25% |
| Energy | 20–25% |
| Financials | 20–24% |
| Consumer Staples | 22–25% |
| Utilities | 24–26% |

**Default if still unavailable:** 21% (US statutory rate). **Do NOT use 30% — it overstates the tax shield and understates WACC.**

**Use in Step 3:** After-tax cost of debt = Pre-tax rate × (1 − effective_tax_rate)

## Step 2: Calculate FCF Growth Rate

Calculate {{years}}-year FCF CAGR from cash flow history.

**Cross-validate with:** `free_cash_flow_growth` (YoY), `revenue_growth`, analyst EPS growth

**Growth rate selection:**
- Stable FCF history → Use CAGR with 10-20% haircut
- Volatile FCF → Weight analyst estimates more heavily
- **Cap at 15%** (sustained higher growth is rare)
- **Active assumption:** growth_rate = {{growth_rate}}

### FCF Consistency Check

Before using FCF figures, validate the data:

1. **Manual calculation:** `FCF_manual = operating_cash_flow − capital_expenditure`
2. **Compare to reported:** `free_cash_flow` field from API
3. If they differ by **>10%**, use the manual calculation and note the discrepancy in caveats
4. **Stock-based compensation (SBC):** For software/tech companies, check if SBC is already excluded from FCF. If a company strips SBC out, add it back for apples-to-apples peer comparison
5. **One-time items:** Check if large one-off items (asset sales, litigation settlements) inflate/deflate OCF — exclude them from the base FCF for projection purposes

## Step 3: Estimate Discount Rate (WACC) via CAPM

**Always use the `wacc_inputs` tool — do not estimate WACC from the sector table.**

```
wacc_inputs({
  ticker: "[TICKER]",
  cost_of_debt: [pre-tax interest rate from Step 1.3, default 0.055],
  tax_rate: [effective tax rate from Step 1.7, default 0.21],
  risk_free_rate: [10Y Treasury yield; default 0.043 if not yet fetched],
  equity_risk_premium: 0.055
})
```

The tool:
1. Fetches the company's **beta** from the Financial Datasets API snapshot, with automatic FMP and sector-median fallbacks
2. Applies **CAPM**: `Ke = Rfr + β × ERP`
3. Computes **WACC**: `WACC = E/V × Ke + D/V × Kd × (1 − T)`

**Active assumption:** wacc = {{wacc}}

**Use the returned `wacc` value as the discount rate for Steps 4–6.** If you have a `wacc` parameter override, use that value directly as the discount rate instead of the tool-computed value.

The output also includes `betaSource`, `ke`, `deRatio`, `equityWeight`, `debtWeight`, `waccPct`, and a human-readable `note` — include these in the Key Inputs table (Step 8).

### Overriding inputs (when you have better data)

| Situation | Override |
|-----------|----------|
| You found a precise 10Y yield via `web_search` | Pass `risk_free_rate: <decimal>` |
| Balance sheet shows specific debt cost | Pass `cost_of_debt: <pre-tax decimal>` |
| Income statement shows exact effective tax rate | Pass `tax_rate: <decimal>` |
| You computed D/E from balance sheet directly | Pass `debt_to_equity: <decimal>` |

### Reasonableness check

After getting the WACC, verify:
- WACC is **2–4% below** `return_on_invested_capital` for value-creating companies; if WACC > ROIC, the company may be destroying value — note this as a risk
- WACC should fall within the sector range from [sector-wacc.md](sector-wacc.md) — if not, review the beta source and D/E ratio

## Step 4: Project Future Cash Flows

**Years 1–{{years}}:** Apply growth rate with 5% annual decay (multiply growth rate by 0.95, 0.90, 0.85, 0.80 for years 2–{{years}}). This reflects competitive dynamics.

**Terminal value:** Use Gordon Growth Model. Terminal growth rate assumption: terminal_growth_rate = {{terminal_growth_rate}}. Select terminal growth rate from the table below:

### Terminal Growth Rate Selection

| Company Profile | Terminal Rate |
|-----------------|---------------|
| Utility / REIT / Telecom (regulated) | 1.5–2.0% |
| Mature industrial / Consumer Staples | 2.0–2.5% |
| Diversified tech / Healthcare / Financials | 2.5–3.0% |
| Emerging-market headquartered | local long-run GDP (≤ 4.0%) |

**Hard constraints:**
- Terminal growth **must not exceed** the risk-free rate (≈ current 10Y Treasury yield)
- Terminal growth **must not exceed 3.5%** for any developed-market company
- If terminal value > **85% of total DCF Enterprise Value**: your growth rate is too high — reduce it

**Default when unsure:** 2.5% (nominal long-run US GDP proxy)

## Step 5: Calculate Present Value

Discount all FCFs and terminal value → sum for **DCF Enterprise Value**.

### Net Debt Formula (exact)

```
Net Debt = Total Debt
         + Operating Lease Liabilities     ← from balance sheet (IFRS 16 / ASC 842)
         − Cash and Cash Equivalents
         − Short-term Investments
         − Restricted Cash                 ← only if accessible for debt repayment
```

**Fair Value Per Share = (DCF Enterprise Value − Net Debt) ÷ Diluted Shares Outstanding**

**Edge cases:**
- **Net cash company** (Net Debt < 0): Subtract the negative value → Fair Value is *higher* than EV/share
- **Lease-heavy companies** (airlines, retailers, restaurants): Operating lease liabilities can equal 30–80% of total "debt" — always include them
- **Preferred stock**: Treat as debt; subtract face value from EV before dividing by common shares
- **Convertible notes**: Add at face value; ignore conversion premium for base-case simplicity
- **Pension deficit**: Add net pension liability (pension obligation minus pension assets) to Net Debt

## Step 6: Sensitivity Analysis

Create 3×3 matrix: WACC ({{wacc}} ±1%) vs terminal growth ({{terminal_growth_rate}} −0.5%, {{terminal_growth_rate}}, {{terminal_growth_rate}} +0.5%).

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
2. **Key Inputs Table**: All assumptions with their sources — **must include**:
   - Beta (and `betaSource` from `wacc_inputs`)
   - Risk-free rate, ERP, cost of equity (Ke)
   - D/E ratio, pre-tax Kd, after-tax Kd, tax rate
   - WACC (`waccPct` from `wacc_inputs`)
   - FCF growth rate (and how it was derived)
   - Terminal growth rate
3. **Projected FCF Table**: 5-year projections with present values
4. **Sensitivity Matrix**: 3×3 grid varying WACC (base ±1%) and terminal growth (2.0%, 2.5%, 3.0%)
5. **Caveats**: Standard DCF limitations plus company-specific risks
