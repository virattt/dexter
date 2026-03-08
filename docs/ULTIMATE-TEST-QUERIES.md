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
- Prefer high-volume underlyings (NVDA, MU, TSLA, HOOD, CRCL, SNDNK, etc.) for larger weights — see docs/PRD-HYPERLIQUID-PORTFOLIO.md §2.1
- Table format: Ticker | Weight | Category | Notes (so the file is valid for rebalance and performance tracking)
- Exclude pre-IPO (OPENAI, SPACEX, ANTHROPIC) — no FD price data for benchmarking
- Target weights and brief rationale
- Save to ~/.dexter/PORTFOLIO-HYPERLIQUID.md using the portfolio tool with portfolio_id=hyperliquid
```

**Expected behavior:** Agent uses the symbol map, prefers high-volume tickers for larger weights, suggests an on-chain-only allocation in the required table format (no pre-IPO), and **calls portfolio with portfolio_id=hyperliquid** to save automatically.

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

## Theta Options Income Queries (13–24)

**Canonical prompts:** See [THETA-PROMPTS-12.md](THETA-PROMPTS-12.md) for the exact prompt text.

**Prerequisites:** tastytrade integration (Phase 5 recommended) for position risk, option chains, quotes, scan, preview, roll, and repair. Copy [THETA-POLICY.example.md](THETA-POLICY.example.md) to `~/.dexter/THETA-POLICY.md` if you want persistent scan defaults.

### Phase 5 Practical Workflow Queries

Use these first if you want to exercise the actual new tastytrade tools rather than only the canonical reasoning prompts.

**A. Position risk check**

```text
Analyze my live tastytrade options book. Use tastytrade_position_risk and tell me:
- my portfolio theta and delta
- which short options are challenged
- concentration by underlying
- whether any short position looks like assignment risk this week
```

**B. Theta scan**

```text
Scan for the safest theta trade in my tastytrade account today. Use tastytrade_theta_scan with my THETA-POLICY defaults. Focus on SPX, SPY, and QQQ. Return the top 3 candidates with:
- strategy type
- strikes and expiration
- estimated credit
- max loss
- policy notes
- which one best fits my current book
```

**C. Strategy preview**

```text
Run a theta scan for a credit spread, pick the best candidate, then preview it before any submission. Use tastytrade_theta_scan followed by tastytrade_strategy_preview. Show me:
- the chosen candidate
- the full trade memo
- the dry-run result
- your recommendation on whether I should place it
Do not submit anything.
```

**D. Repair challenged short**

```text
Check whether any of my short options need repair. Use tastytrade_position_risk first, then tastytrade_repair_position on the most challenged short option. Tell me whether I should:
- hold
- roll
- close now
- or take assignment
Do not submit anything.
```

**E. Roll short option**

```text
Find my most challenged short put and build a later-dated roll candidate. Use tastytrade_roll_short_option and show:
- current position
- target expiration and strike
- net credit or debit
- dry-run result
- your recommendation
Do not submit anything until I explicitly confirm.
```

---

## Query 13 — 0DTE SPX Credit Spread Scanner (Tastytrade)

**Purpose:** Generate a complete 0DTE trade setup with exact strikes and risk parameters.

```
You are a senior options trader at Tastytrade who specializes in 0DTE (zero days to expiration) SPX credit spreads — the strategy professional theta traders use to generate daily income from time decay on the S&P 500 index.

I need a complete 0DTE trade setup for today's market session with exact strikes and risk parameters.

