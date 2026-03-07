---
name: company-report
description: Generates a comprehensive, structured investment report covering all dimensions of a company — valuation, growth, performance, financial health, dividends, risks, and investment narrative. This is the "full picture" skill. Triggers when user asks for a full report, investment report, research report, deep dive, investment thesis, write-up, "analyze X thoroughly", "comprehensive analysis of X", or wants a complete view of a company.
---

# Company Report Skill

Generate a full investment report modeled on Simply Wall Street's company reports, extended with Dexter's Buffett/Munger-style narrative framework. This is Dexter's most comprehensive single-company output.

## Workflow Checklist

```
Company Report Progress:
- [ ] Step 1: Company overview and context
- [ ] Step 2: Snapshot score (invoke company-snapshot skill)
- [ ] Step 3: Valuation (invoke dcf-valuation skill + relative valuation)
- [ ] Step 4: Future growth analysis
- [ ] Step 5: Past performance analysis
- [ ] Step 6: Financial health (invoke financial-health skill)
- [ ] Step 7: Dividend analysis (invoke dividend-analysis skill)
- [ ] Step 8: Key risks (from 10-K + quantitative flags)
- [ ] Step 9: Investment narrative
- [ ] Step 10: Compose final report
```

---

## Step 1: Company Overview

**Query:** `"[TICKER] company facts and business description"`

**Extract:** Company name, sector, industry, market cap, headquarters, founded year, CEO

**Query:** `"[TICKER] revenue segment breakdown"`

**Extract:** Business segments, revenue mix, geographic breakdown

**Query:** `"[TICKER] company news last 30 days"`

**Extract:** Any material recent events (earnings, acquisitions, guidance changes, management changes)

**Compose:** 3-4 sentence business summary:
- What the company does
- How it makes money (revenue model)
- Market position and key segments
- Any material recent news

---

## Step 2: Snapshot Score

Invoke the `company-snapshot` skill:
```
skill: company-snapshot
args: [TICKER]
```

Extract and embed the Snowflake score table in the report.

---

## Step 3: Valuation

### 3.1 Intrinsic Value (DCF)

Invoke the `dcf-valuation` skill:
```
skill: dcf-valuation
args: [TICKER]
```

Extract the key outputs:
- Fair value per share (base case)
- Upside/downside vs current price
- WACC and growth rate assumptions
- Sensitivity matrix (condense to 1-line summary)

### 3.2 Relative Valuation

**Query:** `"[TICKER] P/E EV/EBITDA price-to-book metrics"`

Compare the company's multiples to:
- Its own 5-year historical average (is it cheap/expensive vs its own history?)
- Sector/industry median (if available via web_search: "[sector] median P/E EV/EBITDA")

**Present as a table:**

| Metric | [TICKER] | 5yr Avg | Sector Median | Assessment |
|---|---|---|---|---|
| P/E | | | | |
| EV/EBITDA | | | | |
| P/B | | | | |
| EV/Sales | | | | |

### 3.3 Analyst Consensus

**Query:** `"[TICKER] analyst price targets and consensus"`

Extract: Number of analysts, consensus (Buy/Hold/Sell), average target, high/low target, implied upside.

---

## Step 4: Future Growth

**Query:** `"[TICKER] analyst revenue and earnings estimates next 3 years"`

Build a forward estimates summary:

| Year | Revenue Est. | EPS Est. | Revenue Growth | EPS Growth |
|---|---|---|---|---|
| FY+1 | | | | |
| FY+2 | | | | |
| FY+3 | | | | |

**Also assess:**
- What are the primary growth drivers? (expansion, new products, pricing power, market share)
- What could disappoint? (competition, regulation, macro sensitivity)
- Is growth accelerating or decelerating vs. recent history?

---

## Step 5: Past Performance

**Query:** `"[TICKER] historical key ratios 5 years"`

Build a trailing performance table:

| Metric | FY-4 | FY-3 | FY-2 | FY-1 | TTM | Trend |
|---|---|---|---|---|---|---|
| Revenue Growth | | | | | | ↑/→/↓ |
| Net Margin | | | | | | ↑/→/↓ |
| ROE | | | | | | ↑/→/↓ |
| ROIC | | | | | | ↑/→/↓ |
| EPS | | | | | | ↑/→/↓ |

**Assess:**
- Is the business compounding? (consistent ROE/ROIC above cost of capital)
- Is the margin expanding or compressing?
- Has revenue growth been consistent or lumpy?

---

## Step 6: Financial Health

Invoke the `financial-health` skill:
```
skill: financial-health
args: [TICKER]
```

Extract and embed:
- Health verdict (Financially Strong / Adequate / Stretched / Distressed)
- Key metrics table (current ratio, D/E, interest coverage, OCF/debt)
- Any critical warnings

---

## Step 7: Dividends

Invoke the `dividend-analysis` skill:
```
skill: dividend-analysis
args: [TICKER]
```

If the company pays a dividend:
- Extract sustainability verdict and score
- Embed key metrics (yield, FCF payout, 3yr CAGR, coverage)

