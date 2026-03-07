---
name: dividend-analysis
description: Performs a comprehensive dividend sustainability and quality analysis. Scores dividend safety across yield, payout ratios, growth history, FCF coverage, and consistency. Triggers when user asks about dividends, income stocks, dividend yield, dividend safety, "is the dividend safe", payout ratio, dividend growth, dividend sustainability, DRIP investing, or whether a company is a good income investment.
---

# Dividend Analysis Skill

Produce a structured dividend health check with a scored sustainability verdict. Follows the Simply Wall Street dividend framework but goes deeper on FCF-based metrics.

## Workflow Checklist

```
Dividend Analysis Progress:
- [ ] Step 1: Check if company pays a dividend
- [ ] Step 2: Gather dividend and financial data
- [ ] Step 3: Score yield quality
- [ ] Step 4: Score payout sustainability
- [ ] Step 5: Score dividend growth
- [ ] Step 6: Score consistency and coverage
- [ ] Step 7: Calculate forward income projections
- [ ] Step 8: Compose output
```

---

## Step 1: Check for Dividend

**Query:** `"[TICKER] dividend yield and payout ratio"`

If `dividend_yield` = 0 or null → **Stop.** Output:
```
[TICKER] does not currently pay a dividend.

[If relevant: Note whether company does buybacks instead, and the buyback yield. Buyback yield = buybacks / market cap.]
```

Otherwise proceed.

---

## Step 2: Data Gathering

### 2.1 Key Metrics
**Query:** `"[TICKER] financial metrics snapshot"`

**Extract:** `dividend_yield`, `payout_ratio`, `market_cap`, `price`, sector, industry

### 2.2 Cash Flow (5 years)
**Query:** `"[TICKER] cash flow statements for the last 5 years"`

**Extract:** `dividends_paid` (annual), `free_cash_flow`, `operating_cash_flow`, `net_income`, `shares_outstanding`

Calculate per-share values:
- Dividends per share = `dividends_paid ÷ shares_outstanding` (or extract directly)
- FCF per share = `free_cash_flow ÷ shares_outstanding`

### 2.3 Historical Key Ratios (5 years)
**Query:** `"[TICKER] historical key ratios"`

**Extract:** `dividend_yield` by year, `payout_ratio` by year — to assess trajectory and detect cuts

### 2.4 Analyst Estimates
**Query:** `"[TICKER] analyst estimates"`

**Extract:** Forward EPS estimates, forward dividend estimates (if available), revenue growth forecasts

### 2.5 Sector Dividend Benchmark
**Query:** `"[TICKER] sector median dividend yield peer comparison"` (or use web_search for sector median yield)

**Extract:** Median yield for the company's sector

---

## Step 3: Score Yield Quality (2 checks)

| Check | Pass Condition | Notes |
|---|---|---|
| Y1: Yield vs Sector | Yield ≥ sector median | A yield far below median means income seekers can do better in the sector |
| Y2: Yield Sustainability | Yield < 8% (very high yield often signals distress or cut risk) | > 8%: strong WARN — market may be pricing in a cut |

---

## Step 4: Score Payout Sustainability (3 checks)

The most important dimension — dividends must be funded by real earnings and cash.

| Check | Pass Condition | Notes |
|---|---|---|
| P1: Earnings Payout Ratio | Payout ratio (dividends / net income) < 75% | < 60% = strong; 75–90% = WARN; > 90% = FAIL |
| P2: FCF Payout Ratio | Dividends paid / free cash flow < 80% | FCF payout is more reliable than earnings payout. < 60% = strong |
| P3: Positive FCF | Free cash flow is positive | If FCF < 0, dividend is debt-funded → auto-FAIL |

---

## Step 5: Score Dividend Growth (2 checks)

| Check | Pass Condition | Notes |
|---|---|---|
| G1: 3-Year Dividend CAGR | Dividend per share has grown at > 3% per year over 3 years | Calculate: (DPS_current / DPS_3yr_ago)^(1/3) − 1 |
| G2: Forward Growth | Analyst estimates imply continued EPS growth > 5% (dividends can grow) | If no estimate: check if FCF growth trend supports future raises |

---

## Step 6: Score Consistency and Coverage (3 checks)

