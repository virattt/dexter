---
name: company-snapshot
description: Generates a Snowflake-style multi-dimensional health score across 5 dimensions (Valuation, Growth, Performance, Financial Health, Dividends) with 6 checks each — 30 total. Triggers when user asks for a health check, snapshot, quick analysis, "rate this stock", "score this company", "is X a good investment", overview, or wants an at-a-glance summary of a company.
---

# Company Snapshot Skill

Produce a structured 30-check health score across 5 dimensions, styled after Simply Wall Street's Snowflake model.

## Workflow Checklist

```
Snapshot Progress:
- [ ] Step 1: Gather all data
- [ ] Step 2: Score Valuation (6 checks)
- [ ] Step 3: Score Future Growth (6 checks)
- [ ] Step 4: Score Past Performance (6 checks)
- [ ] Step 5: Score Financial Health (6 checks)
- [ ] Step 6: Score Dividends (6 checks)
- [ ] Step 7: Compose output
```

## Step 1: Data Gathering

Make these tool calls in sequence (or as few calls as possible):

### 1.1 Financial Metrics Snapshot
**Query:** `"[TICKER] financial metrics snapshot"`

**Extract:** `pe_ratio`, `ev_to_ebitda`, `price_to_book`, `peg_ratio`, `return_on_equity`, `return_on_invested_capital`, `debt_to_equity`, `current_ratio`, `interest_coverage`, `free_cash_flow_yield`, `revenue_growth`, `earnings_growth`, `net_profit_margin`, `gross_profit_margin`, `market_cap`, `dividend_yield`, `payout_ratio`

### 1.2 Analyst Estimates
**Query:** `"[TICKER] analyst estimates and price targets"`

**Extract:** analyst consensus price target, forward revenue growth estimates, forward EPS growth estimates, number of analysts, consensus rating (buy/hold/sell)

### 1.3 Historical Performance
**Query:** `"[TICKER] historical key ratios for last 5 years"`

**Extract:** `roe` trend, `net_profit_margin` trend, `revenue_growth` trend, `eps` trend, `debt_to_equity` trend

### 1.4 Cash Flow
**Query:** `"[TICKER] cash flow statements last 3 years"`

**Extract:** `free_cash_flow`, `operating_cash_flow`, `dividends_paid`, `net_income`

### 1.5 Balance Sheet
**Query:** `"[TICKER] latest balance sheet"`

**Extract:** `total_debt`, `cash_and_equivalents`, `current_assets`, `current_liabilities`, `total_assets`, `total_liabilities`, `total_equity`, `shares_outstanding`

### 1.6 Current Price
**Query:** `"[TICKER] current price snapshot"`

**Extract:** `price`, `52_week_high`, `52_week_low`, sector, industry

---

## Step 2: Score Valuation (6 checks)