Scan:
- Market conditions check: is today's VIX level, overnight futures action, and economic calendar suitable for selling premium
- SPX expected move: calculate today's implied expected range using current ATM straddle pricing
- Put credit spread setup: short put strike at 0.10-0.15 delta and long put 5-10 points below for protection
- Call credit spread setup: short call strike at 0.10-0.15 delta and long call 5-10 points above for protection
- Iron condor combination: if conditions favor it, combine both sides for double premium collection
- Premium target: minimum $0.50-$1.00 credit collected per spread to justify the risk-reward
- Risk-reward ratio: maximum loss vs premium collected with a minimum 1:3 reward-to-risk target
- Entry timing: optimal time of day to enter (typically 9:45-10:30 AM after opening volatility settles)
- Stop-loss rules: close the trade if spread reaches 2x the premium collected or if SPX breaches short strike
- Exit strategy: let expire worthless for full profit, or close at 50% profit if reached before 2 PM

Format as a Tastytrade-style 0DTE trade ticket with exact strikes, entry price, max profit, max loss, and time-based exit rules.

Today's setup: [ENTER TODAY'S DATE, CURRENT SPX PRICE, VIX LEVEL, AND ANY MAJOR ECONOMIC EVENTS SCHEDULED TODAY]
```

---

## Query 14 — Market Regime Classifier (Citadel)

**Purpose:** Classify market conditions and recommend which options strategy to run.

```
You are a senior quantitative strategist at Citadel who classifies market conditions into specific regimes before placing any options trade — because the #1 reason theta traders lose is selling premium in the wrong environment.

I need a complete market regime analysis telling me which options strategy to run today.

Classify:
- VIX regime: low (under 15), normal (15-20), elevated (20-30), or crisis (30+) and what each means for premium sellers
- VIX term structure: is the futures curve in contango (normal, good for selling) or backwardation (danger, stop selling)
- Trend assessment: is SPX trending strongly (bad for iron condors) or range-bound (ideal for selling premium)
- Realized vs implied volatility: is IV overpricing actual movement (edge for sellers) or underpricing (danger zone)
- Correlation regime: are stocks moving together (macro-driven, wider spreads needed) or independently (stock-picking works)
- Overnight gap risk: futures positioning and overseas markets suggesting gap up, gap down, or flat open
- Economic event density: is today a Fed day, CPI release, or earnings-heavy session requiring wider strikes or sitting out
- Put-call ratio reading: extreme readings signaling fear (good for selling puts) or complacency (caution on call side)
- Market breadth: advance-decline line and new highs vs lows confirming or contradicting the index direction
- Regime verdict: GREEN (sell premium aggressively), YELLOW (sell premium conservatively with wider strikes), or RED (sit in cash)

Format as a Citadel-style morning regime report with a dashboard summary and specific strategy recommendation for each regime.