| Check | Pass Condition | Notes |
|---|---|---|
| C1: No Cuts (5yr) | No dividend cuts or suspensions in the last 5 years | Check historical dividend data; a cut = ✗ FAIL |
| C2: FCF Coverage | FCF per share > dividends per share (FCF covers dividend) | FCF/DPS ratio: > 1.5 = strong; < 1.0 = FAIL |
| C3: Earnings Coverage | EPS > DPS (earnings cover dividend) | If reporting losses: WARN |

---

## Step 7: Forward Income Projection

Calculate what an investor earns from dividends on a $10,000 investment:

```
Annual Dividend Income = $10,000 × dividend_yield
Monthly Dividend Income = Annual ÷ 12
```

If dividend growth rate (G1) is available, project 5-year forward income:
```
Year 1: $10,000 × yield
Year 3: $10,000 × yield × (1 + growth_rate)^2
Year 5: $10,000 × yield × (1 + growth_rate)^4
```

Also calculate:
- **Yield on Cost** at 5yr (if bought today and dividend grows at CAGR): Year 5 DPS / current price
- **Break-even years** (rough payback from dividends alone at current yield, ignoring price appreciation): 100% / yield

---

## Step 8: Output Format

```
## [TICKER] — Dividend Analysis

**Dividend Health Score: [TOTAL]/10 checks passed**
**Sustainability Verdict: [Safe / Monitor / At Risk / Unsustainable]**

---

### Key Metrics
| Metric | Value |
|---|---|
| Annual Dividend Yield | [X]% |
| Sector Median Yield | [X]% |
| Earnings Payout Ratio | [X]% |
| FCF Payout Ratio | [X]% |
| Dividends Paid (TTM) | $[X]B / $[X]M |
| Free Cash Flow (TTM) | $[X]B / $[X]M |
| FCF Coverage | [X]x |
| 3-Year Dividend CAGR | [X]% |
| Last Dividend Cut | [Never / Year] |

---

### Scorecard
| Category | Check | Score |
|---|---|---|
| Yield | Y1: Yield vs sector median | ✓/✗ |
| Yield | Y2: Yield < 8% (not distress yield) | ✓/~/✗ |
| Payout | P1: Earnings payout < 75% | ✓/~/✗ |
| Payout | P2: FCF payout < 80% | ✓/~/✗ |
| Payout | P3: Positive free cash flow | ✓/✗ |
| Growth | G1: 3yr dividend CAGR > 3% | ✓/✗ |
| Growth | G2: Forward EPS supports growth | ✓/~/✗ |
| Consistency | C1: No cuts in 5 years | ✓/✗ |
| Consistency | C2: FCF covers dividend (FCF/DPS > 1x) | ✓/✗ |
| Consistency | C3: Earnings cover dividend (EPS > DPS) | ✓/~/✗ |

---

### Forward Income Projection ($10,000 invested today)

| Horizon | Annual Income | Monthly Income |
|---|---|---|
| Year 1 | $[X] | $[X] |
| Year 3 | $[X] (est. at [X]% growth) | $[X] |
| Year 5 | $[X] (est. at [X]% growth) | $[X] |

Yield on Cost at Year 5: [X]%
Dividend payback period (dividends only): ~[X] years

---

### Analysis

**Strengths:** [2-3 bullet points: what makes the dividend attractive/safe]

**Risks / Watch Items:** [2-3 bullet points: what could threaten the dividend]

**Verdict:** [2-3 sentence assessment of dividend sustainability and quality]
```

**Sustainability Verdict Definitions:**

| Verdict | Criteria |
|---|---|
| **Safe** | 8-10 checks pass; FCF payout < 70%; no cuts; growing |
| **Monitor** | 6-7 checks pass; payout ratios elevated but within range; watch FCF trend |
| **At Risk** | 4-5 checks pass; payout > 80% FCF OR yield > 7% OR FCF barely covers |
| **Unsustainable** | < 4 checks pass; negative FCF; payout > 100%; recent cut history |

---

## Sector-Specific Notes

- **REITs:** Use AFFO payout ratio instead of net income payout (net income understates REIT true earnings). Payout ratios of 80-90% are normal. Adjust P1 threshold to 90%.
- **MLPs / Energy:** Distributable Cash Flow (DCF) is the correct payout metric, not net income.
- **Utilities:** Higher payout ratios (60-80%) are normal and acceptable given regulated earnings stability.
- **Banks:** Dividends are regulated (capital requirements). A bank with 40% payout may be conservative by regulation.
- **Growth companies:** Low yield is expected. Note buyback yield as a complementary shareholder return metric.
