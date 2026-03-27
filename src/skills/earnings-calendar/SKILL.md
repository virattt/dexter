---
name: earnings-calendar
description: >
  Builds an earnings calendar showing upcoming company report dates with analyst
  consensus estimates, prior-quarter surprise history, and options implied move.
  Use when the user asks about upcoming earnings, earnings this week/next week,
  when a specific company reports, or wants to know which earnings matter soon.
---

# Earnings Calendar Skill

Research upcoming earnings events with consensus estimates and event context.

## Workflow

### Step 1 — Identify Tickers

Parse tickers from the user query.

If no tickers are specified and `.dexter/watchlist.json` exists, use the
tickers from the watchlist as the default scope.

If a sector or index is mentioned (e.g. "tech earnings", "S&P earnings"),
use `stock_screener` to find the top 10 companies by market cap in that
sector, then proceed with those tickers.

---

### Step 2 — Fetch Earnings Data

For each ticker, call `get_financials`:

**Query:** `"[TICKER] earnings date analyst consensus EPS revenue estimates prior quarter surprise"`

**Extract:**
- `earnings_date` / `next_earnings_date` — the upcoming report date
- `estimated_eps` / analyst EPS consensus
- `estimated_revenue` — analyst revenue consensus
- `earnings_surprise_percent` — last quarter's beat/miss percentage
- `eps_actual` vs `eps_estimated` for most recent reported quarter

---

### Step 3 — Fetch Implied Move

For each ticker, call `get_market_data`:

**Query:** `"[TICKER] options implied volatility earnings move"`

**Extract or approximate:**
- If implied volatility (IV) is available: implied move ≈ IV / √52
- If IV unavailable, use `web_search` with query: `"[TICKER] options implied earnings move"`
- Fall back to historical average: check last 4 earnings-day price moves

---

### Step 4 — Sort and Group

Sort events by `earnings_date` ascending.

Group into three buckets:
- **This Week** — reports within the next 7 days
- **Next Week** — reports 8–14 days out
- **Later** — reports 15+ days out

---

### Step 5 — Build Output Table

Present a table with one row per ticker:

| Date | Ticker | Expected EPS | Expected Rev | Prior Surprise | Impl. Move | Key Metric to Watch |
|------|--------|-------------|-------------|----------------|------------|---------------------|

**Key Metric to Watch** — one phrase describing the most important number
or narrative for this company's report (e.g. "cloud revenue growth",
"HBM shipment guidance", "margin recovery trajectory").

Flag with ⚠ any ticker where implied move > 8% (high-volatility event).

---

### Step 6 — Save Report (Optional)

Ask the user: "Save this calendar to ~/reports/earnings-calendar-{date}.md?"

If yes, use `write_file` with path `~/reports/earnings-calendar-{YYYY-MM-DD}.md`.

Format the saved file with a markdown header and the full table.
