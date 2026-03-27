---
name: short-thesis
description: >
  Builds a structured bear case for a stock: stretched valuation analysis,
  debt and liquidity risks, competitive threats, insider selling patterns,
  technical weakness, and a bear-case price target. Use when the user asks for
  a short thesis, bear case, reasons to sell, or why a stock might decline.
---

# Short Thesis Skill

Systematic bear-case research. Designed for critical analysis — not a
recommendation to short sell. Always acknowledge risks to the thesis.

## Workflow

### Step 1 — Valuation Stretch Analysis

Call `get_financials`:

**Query:** `"[TICKER] P/E ratio EV/EBITDA price to free cash flow 5-year historical
valuation range sector median multiples"`

**Assess:**
- Current P/E, EV/EBITDA, P/FCF vs. own 5-year historical range
  (is it in the top quartile of its own history?)
- Current multiples vs. sector median (how many standard deviations above?)
- PEG ratio — is the multiple justified by the growth rate?

Conclude: is the stock 1 SD, 2 SD, or more stretched vs. history and peers?

---

### Step 2 — Debt and Liquidity

Call `get_financials`:

**Query:** `"[TICKER] balance sheet debt net debt EBITDA interest coverage ratio
debt maturity schedule cash and equivalents"`

**Extract and evaluate:**
- Net debt / EBITDA: above 3× is elevated; above 5× is a red flag
- Interest coverage ratio (EBIT / interest expense): below 2× is concerning
- Debt maturities in next 24 months — refinancing risk in a high-rate environment
- Free cash flow conversion — can the company service its debt from operations?

---

### Step 3 — Competitive Threats

Use `web_search` and `get_financials` to research:

**Query examples:**
- `"[TICKER] market share trend competitors"`
- `"[TICKER] pricing power customer concentration"`
- `"[COMPANY] competitive threats new entrants [year]"`

**Assess:**
- Is market share growing, stable, or declining?
- Are new entrants or substitutes eroding pricing power?
- Customer concentration risk (is one customer >20% of revenue?)
- Regulatory or antitrust risk

---

### Step 4 — Insider Activity

Call `get_market_data`:

**Query:** `"[TICKER] insider trading Form 4 transactions last 90 days"`

**Extract:**
- Net insider buying or selling over trailing 90 days (count and $ value)
- Any large single-transaction sells by C-suite or board members
- Distinguish planned 10b5-1 sales from discretionary transactions

Classify as: Net buying (bullish signal), Neutral, or Net selling (bearish signal).

---

### Step 5 — Technical Weakness

Call `get_market_data`:

**Query:** `"[TICKER] 52-week high low short interest days to cover"`

**Extract:**
- Distance from 52-week high (% below peak)
- Short interest as % of float
- Days-to-cover (short interest / avg daily volume)
- Whether stock is below key moving averages (if data available)

High short interest + high days-to-cover = crowded short (squeeze risk — note this).

---

### Step 6 — Bear Case Price Target

Using data from Steps 1–5, construct a downside scenario:

1. Identify trough earnings or FCF in a stress scenario (revenue miss + margin compression)
2. Apply a trough multiple (typically 10–30% below current sector median multiple)
3. Bear case price = trough earnings × trough multiple − net debt per share

Present the calculation explicitly.

---

### Step 7 — Risk to the Thesis

What would make this short thesis wrong? Consider:
- A re-acceleration of growth that re-rates the multiple higher
- A strategic buyer or buyout premium
- A product cycle or regulatory win not priced in
- Short squeeze risk (if short interest is elevated)

This section is mandatory — an honest bear case acknowledges its weaknesses.

---

### Step 8 — Save Report

Use `write_file` to save:
- Path: `~/reports/[TICKER]-short-thesis-{YYYY-MM-DD}.md`
- Include a disclaimer: "This is analytical research, not financial advice."
- Include all sections with a header: `# [TICKER] Short Thesis — [Date]`
