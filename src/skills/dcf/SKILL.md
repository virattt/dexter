---
name: dcf
description: Perform discounted cash flow (DCF) valuation analysis. Use when user asks for fair value, intrinsic value, DCF analysis, or valuation of a company.
---

# DCF Valuation Skill

Perform a discounted cash flow analysis to estimate a company's intrinsic value.

## Step 1: Gather Financial Data

Call `financial_search` with these specific queries to retrieve all necessary data:

### 1.1 Cash Flow History (5 years)
Query: "[TICKER] annual cash flow statements for the last 5 years"

**Key fields to extract:**
- `free_cash_flow` — Use this directly (no calculation needed)
- `net_cash_flow_from_operations`
- `capital_expenditure`

### 1.2 Financial Metrics Snapshot
Query: "[TICKER] financial metrics snapshot"

**Key fields to extract:**
- `market_cap` — Current market capitalization
- `enterprise_value` — EV for validation
- `free_cash_flow_growth` — Historical FCF growth rate
- `revenue_growth` — For cross-validation
- `return_on_invested_capital` — Benchmark for discount rate
- `debt_to_equity` — For WACC calculation
- `free_cash_flow_per_share` — For per-share validation

### 1.3 Balance Sheet (most recent)
Query: "[TICKER] latest balance sheet"

**Key fields to extract:**
- `total_debt` — Total debt outstanding
- `cash_and_equivalents` — Cash position
- `current_investments` — Short-term investments (add to cash)
- `outstanding_shares` — Shares for per-share calculation

### 1.4 Analyst Estimates
Query: "[TICKER] analyst estimates"

**Key fields to extract:**
- `earnings_per_share` — Forward EPS estimates by fiscal year
- Calculate implied EPS growth rate from estimates

### 1.5 Current Price
Query: "[TICKER] price snapshot"

**Key fields to extract:**
- `price` — Current stock price for comparison

## Step 2: Calculate FCF Growth Rate

Use the 5-year FCF history to calculate CAGR:

```
FCF_CAGR = (FCF_latest / FCF_oldest)^(1/years) - 1
```

Cross-validate with:
- `free_cash_flow_growth` from metrics snapshot (YoY)
- `revenue_growth` from metrics snapshot
- Implied growth from analyst EPS estimates

**Growth rate selection:**
- If FCF has been stable: Use historical CAGR with 10-20% haircut
- If FCF is volatile: Weight analyst estimates more heavily
- Cap growth rate at 15% for projection period (very few companies sustain higher)

## Step 3: Estimate Discount Rate (WACC)

### Using Available Data
The API provides `return_on_invested_capital` (ROIC) which serves as a useful benchmark.

**Simplified WACC estimation:**
```
Cost of Equity (Ke) = Risk-free rate (4%) + Equity Risk Premium (5-6%)
                    ≈ 9-10% for average risk company

Debt weight = debt_to_equity / (1 + debt_to_equity)
Equity weight = 1 - Debt weight

Cost of Debt (Kd) ≈ 5-6% pre-tax, ~4% after-tax (assuming 30% tax rate)

WACC = (Equity weight × Ke) + (Debt weight × Kd × (1 - tax rate))
```

**Reasonableness check:**
- WACC should typically be 2-4% below ROIC for value-creating companies
- If calculated WACC > ROIC, the company may be destroying value

### Sector Adjustments
- Technology (high growth): 9-12%
- Consumer Staples (stable): 7-8%
- Financials: 8-10%
- Healthcare: 8-10%
- Utilities: 6-7%
- High debt companies: Add 1-2%

## Step 4: Project Future Cash Flows

### Years 1-5 Projection
```
Year 1 FCF = Latest FCF × (1 + growth_rate)
Year 2 FCF = Year 1 FCF × (1 + growth_rate × 0.95)  // Slight decay
Year 3 FCF = Year 2 FCF × (1 + growth_rate × 0.90)
Year 4 FCF = Year 3 FCF × (1 + growth_rate × 0.85)
Year 5 FCF = Year 4 FCF × (1 + growth_rate × 0.80)
```

**Note:** Growth decay reflects competitive dynamics—sustained high growth is rare.

### Terminal Value (Year 5+)
```
Terminal Growth (g) = 2.5% (long-term GDP proxy)
Terminal Value = Year 5 FCF × (1 + g) / (WACC - g)
```

## Step 5: Calculate Present Value

### Discount Each Cash Flow
```
PV_Year_n = FCF_Year_n / (1 + WACC)^n
PV_Terminal = Terminal_Value / (1 + WACC)^5
```

### Enterprise Value
```
Enterprise Value = Sum(PV_Year_1 to PV_Year_5) + PV_Terminal
```

### Equity Value & Fair Value Per Share
```
Net Debt = total_debt - cash_and_equivalents - current_investments
Equity Value = Enterprise Value - Net Debt
Fair Value Per Share = Equity Value / outstanding_shares
```

## Step 6: Sensitivity Analysis

Create a matrix varying WACC and terminal growth:

| WACC \ Terminal g | 2.0% | 2.5% | 3.0% |
|-------------------|------|------|------|
| WACC - 1%         | $XXX | $XXX | $XXX |
| Base WACC         | $XXX | $XXX | $XXX |
| WACC + 1%         | $XXX | $XXX | $XXX |

## Output Format

Present results as:

**[TICKER] DCF Valuation**

| Metric | Value |
|--------|-------|
| Current Price | $XXX |
| Fair Value (Base Case) | $XXX |
| Upside/Downside | +/-XX% |
| Market Cap | $XXX B |
| Enterprise Value (Calculated) | $XXX B |
| Enterprise Value (Reported) | $XXX B |

**Key Inputs**
| Input | Value | Source |
|-------|-------|--------|
| Latest FCF | $XX B | Cash flow statement |
| FCF CAGR (5yr) | X.X% | Calculated |
| Projected Growth (Yr 1) | X.X% | Adjusted CAGR |
| Terminal Growth | 2.5% | GDP proxy |
| WACC | X.X% | Estimated |
| Net Debt | $XX B | Balance sheet |
| Shares Outstanding | XX B | Balance sheet |

**Projected Free Cash Flows**
| Year | FCF | PV |
|------|-----|-----|
| 1 | $XX B | $XX B |
| 2 | $XX B | $XX B |
| 3 | $XX B | $XX B |
| 4 | $XX B | $XX B |
| 5 | $XX B | $XX B |
| Terminal | $XXX B | $XXX B |

**Sensitivity Table**
(WACC vs Terminal Growth matrix)

**Caveats**
- DCF is highly sensitive to growth and discount rate assumptions
- Model assumes stable margins and capital structure
- Does not account for one-time events, M&A, or major strategic shifts
- Best used alongside other valuation methods (P/E comps, EV/EBITDA)
