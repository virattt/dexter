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
- YTD and since-inception (if performance_history has data): compute and include vs BTC, SPY, GLD
- Save the report to ~/.dexter/QUARTERLY-REPORT-YYYY-QN.md using the save_report tool (e.g. QUARTERLY-REPORT-2026-Q1.md)
- Call performance_history record_quarter to append this quarter's returns (period, portfolio, btc, spy, gld as decimals)
```

**Expected behavior:** Agent fetches 90-day prices, computes attribution, writes the report, and **saves it to ~/.dexter/** via the save_report tool for the essay workflow.

---

## Query 5 — Reflection Essay Draft (After Quarterly Report)

**Purpose:** Run after Query 4. Turns the quarterly report into a 600–800 word essay draft ready for Substack. Paste the quarterly report output (or load from ~/.dexter/QUARTERLY-REPORT-*.md) and ask for the reflection.

**Copy-paste into the Dexter terminal:**

```
Using the quarterly performance report (from ~/.dexter/QUARTERLY-REPORT-*.md or the report you just produced), write a 600–800 word reflection essay. Structure:
1. What the numbers say about our thesis — which layers validated, which didn't
2. The regime problem — what BTC/Gold/SPY told us
3. The machine's recommendation — sizing adjustments and why
4. One sentence that captures the tension between thesis and regime

Voice: structural thinking, precise numbers, blunt assessment. Example: "The equipment thesis worked. AMAT contributed +1.69 points. ASML contributed +1.24 points. The 'sell picks and shovels' framing validated better than the chip designer sleeve." No hype. No permission. Output markdown ready for editing in Claude or direct publish.
```

**Expected behavior:** Agent reads the saved report (or uses context from a prior Query 4 run), produces an essay draft. Copy to Claude for polish, then publish. See [ESSAY-WORKFLOW.md](ESSAY-WORKFLOW.md).

---

## Query 6 — Weekly Newsletter Snippet (Standalone)

**Purpose:** Manual run when you want a Substack draft without waiting for the heartbeat. Uses same logic as heartbeat's weekly draft.

**Copy-paste into the Dexter terminal:**

```
Write a 150–250 word weekly newsletter snippet for my portfolio. Use ~/.dexter/PORTFOLIO.md. Fetch 7-day performance for holdings plus BTC-USD, GLD, SPY. Include: regime (risk-on/risk-off/mixed), portfolio vs benchmarks, best/worst performers, one takeaway. Voice: structural, precise numbers, no hype (VOICE.md). Save to ~/.dexter/WEEKLY-DRAFT-YYYY-MM-DD.md via save_report.
```

---

## Query 7 — Investor Letter (From Quarterly Report)

**Purpose:** Turn the quarterly report into a structured investor letter format for LPs or subscribers.

**Copy-paste into the Dexter terminal:**

```
Using the quarterly performance report from ~/.dexter/QUARTERLY-REPORT-*.md (or the report you just produced), write an investor letter. Structure:
1. Performance — portfolio vs BTC, SPY, GLD; YTD and since-inception if available
2. Attribution — which layers contributed/detracted; conviction-tier performance
3. Regime — what the quarter told us; risk-on vs risk-off
4. Outlook — positioning for next quarter; sizing adjustments

Voice: structural, precise numbers, no hype (VOICE.md). Output markdown.
```

---

## Query 8 — Suggest Hyperliquid Portfolio (On-Chain, HIP-3)

**Purpose:** Suggest a portfolio of only tickers tradeable 24/7 on Hyperliquid (HIP-3). No fiat conversion; tax-friendly; faster settlement. Saves to ~/.dexter/PORTFOLIO-HYPERLIQUID.md.

**Copy-paste into the Dexter terminal:**

```
Suggest a Hyperliquid portfolio for me — only tickers available on HIP-3 (on-chain stocks, indices, commodities). Use docs/HYPERLIQUID-SYMBOL-MAP.md for the HL→FD ticker mapping. Include:
- 8–12 positions from the HL universe (stocks like NVDA/PLTR, commodities via ETFs like GLD/SLV/USO, indices via proxies like SPY/SMH)
- Target weights and brief rationale
- Save to ~/.dexter/PORTFOLIO-HYPERLIQUID.md using the portfolio tool with portfolio_id=hyperliquid
```

**Expected behavior:** Agent uses the symbol map, suggests an on-chain-only allocation, and **calls portfolio with portfolio_id=hyperliquid** to save automatically.

---

## Query 9 — Weekly Performance: Hyperliquid Portfolio

**Purpose:** Track the Hyperliquid portfolio's weekly performance vs SPY, GLD, BTC — and optionally vs the HL basket.

**Copy-paste into the Dexter terminal:**

```
Write a weekly performance report for my Hyperliquid portfolio. Use ~/.dexter/PORTFOLIO-HYPERLIQUID.md. Map HL symbols to FD tickers per docs/HYPERLIQUID-SYMBOL-MAP.md. Fetch 7-day price changes for each position plus BTC-USD, GLD, SPY. Output: portfolio return, benchmark returns, best/worst performers, one-line takeaway.
```

---

## Query 10 — Hyperliquid Reflection Essay (From HL Quarterly Report)

**Purpose:** Turn the Hyperliquid quarterly report into a 600–800 word reflection essay for HIP-3 / on-chain stocks narrative. Same structure as Query 5 but for the HL portfolio.

**Copy-paste into the Dexter terminal:**

```
Using the Hyperliquid quarterly report from ~/.dexter/QUARTERLY-REPORT-HL-*.md (or the HL report you just produced), write a 600–800 word reflection essay on the on-chain stocks thesis. Structure:
1. What the numbers say — which HIP-3 categories validated (Core, L1, AI infra, tokenization), which didn't
2. The regime problem — what BTC/Gold/SPY told us for on-chain exposure
3. The machine's recommendation — sizing adjustments for the HL portfolio
4. One sentence that captures the tension between on-chain optionality and regime risk

