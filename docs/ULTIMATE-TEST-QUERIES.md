# Ultimate Test — Portfolio Suggestion & Weekly Performance Tracking

**Version:** 1.0  
**Last Updated:** 2026-03-07

The ultimate test for Dexter: (1) suggest a portfolio aligned with SOUL.md, and (2) track its weekly performance vs BTC, Gold (GLD), and S&P 500 (SPY).

**Quick start:** `bun run start` → paste Query 1 or Query 2 into the terminal.

---

## Prerequisites

1. **Run Dexter:** `bun run start` (or `bun run src/index.tsx`)
2. **PORTFOLIO.md:** Created automatically when you run Query 1 (suggest portfolio). The agent uses the `portfolio` tool to save to `~/.dexter/PORTFOLIO.md`. For Query 2 and 4 (performance tracking), the agent reads this file. If you have existing holdings, you can create it manually or ask the agent to update it.
3. **API keys:** `FINANCIAL_DATASETS_API_KEY` (required for prices). The agent uses `financial_search` → `get_stock_price`, `get_stock_prices`, `get_crypto_price_snapshot`, `get_crypto_prices`.

---

## Query 1 — Suggest a Portfolio

**Purpose:** One-time. Agent uses SOUL.md (thesis, layers, conviction tiers) to propose a near-perfect portfolio and **saves it automatically** to ~/.dexter/PORTFOLIO.md.

**Copy-paste into the Dexter terminal:**

```
Suggest a near-perfect portfolio for me based on your Identity (SOUL.md). Include:
- 8–12 positions across the AI infrastructure supply chain (layers 1–7)
- Layer allocation (chip designers, foundry, equipment, EDA, power, memory, networking)
- Conviction tiering (Core Compounders dominate; Cyclical Beneficiaries add exposure; Speculative Optionality sized small)
- Target weights and rationale for each position
- Regime awareness: any sizing adjustments given current macro (Burry danger signal, etc.)
- Save it to ~/.dexter/PORTFOLIO.md using the portfolio tool
```

**Expected behavior:** Agent reads SOUL.md, uses financial_search for current prices/context, outputs a structured portfolio table, and **calls the portfolio tool to save it automatically** (no copy-paste required).

---

## Query 2 — Weekly Performance Report (vs BTC, Gold, S&P 500)

**Purpose:** Run weekly (e.g. every Monday). Agent compares your portfolio’s performance vs BTC, GLD (Gold), and SPY (S&P 500) over the past week.

**Copy-paste into the Dexter terminal:**

```
Write a weekly performance report for my portfolio. Use ~/.dexter/PORTFOLIO.md for my holdings (or the portfolio you suggested last time). For each position, fetch the price change over the past 7 days (start_date and end_date). Also fetch the 7-day performance for:
- BTC-USD (Bitcoin)
- GLD (Gold ETF)
- SPY (S&P 500 ETF)

Output:
1. Portfolio return (weighted) for the week
2. Benchmark returns: BTC, GLD, SPY
3. Outperformance/underperformance vs each benchmark
4. Best and worst performers in the portfolio
5. One-line takeaway: did the portfolio beat BTC, Gold, and the S&P 500 this week?
```

**Expected behavior:** Agent reads PORTFOLIO.md, calls `get_stock_prices` and `get_crypto_prices` with `start_date` and `end_date` (7 days ago → today), computes weighted portfolio return, compares to benchmarks, and reports.

---

## Query 3 — Combined: Suggest + Track (First Run)

**Purpose:** First-time setup. Suggest a portfolio, then immediately compute what its performance would have been over the past week vs benchmarks (hypothetical backtest).

**Copy-paste into the Dexter terminal:**

```
1. Suggest a near-perfect portfolio (8–12 positions) based on SOUL.md. Output the table.
2. Using that suggested portfolio, compute hypothetical weekly performance: fetch 7-day price changes for each ticker plus BTC-USD, GLD, and SPY. Show weighted portfolio return vs each benchmark. This is a backtest of your suggestion — did it beat BTC, Gold, and the S&P 500 over the past week?
```

---

## Query 4 — Quarterly Performance Report (Extended)

**Purpose:** Run at quarter start (Jan, Apr, Jul, Oct). Full report vs benchmarks.

**Copy-paste into the Dexter terminal:**

```
Write a quarterly performance report for my portfolio. Use ~/.dexter/PORTFOLIO.md. Fetch price data for the past 90 days (or quarter-to-date) for all holdings plus BTC-USD, GLD, and SPY. Include:
- Portfolio return (weighted) for the quarter
- Benchmark returns: BTC, Gold (GLD), S&P 500 (SPY)
- Outperformance/underperformance vs each
- Layer-level attribution: which layers (chip, equipment, power, etc.) contributed or detracted
- Conviction-tier performance: Core Compounders vs Cyclical vs Speculative
- Regime assessment: any sizing adjustments needed?
- Outlook for next quarter
```

---

## Benchmark Tickers Reference

| Benchmark | Ticker | Tool |
|-----------|--------|------|
| Bitcoin | BTC-USD | get_crypto_price_snapshot / get_crypto_prices |
| Gold | GLD | get_stock_price / get_stock_prices |
| S&P 500 | SPY | get_stock_price / get_stock_prices |
| NASDAQ | QQQ | get_stock_price / get_stock_prices |

---

## Date Helpers for Agent

When asking for "past 7 days" or "past 90 days", the agent should compute:
- **End date:** Today (YYYY-MM-DD)
- **Start date:** 7 or 90 days ago

Example (today = 2026-03-07):
- Weekly: start_date=2026-02-28, end_date=2026-03-07
- Quarterly: start_date=2025-12-08, end_date=2026-03-07

---

## Success Criteria (Ultimate Test)

- [ ] Query 1: Agent suggests a coherent portfolio aligned with SOUL.md
- [ ] Query 2: Agent fetches prices, computes weighted return, compares to BTC/GLD/SPY
- [ ] Query 3: Agent suggests + backtests in one run
- [ ] Query 4: Agent produces quarterly report with layer/tier attribution
- [ ] All benchmarks (BTC, GLD, SPY) are included in performance comparison
