---
name: financial-health
description: Performs a systematic balance sheet and financial health analysis with explicit pass/fail checks across liquidity, solvency, debt servicing, earnings quality, and balance sheet trajectory. Triggers when user asks about balance sheet health, debt analysis, financial strength, leverage, liquidity, solvency, "can X survive a downturn", "is X financially strong", or wants a debt/coverage deep dive.
---

# Financial Health Skill

Run a systematic financial health check with scored pass/fail checks, mirroring Simply Wall Street's Financial Health framework — but with more depth.

## Workflow Checklist

```
Financial Health Progress:
- [ ] Step 1: Gather financial data
- [ ] Step 2: Liquidity checks (short-term)
- [ ] Step 3: Solvency checks (long-term)
- [ ] Step 4: Debt servicing checks
- [ ] Step 5: Balance sheet trajectory
- [ ] Step 6: Earnings quality check
- [ ] Step 7: Compose verdict and output
```

## Step 1: Data Gathering

### 1.1 Balance Sheet (3 years)
**Query:** `"[TICKER] balance sheet statements for the last 3 years"`

**Extract:** `current_assets`, `current_liabilities`, `total_assets`, `total_liabilities`, `total_equity`, `total_debt` (long-term + short-term debt), `cash_and_equivalents`, `current_investments`, `goodwill`, `intangible_assets`, `net_receivables`

### 1.2 Income Statement
**Query:** `"[TICKER] income statement last 3 years"`

**Extract:** `revenue`, `ebit` (operating income), `interest_expense`, `net_income`, `ebitda` (if available)

### 1.3 Cash Flow Statement
**Query:** `"[TICKER] cash flow statements last 3 years"`

**Extract:** `operating_cash_flow`, `free_cash_flow`, `capital_expenditure`, `dividends_paid`

### 1.4 Key Ratios Snapshot
**Query:** `"[TICKER] financial metrics and key ratios"`

**Extract:** `debt_to_equity`, `current_ratio`, `interest_coverage`, `return_on_assets`, `return_on_invested_capital`, sector, industry, `market_cap`

---

## Step 2: Liquidity Checks (Short-Term)

Assess whether the company can meet near-term obligations.

### L1: Current Ratio
`Current Assets ÷ Current Liabilities`

| Result | Score |
|---|---|
| > 2.0 | ✓ PASS (strong) |
| 1.5 – 2.0 | ✓ PASS |
| 1.0 – 1.5 | ~ WARN |
| < 1.0 | ✗ FAIL (technically insolvent short-term) |

**Exception:** Retailers and banks naturally run low current ratios — note if applicable.

### L2: Cash Ratio
`Cash & Equivalents ÷ Current Liabilities`

| Result | Score |
|---|---|
| > 0.5 | ✓ PASS |
| 0.2 – 0.5 | ~ WARN |
| < 0.2 | ✗ FAIL |

### L3: Short-Term Debt Coverage
Does the company have more cash than short-term debt coming due?

`Cash > Short-Term Debt` → PASS; otherwise FAIL.

---

## Step 3: Solvency Checks (Long-Term)

Assess whether the company is carrying a sustainable debt load.

### S1: Debt-to-Equity Ratio
`Total Debt ÷ Total Equity`

| Result | Score |
|---|---|
| < 0.5 | ✓ PASS (conservative) |
| 0.5 – 1.0 | ✓ PASS |
| 1.0 – 2.0 | ~ WARN |
| > 2.0 | ✗ FAIL |

**Exception:** Capital-intensive sectors (utilities, REITs, telecoms) tolerate D/E up to 3.0 — adjust threshold by sector.

### S2: Net Debt / EBITDA
`(Total Debt − Cash) ÷ EBITDA`

| Result | Score |
|---|---|
| < 1.0 | ✓ PASS |
| 1.0 – 2.5 | ✓ PASS |
| 2.5 – 4.0 | ~ WARN |
| > 4.0 | ✗ FAIL |

**If EBITDA negative:** Auto-FAIL — company cannot service debt from operations.

### S3: Net Cash Position
Is the company net cash (cash > total debt)?

`Cash > Total Debt` → PASS — no net debt, fortress balance sheet
`Cash < Total Debt` → Note net debt amount; not a fail on its own but track trajectory.

---

## Step 4: Debt Servicing Checks

Assess ability to service debt from earnings and cash flow.

### D1: Interest Coverage Ratio
`EBIT ÷ Interest Expense`

| Result | Score |
|---|---|
| > 10x | ✓ PASS (excellent) |
| 5x – 10x | ✓ PASS |
| 3x – 5x | ~ WARN |
| < 3x | ✗ FAIL |
| Negative EBIT | ✗ FAIL (cannot cover interest from operations) |