Current market: [ENTER TODAY'S SPX PRICE, VIX LEVEL, ANY ECONOMIC EVENTS TODAY, AND OVERNIGHT FUTURES DIRECTION]
```

---

## Query 15 — Theta Decay Calculator (SIG)

**Purpose:** Quantify theta decay profits hour by hour for short premium positions.

```
You are a senior options market maker at Susquehanna International Group who quantifies exact theta decay profits on short premium positions hour by hour throughout the trading day.

I need a complete theta decay analysis showing exactly how much money my positions earn every hour just from time passing.

Calculate:
- Position-level theta: exact dollar amount each open position earns per day from time decay
- Portfolio theta: total daily income across ALL short premium positions combined
- Hourly decay curve: theta doesn't decay evenly — show me which hours of the day I earn the most
- Acceleration zone: when theta decay accelerates dramatically in the final hours before expiration
- Theta-to-delta ratio: am I earning enough theta relative to the directional risk I'm taking
- Weekend theta capture: selling Friday expiration to collect 3 days of theta over the weekend
- Theta vs gamma risk: the exact point where gamma risk outweighs theta income (usually when stock approaches short strike)
- Optimal closing time: the mathematically ideal time to close for profit vs letting positions expire
- Daily income projection: at my current position sizes, expected income per day, per week, and per month
- Compounding model: if I reinvest theta profits into larger positions, projected account growth over 30, 60, and 90 days

Format as a SIG-style theta dashboard with hourly decay schedules, portfolio income summary, and a compounding growth projection.

My positions: [LIST YOUR CURRENT SHORT PREMIUM POSITIONS WITH TICKER, STRIKE, EXPIRATION, CREDIT RECEIVED, AND CURRENT VALUE]
```

---

## Query 16 — Probability-Based Strike Selection (Two Sigma)

**Purpose:** Select option strikes using statistical probability models.

```
You are a senior quantitative researcher at Two Sigma who selects option strikes based purely on statistical probability models — removing emotion and replacing gut feeling with math.

I need a probability-based framework for selecting the exact right strikes for my credit spreads every day.

Select:
- Delta-based probability: translate delta values into approximate probability of expiring out of the money
- Standard deviation mapping: place short strikes at 1.0, 1.5, or 2.0 standard deviations from current price
- Expected move calculation: use current IV to calculate the 1-day, 1-week, and 1-month expected price range
- Historical accuracy test: how often has the implied expected move actually contained the real move over the last 100 sessions
- Strike distance optimization: the sweet spot where premium collected justifies the risk of being breached
- Win rate by delta level: historical win rates at 0.10 delta (90%), 0.15 delta (85%), 0.20 delta (80%), and 0.30 delta (70%)
- Premium decay at each level: how fast premium decays at each delta level (closer = faster decay but higher risk)
- Gap risk adjustment: widen strikes on days with overnight event risk (earnings, Fed, economic data)
- Skew-adjusted selection: when put skew is steep, sell further OTM puts for same premium at wider distance
- Today's exact strikes: based on all factors, the specific short strike and long strike for today's trade

Format as a Two Sigma-style probability matrix with strike recommendations at different confidence levels and today's specific trade setup.

Today's trade: [ENTER THE UNDERLYING (SPX, QQQ, OR STOCK TICKER), CURRENT PRICE, AND YOUR TARGET WIN RATE]
```

---

## Query 17 — Iron Condor Income (D.E. Shaw)

**Purpose:** Build a daily or weekly iron condor setup optimized for maximum probability income.

```
You are a senior portfolio manager at D.E. Shaw who runs systematic iron condor strategies on indexes and ETFs, collecting premium from both sides of the market when the underlying stays within a predictable range.

I need a complete daily or weekly iron condor setup optimized for maximum probability income.

Build:
- Underlying selection: SPX, SPY, QQQ, or IWM — which index is best for iron condors today based on IV and trend
- Expected range calculation: today's or this week's expected move to set my short strikes outside
- Put side construction: short put at 0.10-0.15 delta, long put 5-10 points below, credit collected
- Call side construction: short call at 0.10-0.15 delta, long call 5-10 points above, credit collected
- Total premium collected: combined credit from both sides as my maximum profit
- Maximum loss calculation: width of the wider spread minus total premium collected
- Breakeven prices: the exact upper and lower prices where I start losing money
- Position sizing: number of contracts based on my account size and 2-5% max risk per trade rule
- Adjustment triggers: if the underlying moves to within 30% of a short strike, roll the threatened side
- Profit taking rule: close the entire position at 50% of max profit or manage each side independently

Format as a D.E. Shaw-style iron condor trade plan with a payoff range description, adjustment protocol, and daily income projection.

My iron condor: [ENTER THE UNDERLYING, CURRENT PRICE, YOUR ACCOUNT SIZE, AND WHETHER YOU WANT DAILY (0DTE) OR WEEKLY EXPIRATION]
```

---

## Query 18 — Pre-Market Edge Analyzer (Jane Street)

**Purpose:** Pre-market analysis for optimal theta strategy before the opening bell.

```
You are a senior volatility trader at Jane Street who analyzes pre-market conditions every morning at 8 AM to determine the optimal theta strategy before the opening bell — because the best trades are planned before the market opens.

I need a complete pre-market analysis that tells me exactly what to trade and how to trade it today.

Analyze:
- Overnight futures movement: how much SPX futures moved overnight and whether the gap will hold or fade
- Pre-market IV levels: are options pricing higher or lower volatility compared to yesterday's close
- Economic calendar impact: what reports are released today and their historical impact on market range
- Earnings exposure: which major companies report today and their potential to move the broader market
- Globex range: the overnight high-to-low range in futures as a guide for today's expected range
- Opening gap strategy: if there's a significant gap, will it fill (sell into it) or extend (stay cautious)
- IV crush opportunity: if yesterday was a high-IV event, are there inflated premiums left to sell this morning
- Previous day's close analysis: did the market close at highs (bearish lean), lows (bullish lean), or middle (neutral)
- Support and resistance for today: the 3 key price levels where SPX is likely to bounce or stall
- Pre-market trade plan: the exact strategy, strikes, expiration, and entry time based on all analysis

Format as a Jane Street-style morning briefing with a market assessment, trade plan, and scenario playbook for bull, bear, and neutral outcomes.

Today's pre-market: [ENTER CURRENT SPX FUTURES PRICE, VIX LEVEL, AND ANY NEWS OR ECONOMIC EVENTS SCHEDULED FOR TODAY]
```

---

## Query 19 — Risk Management System (Wolverine Trading)

**Purpose:** Complete risk management rules for daily theta income strategy.

```
You are a senior risk manager at Wolverine Trading who monitors options portfolios in real-time and enforces strict risk rules that prevent catastrophic losses — because surviving bad days is more important than maximizing good ones.

I need a complete risk management system for my daily theta income strategy.

Protect:
- Daily loss limit: the maximum dollar amount I'm allowed to lose in a single day before closing all positions
- Weekly loss limit: cumulative weekly threshold that triggers a trading pause until next Monday
- Position size cap: maximum number of contracts or dollar risk per individual trade (never exceed 2-5% of account)
- Correlation check: am I accidentally running the same directional bet in multiple positions simultaneously
- Tail risk protection: how to hedge against a 3+ standard deviation move that blows through all my short strikes
- VIX spike protocol: specific actions when VIX jumps 20%+ in a single day (close, hedge, or widen strikes)
- Buying power management: never use more than 50% of total buying power so I always have room to adjust
- Rolling vs closing decision tree: when to roll a losing position for recovery vs cutting the loss immediately
- Recovery protocol: after a max loss day, how to reduce size and rebuild confidence systematically
- Monthly drawdown circuit breaker: if monthly losses hit 10% of account, stop trading for the rest of the month

Format as a Wolverine-style risk management manual with hard rules, decision trees, and a daily risk checklist to review before every trading session.

My account: [ENTER YOUR ACCOUNT SIZE, CURRENT POSITIONS, DAILY INCOME TARGET, AND MAXIMUM ACCEPTABLE DRAWDOWN]
```

---

## Query 20 — Volatility Skew Exploiter (Akuna Capital)

**Purpose:** Skew analysis showing mispricing and how to profit from it.

```
You are a senior options trader at Akuna Capital who profits from volatility skew — the phenomenon where out-of-the-money puts are priced more expensively than equivalent calls, creating systematic edges for traders who know how to exploit it.

I need a complete skew analysis showing where the mispricing exists and how to profit from it.

Exploit:
- Current skew measurement: the IV difference between OTM puts and OTM calls at the same delta
- Skew percentile: is today's skew steep (fearful), flat (complacent), or inverted (extremely unusual)
- Put skew advantage: when puts are overpriced, sell put spreads to collect inflated premium
- Call skew opportunity: when call skew is flat, sell call spreads cheaply as upside hedges for existing put spreads
- Jade lizard strategy: sell an OTM put and a call spread simultaneously to eliminate upside risk entirely
- Broken wing butterfly: place an asymmetric butterfly that profits from skew normalization
- Ratio spread opportunity: sell 2 OTM options against 1 ATM option when skew creates favorable pricing
- Skew mean-reversion trade: when skew hits extreme levels, position for it to snap back to normal
- Term structure skew: compare skew between weekly and monthly expirations for calendar spread opportunities
- Risk of skew expansion: what could make skew steepen further (crash risk) and how to protect against it

Format as an Akuna-style skew analysis with skew charts described, strategy recommendations, and specific trade setups.

The underlying: [ENTER TICKER, CURRENT PRICE, AND WHETHER YOU WANT TO TRADE DAILY, WEEKLY, OR MONTHLY OPTIONS]
```

---

## Query 21 — SPY Weekly Income Calendar (Peak6)

**Purpose:** Systematic weekly options income calendar with exact daily actions.

```
You are a senior income portfolio manager at Peak6 who runs a systematic weekly options income calendar on SPY — opening and closing positions on a fixed schedule that compounds premium income week after week.

I need a complete weekly trading calendar that tells me exactly what to do each day of the week.

Schedule:
- Monday morning: analyze VIX, check economic calendar, set weekly expected range, and identify optimal strikes
- Monday trade: open a weekly put credit spread or iron condor expiring Friday at 0.12-0.15 delta short strikes
- Tuesday management: check positions at 10 AM — if at 30%+ profit already, consider closing early to free capital
- Wednesday midweek review: reassess market direction — if one side is threatened, prepare adjustment or roll
- Thursday acceleration: theta decay accelerates sharply — decide to hold for full decay or close at 65% profit
- Friday morning decision: close all positions by 11 AM to avoid pin risk, or let OTM options expire worthless
- Friday afternoon: review the week's performance, log all trades, and prepare Monday's watchlist
- Position sizing cycle: use fixed percentage of account per week (3-5%) and increase only after 4 consecutive winning weeks
- Loss week protocol: after a losing week, reduce position size by 50% for the following week
- Monthly reconciliation: review all 4 weekly cycles, calculate actual win rate, and adjust delta levels if needed

Format as a Peak6-style weekly trading calendar with exact daily actions, position management checkpoints, and a trade journal template.

My account: [ENTER YOUR ACCOUNT SIZE, WEEKLY INCOME TARGET, RISK TOLERANCE PER WEEK, AND WHETHER YOU CAN MONITOR TRADES DURING MARKET HOURS]
```

---

## Query 22 — Earnings IV Crush Strategy (IMC Trading)

**Purpose:** Systematic earnings IV crush strategy for upcoming earnings events.

```
You are a senior volatility trader at IMC Trading who systematically sells options before earnings announcements to profit from the predictable IV crush that occurs after every single earnings report — regardless of whether the stock goes up or down.

I need a complete earnings IV crush strategy for an upcoming earnings event.

Crush:
- Pre-earnings IV expansion: how many days before earnings IV typically starts inflating for this stock
- Optimal entry timing: the ideal day to sell premium (usually 1-3 days before earnings when IV peaks)
- Historical IV crush magnitude: average percentage drop in IV after earnings for this specific stock over the last 8 reports
- Strategy selection: iron condor (neutral), strangle (neutral), or single-side spread (directional lean)
- Strike placement: use the expected move to set strikes just outside the anticipated post-earnings range
- Premium collected vs historical move: is the premium rich enough to absorb the stock's typical earnings move
- Position sizing for earnings: reduce to 1-2% risk per trade because earnings are binary events
- Post-earnings management: close immediately at the open the morning after earnings for IV crush profit
- Assignment risk management: if selling American-style options, account for early assignment risk into earnings
- Earnings season calendar: the next 5 earnings events with suitable IV crush setups and optimal entry dates

Format as an IMC-style earnings volatility trade plan with historical IV crush data, strategy selection, and a post-earnings exit protocol.

The earnings trade: [ENTER STOCK TICKER, EARNINGS DATE, CURRENT IV, AND YOUR DIRECTIONAL BIAS IF ANY]
```

---

## Query 23 — End-of-Day Theta Scalper (Optiver)

**Purpose:** Capture accelerated theta decay in the final 90 minutes of the trading day.

```
You are a senior market maker at Optiver who specializes in capturing accelerated theta decay in the final 90 minutes of the trading day — when time decay on 0DTE options reaches its maximum velocity.

I need a complete end-of-day theta scalping strategy for 0DTE options.

Scalp:
- Entry window: open positions between 2:30-3:00 PM when theta acceleration enters its steepest curve
- Strike selection: sell credit spreads at the nearest OTM strike with 0.08-0.12 delta for high probability
- Premium target: collect minimum $0.30-$0.50 per spread with 90 minutes to expiration
- Rapid decay math: calculate exactly how much premium will decay in each 15-minute block until 4:00 PM
- Gamma awareness: this close to expiration, delta can swing wildly — keep positions small
- Hard stop-loss: if the spread moves to 1.5x credit received, close immediately with no exceptions
- Scaling strategy: start with 1-2 contracts and add only after 3 consecutive winning sessions
- Market-on-close risk: be fully closed by 3:50 PM to avoid settlement surprises
- Daily P&L log: track every trade with entry time, premium, close time, and profit or loss
- Win rate tracking: maintain a rolling 20-trade win rate — if it drops below 70%, pause and reassess

Format as an Optiver-style intraday scalping playbook with a minute-by-minute timeline, entry criteria, and a risk management checklist.

My setup: [ENTER THE UNDERLYING (SPX, SPY, QQQ), YOUR ACCOUNT SIZE, AND WHETHER YOU CAN ACTIVELY TRADE THE FINAL 90 MINUTES]
```

---

## Query 24 — Monthly Performance Dashboard (Citadel)

**Purpose:** Complete monthly performance tracking system for theta income strategy.

```
You are the head of portfolio analytics at Citadel who builds performance dashboards tracking every metric that matters for options income strategies — because you can't improve what you don't measure.

I need a complete monthly performance tracking system for my theta income strategy.

Track:
- Total monthly premium collected: gross income from all short options positions before adjustments
- Total monthly realized P&L: net profit after winning trades, losing trades, and adjustments
- Win rate: percentage of trades that were profitable out of total trades placed
- Average winner vs average loser: ratio between typical winning trade and typical losing trade in dollars
- Profit factor: total dollars won divided by total dollars lost (above 1.5 is professional grade)
- Maximum drawdown: largest peak-to-trough decline during the month
- Sharpe ratio estimate: risk-adjusted return measuring consistency of daily income
- Theta harvested vs realized: how much theta income was available vs how much I actually captured
- Best and worst trade analysis: what made the best trade work and what went wrong on the worst trade
- Strategy-level breakdown: P&L separated by strategy type (0DTE spreads, weekly iron condors, earnings plays)
- Equity curve: running account balance plotted day by day showing growth trajectory and drawdowns
- Next month adjustment plan: based on this month's data, what to change for better results next month

Format as a Citadel-style monthly performance report with metrics dashboard, equity curve description, and strategy-level attribution analysis.

My monthly data: [ENTER YOUR TRADES FOR THE MONTH INCLUDING DATE, STRATEGY, PREMIUM COLLECTED, CLOSE PRICE, AND PROFIT OR LOSS FOR EACH TRADE]
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
- [ ] Queries 13–24: Theta options income — agent follows workflow (tastytrade Phase 2 for full data; until then uses FD + web_search + user-provided inputs)

---

## Essay Workflow

See [ESSAY-WORKFLOW.md](ESSAY-WORKFLOW.md) for the full loop: Dexter → Claude → Substack → SOUL.md updates. For the Hyperliquid portfolio, use Query 10 (HL reflection essay) and Query 11 (HL investor letter) with QUARTERLY-REPORT-HL-*.md.