For each check: PASS = 1 point, FAIL = 0, WARN = 0 (flag it but don't score)

| Check | Pass Condition | Notes |
|---|---|---|
| V1: DCF vs Price | Current price < estimated fair value (use rough FCF yield × 20 if no DCF available) | If below fair value = PASS |
| V2: P/E vs Sector | P/E < sector median or < 25 for growth, < 18 for value sectors | Use judgment if sector median unavailable |
| V3: EV/EBITDA | EV/EBITDA < 15 | < 10 = strong PASS |
| V4: P/B Ratio | P/B < 3 (or < 1 = deep value) | Skip if financial company |
| V5: Analyst Target Upside | Consensus analyst price target > current price by > 10% | |
| V6: PEG Ratio | PEG < 1.5 (ideally < 1.0) | PEG = P/E ÷ EPS growth rate |

Valuation Score: X/6

---

## Step 3: Score Future Growth (6 checks)

| Check | Pass Condition |
|---|---|
| G1: Revenue Growth Forecast | Analyst forecast revenue growth > 5% next year |
| G2: EPS Growth Forecast | Analyst forecast EPS growth > 8% next year |
| G3: Earnings Beat History | Has beaten earnings estimates in 3 of last 4 quarters (if data available, else skip) |
| G4: Analyst Consensus | More Buy ratings than Hold/Sell; consensus = Buy or Strong Buy |
| G5: FCF Growth Trend | Free cash flow has grown over the last 3 years |
| G6: Revenue Acceleration | Revenue growth this year > revenue growth last year (accelerating) |

Growth Score: X/6

---

## Step 4: Score Past Performance (6 checks)

| Check | Pass Condition |
|---|---|
| P1: 52-Week Momentum | Price is above 52-week midpoint (price > (52wk_high + 52wk_low) / 2) |
| P2: ROE | Return on equity > 12% (latest year) |
| P3: ROIC vs WACC | ROIC > estimated WACC (use sector WACC from [../dcf/sector-wacc.md](../dcf/sector-wacc.md)) — indicates value creation |
| P4: Earnings Consistency | Net income positive in each of the last 3 years |
| P5: Revenue CAGR | 3-year revenue CAGR > 5% |
| P6: Margin Trend | Net profit margin is stable or expanding over 3 years (not contracting) |

Performance Score: X/6

---

## Step 5: Score Financial Health (6 checks)

| Check | Pass Condition |
|---|---|
| H1: Short-term Liquidity | Current ratio > 1.5 (current assets / current liabilities) |
| H2: Debt-to-Equity | D/E < 1.0 (or < 2.0 for capital-intensive industries like utilities, REITs) |
| H3: Interest Coverage | EBIT / interest expense > 5x |
| H4: Cash Flow Cover | Operating cash flow > 20% of total debt |
| H5: Net Cash Position | Cash > total debt (net cash positive) OR debt declining year-over-year |
| H6: Earnings Quality | Operating cash flow > net income (accruals check — cash earnings are higher quality) |

Health Score: X/6

---

## Step 6: Score Dividends (6 checks)

**If company pays no dividend:** score all 6 as N/A and note "No dividend — score based on 24 checks." Adjust total to X/24.

| Check | Pass Condition |
|---|---|
| D1: Yield vs Sector | Dividend yield ≥ sector median yield |
| D2: Payout Ratio (Earnings) | Payout ratio < 75% (< 60% = strong PASS) |
| D3: Payout Ratio (FCF) | Dividends paid / free cash flow < 80% (FCF payout is more reliable) |
| D4: Dividend Growth | 3-year dividend CAGR > 3% (growing, not frozen or cut) |
| D5: Consistency | No dividend cuts in the last 5 years |
| D6: Coverage by FCF | FCF per share > dividends per share (covered) |

Dividends Score: X/6

---

## Step 7: Compose Output

Present in this exact format:

```
## [TICKER] — [Company Name] Snapshot

**Snowflake Score: [TOTAL]/30**
[Or X/24 if no dividend]

  Valuation    [bar]  [X]/6   [one-line summary]
  Growth       [bar]  [X]/6   [one-line summary]
  Performance  [bar]  [X]/6   [one-line summary]
  Health       [X]/6   [one-line summary]
  Dividends    [X]/6   [one-line summary or "N/A — no dividend"]

[For each dimension, list all 6 checks as ✓ PASS / ✗ FAIL / ~ WARN with the key number]

**Key Strengths**
- [Top 2-3 things the company does well]

**Key Risks / Watch**
- [Top 2-3 quantitative or qualitative red flags]

**Verdict**
[One sentence: e.g. "Financially healthy compounder trading at fair value — growth deceleration is the main watch item."]
```

**Bar chart format:** Use 6 characters: █ for each point scored, ░ for each point not scored.
Example: Score 4/6 → `████░░`

**One-line summaries per dimension:**
- Valuation: e.g. "Fairly valued; P/E in-line with sector, analyst targets imply 12% upside"
- Growth: e.g. "Strong analyst growth consensus; FCF growth decelerating"
- Performance: e.g. "Consistent earnings; ROE 31% well above cost of equity"
- Health: e.g. "Net cash positive; current ratio 1.8; no debt concerns"
- Dividends: e.g. "Yield 0.6% below sector; payout conservative at 15% of FCF"

---

## Edge Cases

- **No dividend:** Score /24 not /30. State clearly.
- **Financial companies (banks, insurance):** Skip H1 (current ratio) and H3 (interest coverage) — not applicable. Score /28 or /24.
- **Pre-revenue / negative earnings companies:** Skip P4 (earnings consistency) and V6 (PEG). Adjust denominator. Focus analysis on growth and balance sheet strength.
- **Missing data:** If a metric is unavailable, skip that check, adjust denominator, note it.
