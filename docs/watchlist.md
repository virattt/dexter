# Watchlist — Command Reference

Dexter's `/watchlist` command is your portfolio tracker and quick-glance market dashboard. It stores positions locally and can fetch live prices, P&L, analyst targets, and recent news — all without invoking the full LLM agent.

---

## Commands

| Command | What it does |
|---------|-------------|
| `/watchlist` | Run LLM briefing on all positions (calls the agent) |
| `/watchlist add TICKER [cost] [shares]` | Add or update a position |
| `/watchlist remove TICKER` | Remove a position |
| `/watchlist list` | Live-enriched table of all positions |
| `/watchlist show TICKER` | Compact info card for one ticker |
| `/watchlist snapshot` | Portfolio dashboard with allocation chart |

---

## Adding Positions

```
/watchlist add AAPL 182.50 100      # 100 shares at $182.50
/watchlist add NVDA                  # watch-only, no position data
/watchlist add AMD 118 50            # 50 shares at $118
```

- **TICKER** — required, case-insensitive (stored as uppercase)
- **cost** — cost basis per share (optional, but needed for P&L)
- **shares** — number of shares (optional, but needed for P&L and allocation)

Re-adding an existing ticker **updates** it (no duplicate entries).

---

## `/watchlist list` — Enriched Table

Shows all positions with live market data when `FINANCIAL_DATASETS_API_KEY` is set.

### Columns

| Column | Description | Requires |
|--------|-------------|---------|
| TICKER | Ticker symbol | always |
| CURRENT | Live price (closing) | API key |
| DAY% | Intraday change % | API key |
| P&L | Unrealised gain/loss in dollars | cost + shares |
| RETURN | Percentage return vs. cost basis | cost basis |
| ALLOC | This position as % of total portfolio value | cost + shares |

- **Green** = positive P&L / gain
- **Red** = negative P&L / loss
- A **TOTAL** row at the bottom summarises portfolio value and overall return
- Without an API key, the table falls back to showing stored cost basis and shares

**Example output:**
```
  TICKER    CURRENT    DAY%         P&L    RETURN   ALLOC
  ────────────────────────────────────────────────────────
  AMD      $156.20   +1.2%      +$1,910    +32.4%     38%
  IAU       $41.80   -0.3%        +$720    +11.5%     22%
  NVDA     $872.50   +2.1%      +$4,725    +18.9%     40%
  ────────────────────────────────────────────────────────
  TOTAL     $9,870              +$7,355    +28.8%
```

---

## `/watchlist show TICKER` — Info Card

A compact single-ticker panel fetched directly from the API (no agent call):

```
  ┌─ AMD — Advanced Micro Devices ──────────────────────────────
  │ Price: $156.20 (+1.23%)          52-wk: $107.05 – $227.30
  │ Mkt Cap: $253B
  ├──────────────────────────────────────────────────────────────
  │ P/E: 45.2   P/B: 4.1   EV/EBITDA: 32.1   PEG: 1.8
  ├──────────────────────────────────────────────────────────────
  │ Analyst: BUY   Avg Target: $195.00  (+24.8%)
  ├──────────────────────────────────────────────────────────────
  │ (2026-03-26) AMD launches MI350 GPU for AI inference
  │ (2026-03-24) Analyst raises PT to $200 from $180
  │ (2026-03-21) Q1 earnings guide reaffirmed
  └──────────────────────────────────────────────────────────────
```

**Sections:**
1. **Price** — current, day %, 52-week range, market cap
2. **Ratios** — P/E, P/B, EV/EBITDA, PEG (when available)
3. **Analyst** — consensus rating + average price target + upside to target
4. **News** — last 3 headlines with dates

> Tip: Use `/watchlist show TICKER` before asking the agent for a deep-dive — it gives you the key numbers instantly.

---

## `/watchlist snapshot` — Portfolio Dashboard

Shows portfolio-level aggregates and an allocation bar chart:

```
  Portfolio Snapshot — 2026-03-27
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total Invested:  $27,800
  Current Value:   $35,155
  Total P&L:       +$7,355  (+26.5%)

  Allocation:
  AMD    ████████████████████░░░░░░  38%
  NVDA   ████████████████░░░░░░░░░░  40%
  IAU    ████████░░░░░░░░░░░░░░░░░░  22%

  Best:  NVDA   +32.4%
  Worst: IAU    +11.5%

  Watching (no position):
  VALE       $11.40   -0.5%
```

- **Allocation** only includes tickers with both `shares` and `costBasis`
- **Watching** section shows price + day % for watch-only tickers
- Without position data, suggests using `/watchlist add TICKER COST SHARES`

---

## Decision-Making Guide

### What each metric tells you

| Metric | What to look for |
|--------|-----------------|
| **DAY%** | Significant intraday moves (>3%) may signal news or earnings |
| **RETURN** | Your unrealised gain/loss vs. cost basis — context for position sizing |
| **ALLOC%** | Over-concentration risk (>40% in one position warrants review) |
| **P/E** | High relative to sector median → expensive; low → cheap or value trap |
| **EV/EBITDA** | More reliable than P/E for capital-intensive businesses |
| **PEG** | PEG < 1 often considered undervalued relative to growth |
| **Analyst target** | Upside >20% with strong consensus = potential buy thesis |
| **News** | Catalysts (earnings, product launches, regulatory) driving price moves |

### When to use which command

- **Daily check-in**: `/watchlist list` — see all positions at a glance with P&L
- **Researching one stock**: `/watchlist show TICKER` — quick facts before asking the agent
- **Rebalancing review**: `/watchlist snapshot` — allocation % and portfolio totals
- **Deep analysis**: `/watchlist` (bare) — hands off to the LLM agent for full briefing

---

## Storage

Watchlist data is stored locally in `~/.dexter/watchlist.json`:

```json
{
  "version": 1,
  "entries": [
    { "ticker": "AMD",  "costBasis": 118, "shares": 50, "addedAt": "2026-03-01" },
    { "ticker": "NVDA", "costBasis": 735, "shares": 10, "addedAt": "2026-03-05" },
    { "ticker": "VALE",                                  "addedAt": "2026-03-10" }
  ]
}
```

- Data never leaves your machine unless you use the briefing agent
- Edit the JSON directly if you need bulk updates

---

## Requirements

| Feature | Requires |
|---------|---------|
| P&L, RETURN, ALLOC | `costBasis` and `shares` in the entry |
| Live prices | `FINANCIAL_DATASETS_API_KEY` in `.env` |
| Analyst targets | `FINANCIAL_DATASETS_API_KEY` or `TAVILY_API_KEY` |
| News | `FINANCIAL_DATASETS_API_KEY` |
| Fallback | `TAVILY_API_KEY` for web search when FMP unavailable |

Without any API key, `/watchlist list` still shows stored cost basis and shares, and `/watchlist` (bare briefing) works via web search fallback.
