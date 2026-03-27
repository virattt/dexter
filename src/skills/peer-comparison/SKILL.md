---
name: peer-comparison
description: >
  Produces a structured side-by-side comparison of a company against its sector
  peers across valuation multiples, growth metrics, and quality indicators.
  Use when the user asks how a company compares to competitors, whether a stock
  is cheap or expensive relative to peers, or wants a peer analysis.
---

# Peer Comparison Skill

Systematic multi-company comparison across valuation, growth, and quality.

## Workflow

### Step 1 — Identify Subject and Peers

**From the query:**
- Extract the subject ticker (the company being evaluated).
- If the user names specific peer tickers (e.g. "compare NVDA to AMD, INTC,
  QCOM"), use those peers exactly — skip auto-discovery.

**Auto-discovery (when no peers specified):**
1. Call `get_financials` for the subject: `"[TICKER] company facts sector industry market cap"`
2. Extract `sector`, `industry`, and `market_cap`.
3. Call `stock_screener` with:
   - `sector` / `industry` matching the subject
   - `market_cap` between 0.25× and 4× the subject's market cap
   - Limit: 5 results
   - Exclude the subject ticker itself
4. Use the returned tickers as the peer group.

---

### Step 2 — Fetch Comparison Metrics

Call `get_financials` once with all tickers in a single query:

**Query:** `"Compare [TICKER1], [TICKER2], [TICKER3] financial metrics: P/E ratio,
EV/EBITDA, price to free cash flow, PEG ratio, revenue growth year over year,
gross margin, return on invested capital, net debt to EBITDA"`

**Extract for each company:**
- `pe_ratio` — trailing P/E
- `ev_to_ebitda`
- `price_to_free_cash_flow`
- `peg_ratio`
- `revenue_growth` — YoY %
- `gross_margin` — %
- `return_on_invested_capital` (ROIC) — %
- `net_debt_to_ebitda`

---

### Step 3 — Build Valuation Table

Present valuation multiples for all companies. For each metric, annotate:
- ↓ (lowest = cheapest) next to the lowest value
- ↑ (highest = priciest) next to the highest value

| Company | P/E | EV/EBITDA | P/FCF | PEG |
|---------|-----|-----------|-------|-----|

Calculate peer median for each column and include a **Peer Median** row.

---

### Step 4 — Build Growth & Quality Table

Present growth and quality metrics. For each column, mark the best-in-class
with ★.

| Company | Rev Growth YoY | Gross Margin | ROIC | Net Debt/EBITDA |
|---------|---------------|-------------|------|-----------------|

---

### Step 5 — Verdict Paragraph

Write 3–4 sentences synthesising the comparison:

1. Where does the subject company trade vs. peer median (premium or discount)?
2. Is that premium/discount justified by its growth or quality advantage?
3. What is the single biggest risk or question mark vs. peers?
4. One-sentence conclusion: attractive, fairly valued, or expensive vs. peers?

---

### Step 6 — Save Report (Optional)

Ask the user: "Save this comparison to ~/reports/[TICKER]-peer-comparison-[date].md?"

If yes, use `write_file` with path `~/reports/[TICKER]-peer-comparison-{YYYY-MM-DD}.md`.
