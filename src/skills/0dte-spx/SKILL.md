---
name: 0dte-spx
description: >
  0DTE SPX/SPY credit spread scanner and end-of-day theta scalper. Use when user asks for
  0DTE setup, SPX credit spread, theta scalping, "today's 0DTE trade", EOD theta,
  "scalp theta end of day", or wants a Tastytrade-style 0DTE trade ticket with exact strikes.
---

# 0DTE SPX Credit Spread Skill

Professional theta strategy for 0DTE (zero days to expiration) SPX/SPY credit spreads.
Two workflows: **Morning Setup** (9:45–10:30 AM entry) and **EOD Scalper** (2:30–3:00 PM entry).

---

## Workflow Selection

| Time / Intent | Workflow | Use When |
|---------------|----------|----------|
| Morning, "today's setup", "0DTE trade" | Morning Setup | User wants full-day 0DTE trade with put/call spreads or iron condor |
| Afternoon, "EOD scalper", "theta scalp" | EOD Scalper | User wants to capture final 90 minutes of theta decay |

---

## Morning Setup Workflow

### Step 1: Gather Market Data

Use `financial_search` or tastytrade tools (when available):

- **SPX/SPY price** — Current level
- **VIX** — Current level (or VIX proxy via SPY options IV)
- **Economic calendar** — Fed, CPI, earnings today (use `web_search` if needed)
- **Overnight futures** — Direction (gap up/down/flat) — `web_search` for "SPX futures overnight"

### Step 2: Market Conditions Check

Assess suitability for selling premium:

- **VIX < 15** — Low vol; premium thin but low risk
- **VIX 15–20** — Normal; good for credit spreads
- **VIX 20–30** — Elevated; wider strikes, smaller size
- **VIX 30+** — Crisis; consider sitting out or very wide strikes
- **Economic events** — Fed day, CPI, major earnings → wider strikes or skip

### Step 3: Expected Move

- Use ATM straddle pricing to estimate today's implied range
- If tastytrade option chain available: sum of ATM call + put ≈ expected move
- Otherwise: `expected_move ≈ price × (VIX/100) × sqrt(1/365)` as rough proxy

### Step 4: Put Credit Spread Setup

- **Short put strike:** 0.10–0.15 delta (≈90% probability OTM)
- **Long put strike:** 5–10 points below short put for protection
- **Premium target:** $0.50–$1.00 minimum credit per spread
- **Risk-reward:** Minimum 1:3 (premium collected vs max loss)

### Step 5: Call Credit Spread Setup

- **Short call strike:** 0.10–0.15 delta
- **Long call strike:** 5–10 points above short call
- Same premium and risk-reward targets

### Step 6: Iron Condor (Optional)

If conditions favor range-bound (VIX normal, no major events): combine put + call spreads for double premium.

### Step 7: Entry, Stop, Exit Rules

- **Entry:** 9:45–10:30 AM after opening volatility settles
- **Stop-loss:** Close if spread reaches 2× premium collected OR if SPX breaches short strike
- **Exit:** Let expire worthless for full profit, or close at 50% profit if reached before 2 PM

### Step 8: Output Format

Present as Tastytrade-style trade ticket:

```
## 0DTE SPX Trade Ticket — [DATE]

**Market:** SPX [price], VIX [level]
**Regime:** [GREEN/YELLOW/RED]

### Put Credit Spread
- Short put: [strike] (delta ~0.12)
- Long put: [strike]
- Credit: $[X] per spread
- Max loss: $[Y]
- R:R = 1:[Z]

### Call Credit Spread
- Short call: [strike] (delta ~0.12)
- Long call: [strike]
- Credit: $[X] per spread
...

### Iron Condor (if applicable)
- Total credit: $[X]
- Breakevens: [lower] / [upper]
- Max loss: $[Y]

### Rules
- Entry: 9:45–10:30 AM
- Stop: 2× premium or short strike breach
- Exit: 50% profit or expire
```

---

## EOD Theta Scalper Workflow

### Step 1: Confirm Timing

User must be able to trade 2:30–3:50 PM. If not, recommend morning setup instead.

### Step 2: Gather Data

- **Underlying:** SPX, SPY, or QQQ
- **Current price**
- **Account size** — For position sizing

### Step 3: Strike Selection

- **Short strike:** Nearest OTM at 0.08–0.12 delta (high probability)
- **Long strike:** 5 points away for protection
- **Premium target:** $0.30–$0.50 per spread (90 min to expiration)

### Step 4: Rapid Decay Math

- Theta accelerates in final 2 hours
- Estimate decay per 15-min block (2:30, 2:45, 3:00, 3:15, 3:30, 3:45)
- Gamma risk: delta can swing wildly — keep size small (1–2 contracts to start)

### Step 5: Risk Rules

- **Hard stop:** Close if spread reaches 1.5× credit received
- **Must be closed by 3:50 PM** — Avoid pin risk and settlement surprises
- **Scaling:** Add contracts only after 3 consecutive winning sessions
- **Win rate:** If rolling 20-trade win rate drops below 70%, pause

### Step 6: Output Format

```
## EOD Theta Scalp — [DATE]

**Underlying:** [SPX/SPY/QQQ]
**Entry window:** 2:30–3:00 PM
**Close by:** 3:50 PM

### Setup
- Short strike: [strike] (delta ~0.10)
- Long strike: [strike]
- Target credit: $0.30–$0.50
- Size: 1–2 contracts (scale after 3 wins)

### 15-Min Decay Estimate
| Time  | Est. value |
|-------|------------|
| 2:30  | [X]        |
| 2:45  | [X]        |
| ...   |            |

### Rules
- Stop: 1.5× credit
- Close by 3:50 PM
- Log: entry time, premium, close time, P&L
```

---

## Data Source Fallbacks

Until tastytrade Phase 2 is integrated:

- **SPX/SPY price:** `financial_search` → `get_stock_price` for SPY
- **VIX:** `web_search` for "VIX level today" or user-provided
- **Option chain / Greeks / IV:** User-provided or `web_search` for "SPY option chain"
- **Economic events:** `web_search` for "economic calendar today"

When tastytrade tools exist: use `tastytrade_option_chain`, `tastytrade_quote`, `tastytrade_market_metrics` for precise strikes and Greeks.
