---
name: sector-overview
description: >
  Produces a comprehensive sector analysis: macro backdrop, top companies by
  market cap with YTD performance, valuation spread, recent catalysts, and
  three actionable investment ideas. Use when the user asks for a sector
  overview, sector analysis, what is happening in an industry, or wants to
  understand the investment landscape for a specific sector.
---

# Sector Overview Skill

Top-down sector analysis from macro backdrop to actionable investment ideas.

## Workflow

### Step 1 — Macro Backdrop

Use `web_search` to research the macro environment relevant to this sector:

**Queries (adapt to sector):**
- For rate-sensitive sectors (financials, utilities, REITs):
  `"Federal Reserve interest rate outlook [year] impact on [sector]"`
- For cyclical sectors (industrials, materials, energy):
  `"PMI manufacturing index [year] [sector] demand outlook"`
- For tech/growth:
  `"AI infrastructure spending [year]"` or relevant capex trend
- General:
  `"[sector] sector macro tailwinds headwinds [year]"`

Summarise in 3–4 sentences: what macro forces are helping, what are hurting.

---

### Step 2 — Top Companies

Call `stock_screener` to find the top 5 companies by market cap in this sector.

Then call `get_market_data` for all 5:

**Query:** `"[TICKER1] [TICKER2] [TICKER3] [TICKER4] [TICKER5] YTD performance price"`

**Extract:**
- Current price and market cap
- YTD price return %
- 52-week high and low

Present as a table:

| Ticker | Market Cap | YTD % | 52wk Range | Recent News (1 line) |
|--------|-----------|-------|-----------|---------------------|

---

### Step 3 — Valuation Spread

Call `get_financials` for all 5 top companies:

**Query:** `"[TICKERS] P/E ratio EV/EBITDA forward P/E"`

**Compute:**
- Sector median P/E (or forward P/E)
- The 2 cheapest names vs. median and why
- The 2 most expensive names vs. median and why
- Is the sector as a whole cheap, fair, or expensive vs. its 5-year history?

---

### Step 4 — Recent Catalysts (Last 30 Days)

Use `web_search` to surface significant events:

**Queries:**
- `"[sector] sector M&A acquisitions [last 30 days / current month year]"`
- `"[sector] regulatory news earnings surprise [current month year]"`
- `"[sector] major news [current month year]"`

Summarise the 3–5 most significant events and their market impact.

---

### Step 5 — Three Actionable Ideas

Based on the valuation spread and recent catalysts, identify:

1. **Value play** — a company trading at a meaningful discount to sector median
   with a credible re-rating catalyst
2. **Growth compounder** — the company with the strongest revenue growth and
   quality metrics even if it trades at a premium
3. **Contrarian idea** — a name that is out of favour (YTD underperformer, or
   heavily shorted) but has a potential positive catalyst

For each idea: one sentence thesis + one sentence risk.

---

### Step 6 — Sector Risks (Next 12 Months)

List 3–5 risks specific to this sector that are not yet fully priced in.
These should be concrete and falsifiable (not generic "macro uncertainty").

Examples: "Fed rate cuts slower than expected hitting bank NIM", "China
export controls on advanced chips", "GLP-1 drugs reducing medical device demand".

---

### Step 7 — Save Report

Use `write_file` to save:
- Path: `~/reports/sector-[sector-name]-overview-{YYYY-MM-DD}.md`
- Include a header: `# [Sector] Sector Overview — [Date]`
- Include all sections above