If no dividend:
- Note buyback yield instead: `buybacks ÷ market cap`
- Assess total shareholder return (dividends + buybacks)

---

## Step 8: Key Risks

### 8.1 Quantitative Red Flags

Scan the data already gathered and flag any of these:
- Debt/EBITDA > 4x
- Interest coverage < 3x
- FCF consistently below net income (earnings quality issue)
- Revenue growth decelerating for 3+ consecutive years
- Operating margin declining 3+ years
- Payout ratio > 90% (for dividend payers)
- Insider selling > buying (check insider trades)
- Earnings misses in last 2+ quarters

### 8.2 Qualitative Risks (from 10-K)

**Query:** `"[TICKER] 10-K risk factors section"`

Use the `read_filings` tool to extract the top 3-5 risk factors as stated in the most recent 10-K annual report. Summarize each in 1-2 sentences (management's own words on what could go wrong).

Prioritize risks that are:
- Specific to this company (not generic industry boilerplate)
- Material to the investment thesis
- Quantified where possible

### 8.3 Risk Summary Table

| Risk | Type | Severity | Notes |
|---|---|---|---|
| [Risk name] | Quantitative/Qualitative | High/Med/Low | [1 sentence] |

---

## Step 9: Investment Narrative

Write a Buffett/Munger-style investment thesis in 3 paragraphs. This is Dexter's original synthesis — not a summary of data, but a judgment:

**Paragraph 1 — The Business**
What does this company actually do, and why does the market care? Describe the business model, competitive position, and any durable advantages (moat). Use plain language. Avoid jargon.

**Paragraph 2 — The Case For and Against**
Balanced view: What makes this an attractive investment at the current price? What are the legitimate bear case arguments? Where does the upside come from? What would have to be true for the bull case to play out? What are the key risks to the thesis?

**Paragraph 3 — The Watch List**
What specific metrics or events should an investor monitor to know if the thesis is on track or breaking down? Think: "If I owned this, what would make me change my mind?" Examples: margin compression, FCF inflection, competitive entry, management change, regulatory development.

---

## Step 10: Final Report Format

```
# [TICKER] — [Company Name]
*Investment Report | [Date]*

---

## Business Overview
[3-4 sentence business summary from Step 1]

**Sector:** [X] | **Market Cap:** $[X]B | **Price:** $[X]

---

## Snowflake Score: [X]/30

  Valuation    [bar]  [X]/6
  Growth       [bar]  [X]/6
  Performance  [bar]  [X]/6
  Health       [bar]  [X]/6
  Dividends    [bar]  [X]/6  [or N/A]

---

## Valuation

**Intrinsic Value (DCF):** $[X] | [Upside/downside]% vs current price $[X]

**Relative Valuation:**
[Multiples comparison table]

**Analyst Consensus:** [Buy/Hold/Sell] | [X] analysts | Avg target $[X] | [X]% upside

---

## Future Growth

[Forward estimates table — revenue, EPS, growth rates]

**Growth Drivers:** [2-3 bullet points]
**Growth Risks:** [2-3 bullet points]

---

## Past Performance

[Trailing metrics table — revenue growth, margins, ROE, ROIC, EPS]

**Assessment:** [2-3 sentences on compounding quality and trend direction]

---

## Financial Health

**Verdict: [Financially Strong / Adequate / Stretched / Distressed]**

[Key health metrics table — current ratio, D/E, interest coverage, OCF/debt]

[Any critical warnings]

---

## Dividends

[If paying:]
**Sustainability: [Safe / Monitor / At Risk / Unsustainable]** | Yield: [X]%

[Key dividend metrics: FCF payout, 3yr CAGR, consistency]

[If no dividend:]
**No dividend.** Buyback yield: [X]%

---

## Key Risks

[Risk summary table from 8.3]

**From 10-K (Management's own risk disclosures):**
1. [Risk 1 — 1-2 sentences]
2. [Risk 2 — 1-2 sentences]
3. [Risk 3 — 1-2 sentences]

---

## Investment Narrative

[Paragraph 1 — The Business]

[Paragraph 2 — The Case For and Against]

[Paragraph 3 — The Watch List]

---

*Analysis based on public filings, market data, and analyst estimates as of [date]. This is research, not financial advice.*
```

---

## Notes

- **Skill chaining:** This skill invokes `company-snapshot`, `dcf-valuation`, `financial-health`, and `dividend-analysis` as sub-skills. The agent should invoke each in sequence as it works through the report. Each skill provides structured output that gets incorporated into the final report.
- **Time estimate:** Full report requires 6-10 tool calls and 3-4 skill invocations. This is Dexter's most thorough single-output task.
- **Partial reports:** If the user asks for a "quick version" or time is limited, skip the DCF (use relative valuation only), use the Snapshot score instead of individual health/dividend skills, and keep the narrative to 1 paragraph.
- **WhatsApp formatting:** If delivering via WhatsApp, condense aggressively — Snapshot score + valuation verdict + key risks + 1-paragraph narrative. Full report is best suited for CLI/desktop.