**Per SWS standard:** EBIT > 5× interest = PASS.

### D2: Operating Cash Flow to Debt
`Operating Cash Flow ÷ Total Debt`

| Result | Score |
|---|---|
| > 40% | ✓ PASS (strong) |
| 20% – 40% | ✓ PASS |
| 10% – 20% | ~ WARN |
| < 10% | ✗ FAIL |

**Per SWS standard:** OCF > 20% of total debt = PASS.

### D3: Debt Payback Period
`Total Debt ÷ Free Cash Flow` (years to pay off debt from FCF)

| Result | Score |
|---|---|
| < 3 years | ✓ PASS |
| 3 – 5 years | ✓ PASS |
| 5 – 8 years | ~ WARN |
| > 8 years or negative FCF | ✗ FAIL |

---

## Step 5: Balance Sheet Trajectory

Is the balance sheet getting stronger or weaker over time?

Compare latest year vs. 3 years ago:

### T1: Debt Trend
- Total debt declining (or stable) → PASS
- Total debt increasing AND D/E ratio worsening → FAIL
- Note: Debt increasing alongside revenue growth may be acceptable (growth capex)

### T2: Equity Build
- Total equity growing over 3 years → PASS
- Equity shrinking (buybacks, losses) → note; WARN if losses-driven

---

## Step 6: Earnings Quality Check

High-quality earnings are backed by cash. When net income far exceeds operating cash flow, earnings may be inflated by accruals (accounting choices).

### Q1: Cash Conversion
`Operating Cash Flow ÷ Net Income`

| Result | Score |
|---|---|
| > 1.0 (OCF > Net Income) | ✓ PASS — cash earnings exceed reported earnings |
| 0.7 – 1.0 | ✓ PASS |
| 0.4 – 0.7 | ~ WARN — accruals are elevated |
| < 0.4 or negative | ✗ FAIL — earnings quality is poor |

### Q2: Accruals Ratio (optional, if data available)
`(Net Income − Operating Cash Flow) ÷ Total Assets`

Negative value (OCF > net income) = good. Positive and growing = red flag.

---

## Step 7: Output Format

```
## [TICKER] — Financial Health Analysis

**Overall Health: [PASS COUNT]/[TOTAL APPLICABLE CHECKS] checks passed**

### Liquidity (Short-Term)
| Check | Result | Value | Score |
|---|---|---|---|
| Current Ratio | [value] | Current assets/liabilities | ✓/~/✗ |
| Cash Ratio | [value] | Cash/current liabilities | ✓/~/✗ |
| Short-term debt covered | [Yes/No] | Cash vs ST debt | ✓/~/✗ |

### Solvency (Long-Term)
| Check | Result | Value | Score |
|---|---|---|---|
| Debt-to-Equity | [value] | | ✓/~/✗ |
| Net Debt/EBITDA | [value]x | | ✓/~/✗ |
| Net Cash Position | [Net cash / Net debt amount] | | ✓/~/✗ |

### Debt Servicing
| Check | Result | Value | Score |
|---|---|---|---|
| Interest Coverage | [value]x | EBIT/interest | ✓/~/✗ |
| OCF to Total Debt | [value]% | | ✓/~/✗ |
| Debt Payback Period | [value] years | Debt/FCF | ✓/~/✗ |

### Balance Sheet Trajectory
| Check | Trend | Score |
|---|---|---|
| Debt trend (3yr) | [Declining/Stable/Increasing] | ✓/~/✗ |
| Equity build (3yr) | [Growing/Stable/Shrinking] | ✓/~/✗ |

### Earnings Quality
| Check | Result | Score |
|---|---|---|
| Cash Conversion (OCF/Net Income) | [value]x | ✓/~/✗ |

---

**Summary**

[2-3 sentences: What is strong, what is concerning, and an overall verdict]

**Verdict:** [Financially Strong / Adequate / Stretched / Distressed]
```

**Verdict definitions:**
- **Financially Strong:** 9+ checks pass, no fails
- **Adequate:** 7–9 pass, at most 1–2 fails in non-critical areas
- **Stretched:** 5–7 pass, multiple warns/fails, debt elevated
- **Distressed:** < 5 pass, multiple fails especially in debt servicing

---

## Notes on Sector Adjustments

- **Banks / Insurance:** Skip current ratio and interest coverage — not meaningful. Focus on capital adequacy and loan loss reserves (note that standard checks don't fully apply).
- **Utilities / REITs:** Higher debt tolerance — raise D/E pass threshold to 2.0 and net debt/EBITDA to 5.0.
- **Early-stage / pre-profit companies:** Skip earnings quality check (no net income). Focus on cash runway (cash ÷ monthly cash burn).