Voice: structural thinking, precise numbers, blunt assessment. No hype. Output markdown ready for Claude polish or direct publish.
```

---

## Query 11 — Hyperliquid Investor Letter

**Purpose:** Turn the HL quarterly report into a structured investor letter for LPs or subscribers focused on the on-chain portfolio.

**Copy-paste into the Dexter terminal:**

```
Using the Hyperliquid quarterly report from ~/.dexter/QUARTERLY-REPORT-HL-*.md, write an investor letter for the on-chain portfolio. Structure:
1. Performance — HL portfolio vs BTC, SPY, GLD; YTD and since-inception if available
2. Attribution — which HIP-3 categories contributed/detracted (Core, L1, AI infra, tokenization)
3. Regime — what the quarter told us for on-chain exposure
4. Outlook — positioning for next quarter; sizing adjustments

Voice: structural, precise numbers, no hype (VOICE.md). Output markdown.
```

---

## Query 12 — Quarterly Report: Hyperliquid Only (Standalone)

**Purpose:** Run at quarter start when you want a dedicated HL report without the main portfolio. Same as heartbeat's HL report but manual.

**Copy-paste into the Dexter terminal:**

```
Write a quarterly performance report for my Hyperliquid portfolio only. Use ~/.dexter/PORTFOLIO-HYPERLIQUID.md. Map HL symbols to FD tickers per docs/HYPERLIQUID-SYMBOL-MAP.md. Fetch quarter-to-date (or 90-day) prices for each position plus BTC-USD, GLD, SPY. Include:
- Portfolio return vs BTC, SPY, GLD (and hl_basket if computable)
- Category attribution: Core, L1, AI infra, tokenization
- Best and worst performers
- Regime assessment and outlook
- YTD and since-inception if performance_history has data
- Save to ~/.dexter/QUARTERLY-REPORT-HL-YYYY-QN.md via save_report
- Call performance_history record_quarter with portfolio_hl (and optionally hl_basket)
```

---

## Benchmark Tickers Reference

| Benchmark | Ticker | Tool |
|-----------|--------|------|
| Bitcoin | BTC-USD | get_crypto_price_snapshot / get_crypto_prices |
| Gold | GLD | get_stock_price / get_stock_prices |
| S&P 500 | SPY | get_stock_price / get_stock_prices |
| NASDAQ | QQQ | get_stock_price / get_stock_prices |
| HL basket | See HYPERLIQUID-SYMBOL-MAP.md | Map HL symbols → FD tickers, then get_stock_prices |

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
- [ ] Query 4: Agent produces quarterly report with layer/tier attribution and saves to ~/.dexter/
- [ ] Query 5: Agent produces essay draft from quarterly report
- [ ] All benchmarks (BTC, GLD, SPY) are included in performance comparison
- [ ] Query 8: Agent suggests Hyperliquid portfolio and saves to PORTFOLIO-HYPERLIQUID.md
- [ ] Query 9: Agent tracks HL portfolio performance using symbol map
- [ ] Query 10: Agent produces HL reflection essay from QUARTERLY-REPORT-HL-*.md
- [ ] Query 11: Agent produces HL investor letter from QUARTERLY-REPORT-HL-*.md
- [ ] Query 12: Agent produces standalone HL quarterly report and saves to QUARTERLY-REPORT-HL-*.md

---

## Essay Workflow

See [ESSAY-WORKFLOW.md](ESSAY-WORKFLOW.md) for the full loop: Dexter → Claude → Substack → SOUL.md updates. For the Hyperliquid portfolio, use Query 10 (HL reflection essay) and Query 11 (HL investor letter) with QUARTERLY-REPORT-HL-*.md.
