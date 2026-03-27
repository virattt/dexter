---
name: watchlist-briefing
description: >
  Morning briefing for a personal watchlist of stocks. Shows current price,
  intraday change, P&L versus cost basis, distance from 52-week high, next
  earnings date, and analyst rating for each position. Automatically triggered
  by the /watchlist command when holdings are configured.
---

# Watchlist Briefing Skill

Quick portfolio health-check for all tickers in the user's watchlist.

The agent will receive the watchlist context as part of the query in this format:
"Run watchlist briefing for: NVDA (100 shares @ $400.00), MSFT (50 shares @ $380.00)"

Parse all tickers, share counts, and cost basis values from that context.

## Workflow

### Step 1 — Fetch Market Data

Call `get_market_data` for all tickers in a single query:

**Query:** `"[TICKER1] [TICKER2] [TICKER3] current price intraday change
52-week high 52-week low average volume"`

**Extract per ticker:**
- `price` — current price
- `day_change_percent` — intraday % change
- `fifty_two_week_high`
- `fifty_two_week_low`
- `volume` vs `average_volume`

---

### Step 2 — Fetch Fundamental Context

Call `get_financials` for all tickers:

**Query:** `"[TICKERS] next earnings date analyst consensus rating price target"`

**Extract per ticker:**
- `next_earnings_date`
- `analyst_rating` (e.g. "Buy", "Hold", "Sell" or numeric equivalent)
- `analyst_price_target` — consensus 12-month target

---

### Step 3 — Compute P&L

For each ticker that has a `costBasis` in the watchlist context:

```
pnl_percent = (current_price - cost_basis) / cost_basis * 100
```

If no cost basis was provided, show "—" in the P&L column.

---

### Step 4 — Build Output Table

Present a compact table, one row per ticker:

| Ticker | Price | Day % | P&L % | vs 52wk High | Next Earnings | Rating |
|--------|-------|-------|-------|-------------|--------------|--------|

**vs 52wk High** = (price / 52_week_high - 1) × 100, shown as e.g. "-8.3%"

---

### Step 5 — Flags

After the table, print one line per flag (skip if none apply):

- **Intraday move ≥ ±5%:** "⚠ [TICKER] moved [+/-X.X%] today — check for news"
- **Earnings ≤ 7 days:** "📅 [TICKER] reports in [N] days ([date])"
- **P&L > +20%:** "💰 [TICKER] is up [X%] from cost basis — consider reviewing position size"
- **Volume > 2× average:** "📊 [TICKER] trading at [X]× normal volume"

---

### Step 6 — Closing Prompt

End with:
> "Deep-dive available — ask about any ticker for a full analysis, DCF valuation, or peer comparison."

Do not run full analysis unless explicitly requested.
