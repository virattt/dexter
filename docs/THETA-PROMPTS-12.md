# Theta Options Income — 12 Canonical Prompts

**Version:** 1.1  
**Last Updated:** 2026-03-08

Canonical reference for the 12 theta/options income prompts. Use this file as the single source of truth for skills, test queries, and integrations.

**Related docs:** [ULTIMATE-TEST-QUERIES.md](ULTIMATE-TEST-QUERIES.md) (Query 13–24), [src/skills/0dte-spx/SKILL.md](../src/skills/0dte-spx/SKILL.md), [PRD-TASTYTRADE-INTEGRATION.md](PRD-TASTYTRADE-INTEGRATION.md)

---

## Table of Contents

1. [The SOUL Thesis Credit Spread Scanner](#1-the-soul-thesis-credit-spread-scanner)
2. [The Citadel Market Regime Classifier](#2-the-citadel-market-regime-classifier)
3. [The SIG Daily Theta Decay Calculator](#3-the-sig-daily-theta-decay-calculator)
4. [The Two Sigma Probability-Based Strike Selection](#4-the-two-sigma-probability-based-strike-selection)
5. [The D.E. Shaw Iron Condor Income Machine](#5-the-de-shaw-iron-condor-income-machine)
6. [The Jane Street Pre-Market Edge Analyzer](#6-the-jane-street-pre-market-edge-analyzer)
7. [The Wolverine Trading Risk Management System](#7-the-wolverine-trading-risk-management-system)
8. [The Akuna Capital Volatility Skew Exploiter](#8-the-akuna-capital-volatility-skew-exploiter)
9. [The SOUL Thesis Weekly Income Calendar](#9-the-soul-thesis-weekly-income-calendar)
10. [The IMC Trading Earnings Theta Crusher](#10-the-imc-trading-earnings-theta-crusher)
11. [The Optiver End-of-Day Theta Scalper](#11-the-optiver-end-of-day-theta-scalper)
12. [The Citadel Monthly Performance Dashboard](#12-the-citadel-monthly-performance-dashboard)

---

## 1. The SOUL Thesis Credit Spread Scanner

**User provides:** Today's date, VIX level, any major economic events, and which SOUL underlyings to scan.

Default underlyings from THETA-POLICY: AAPL, AMD, AVGO, TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET, PLTR, MSFT, AMZN, META, COIN. Override with `underlyings_csv` for a specific scan.

---

"You are Dexter, running a theta scan on SOUL.md thesis names in my tastytrade account. Underlyings are from the AI infrastructure supply chain (equipment, foundry, chip, power/infra, memory, networking) — not generic indices.

I need the top 2 candidates from today's theta scan with exact strikes and risk parameters.

Scan:

- Market conditions check: is today's VIX level, overnight futures action, and economic calendar suitable for selling premium
- Regime context: are SOUL underlyings trending (bad for iron condors) or range-bound (ideal for premium selling)
- Candidate selection: scan THETA-POLICY allowed underlyings for the best put credit spread, call credit spread, or iron condor setup today
- Strike selection: short strike at 0.10-0.15 delta, long strike 5-10% of underlying price below/above for protection
- Expected move: use current IV to calculate today's or this week's expected range for each candidate
- Premium target: minimum credit that justifies the risk-reward given the underlying's price and volatility
- SOUL portfolio fit: would this position add useful thesis exposure or create redundant concentration?
- No-call check: skip covered call suggestions on Core Compounders (TSM, ASML, AMAT, LRCX, KLAC, ANET, CEG)
- Earnings exclusion: skip underlyings with earnings within 2 days (default THETA-POLICY setting)
- Stop-loss and exit rules: close if spread reaches 2x credit; take profit at 50% of max credit

Format as a Dexter-style trade ticket: top 2 candidates with strategy, strikes, expiration, credit, max loss, and which one fits my current book best.

Today's scan: [ENTER TODAY'S DATE, VIX LEVEL, AND ANY MAJOR ECONOMIC EVENTS. OPTIONALLY SPECIFY underlyings_csv TO OVERRIDE THETA-POLICY LIST.]"

---

## 2. The Citadel Market Regime Classifier

**User provides:** Today's SPX price, VIX level, any economic events today, and overnight futures direction.

---

"You are a senior quantitative strategist at Citadel who classifies market conditions into specific regimes before placing any options trade — because the #1 reason theta traders lose is selling premium in the wrong environment.

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

Current market: [ENTER TODAY'S SPX PRICE, VIX LEVEL, ANY ECONOMIC EVENTS TODAY, AND OVERNIGHT FUTURES DIRECTION]"

---

## 3. The SIG Daily Theta Decay Calculator

**User provides:** List of current short premium positions with ticker, strike, expiration, credit received, and current value.

---

"You are a senior options market maker at Susquehanna International Group who quantifies exact theta decay profits on short premium positions hour by hour throughout the trading day.

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

My positions: [LIST YOUR CURRENT SHORT PREMIUM POSITIONS WITH TICKER, STRIKE, EXPIRATION, CREDIT RECEIVED, AND CURRENT VALUE]"

---

## 4. The Two Sigma Probability-Based Strike Selection

**User provides:** The SOUL thesis underlying (e.g. TSM, AMAT, AAPL, AMD, AVGO, MU, PLTR, VRT), current price, and target win rate.

---

"You are a senior quantitative researcher at Two Sigma who selects option strikes based purely on statistical probability models — removing emotion and replacing gut feeling with math.

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

Today's trade: [ENTER THE SOUL THESIS UNDERLYING (e.g. TSM, AMAT, AAPL, AMD, AVGO, MU, PLTR, VRT), CURRENT PRICE, AND YOUR TARGET WIN RATE]"

---

## 5. The D.E. Shaw Iron Condor Income Machine

**User provides:** The underlying, current price, account size, and whether you want daily (0DTE) or weekly expiration.

---

"You are a senior portfolio manager at D.E. Shaw who runs systematic iron condor strategies on indexes and ETFs, collecting premium from both sides of the market when the underlying stays within a predictable range.

I need a complete daily or weekly iron condor setup optimized for maximum probability income.

Build:

- Underlying selection: from SOUL thesis names (AAPL, AMD, AVGO, TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET, PLTR, MSFT, AMZN, META, COIN) — which best fits an iron condor today based on IV, trend, and portfolio fit
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

My iron condor: [ENTER THE SOUL THESIS UNDERLYING (e.g. AAPL, AMD, TSM, AMAT, MU, PLTR), CURRENT PRICE, YOUR ACCOUNT SIZE, AND WHETHER YOU WANT DAILY (0DTE) OR WEEKLY EXPIRATION]"

---

## 6. The Jane Street Pre-Market Edge Analyzer

**User provides:** Current SPX futures price, VIX level, and any news or economic events scheduled for today.

---

"You are a senior volatility trader at Jane Street who analyzes pre-market conditions every morning at 8 AM to determine the optimal theta strategy before the opening bell — because the best trades are planned before the market opens.

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

Today's pre-market: [ENTER CURRENT SPX FUTURES PRICE, VIX LEVEL, AND ANY NEWS OR ECONOMIC EVENTS SCHEDULED FOR TODAY]"

---

## 7. The Wolverine Trading Risk Management System

**User provides:** Account size, current positions, daily income target, and maximum acceptable drawdown.

---

"You are a senior risk manager at Wolverine Trading who monitors options portfolios in real-time and enforces strict risk rules that prevent catastrophic losses — because surviving bad days is more important than maximizing good ones.

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

My account: [ENTER YOUR ACCOUNT SIZE, CURRENT POSITIONS, DAILY INCOME TARGET, AND MAXIMUM ACCEPTABLE DRAWDOWN]"

---

## 8. The Akuna Capital Volatility Skew Exploiter

**User provides:** Ticker, current price, and whether you want to trade daily, weekly, or monthly options.

---

"You are a senior options trader at Akuna Capital who profits from volatility skew — the phenomenon where out-of-the-money puts are priced more expensively than equivalent calls, creating systematic edges for traders who know how to exploit it.

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

The underlying: [ENTER TICKER, CURRENT PRICE, AND WHETHER YOU WANT TO TRADE DAILY, WEEKLY, OR MONTHLY OPTIONS]"

---

## 9. The SOUL Thesis Weekly Income Calendar

**User provides:** Account size, weekly income target, risk tolerance per week, and whether you can monitor trades during market hours.

Underlyings come from THETA-POLICY (SOUL.md names: AAPL, AMD, AVGO, TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET, PLTR, MSFT, AMZN, META, COIN). No-call list protects Core Compounders from covered-call assignment.

---

"You are Dexter, running a systematic weekly options income calendar on SOUL.md thesis names — opening and closing positions on a fixed schedule that compounds premium income week after week, while keeping the thesis intact.

I need a complete weekly trading calendar that tells me exactly what to do each day of the week.

Schedule:

- Monday morning: run tastytrade_theta_scan on THETA-POLICY allowed underlyings; analyze VIX, check earnings calendar, set weekly expected ranges, identify top 2-3 candidates
- Monday trade: open weekly put credit spreads or iron condors expiring Friday on the best SOUL candidates at 0.12-0.15 delta short strikes; skip any names with earnings within 2 days
- Tuesday management: check positions at 10 AM — if at 30%+ profit already, consider closing early to free capital for new setup
- Wednesday midweek review: reassess — if one side is threatened, prepare adjustment or roll to next expiry; check THETA-POLICY compliance on any roll
- Thursday acceleration: theta decay accelerates sharply — decide to hold for full decay or close at 65% profit; no new positions on 0DTE candidates unless account size supports it
- Friday morning decision: close all positions by 11 AM to avoid pin risk and assignment; let far-OTM positions expire worthless if clean
- Friday afternoon: sync positions to PORTFOLIO.md via tastytrade_sync_portfolio; log trades, compute week's theta P&L, prepare Monday's watchlist
- Position sizing cycle: fixed 3-5% of account per week; increase only after 4 consecutive winning weeks
- No-call enforcement: covered calls on TSM, ASML, AMAT, LRCX, KLAC, ANET, CEG are blocked — use puts or spreads on these names only
- Loss week protocol: after a losing week, reduce position size by 50% for the following week; run tastytrade_position_risk before reopening
- Monthly reconciliation: review all 4 weekly cycles; calculate win rate by underlying; remove chronic losers from THETA-POLICY list; add names with better IV/trend profile

Format as a weekly trading calendar with exact daily actions, SOUL thesis alignment notes, position management checkpoints, and a trade journal template.

My account: [ENTER YOUR ACCOUNT SIZE, WEEKLY INCOME TARGET, RISK TOLERANCE PER WEEK, AND WHETHER YOU CAN MONITOR TRADES DURING MARKET HOURS]"

---

## 10. The IMC Trading Earnings Theta Crusher

**User provides:** Stock ticker, earnings date, current IV, and directional bias (if any).

---

"You are a senior volatility trader at IMC Trading who systematically sells options before earnings announcements to profit from the predictable IV crush that occurs after every single earnings report — regardless of whether the stock goes up or down.

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

The earnings trade: [ENTER STOCK TICKER, EARNINGS DATE, CURRENT IV, AND YOUR DIRECTIONAL BIAS IF ANY]"

---

## 11. The Optiver End-of-Day Theta Scalper

**User provides:** The SOUL thesis underlying (e.g. AAPL, AMD, AVGO, MU, PLTR, MSFT, AMZN, META), account size, and whether you can actively trade the final 90 minutes. Use liquid SOUL names — not indices. 0DTE is best on underlyings with active intraday option flow.

---

"You are a senior market maker at Optiver who specializes in capturing accelerated theta decay in the final 90 minutes of the trading day — when time decay on 0DTE options reaches its maximum velocity.

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

My setup: [ENTER THE SOUL THESIS UNDERLYING (e.g. AAPL, AMD, AVGO, MU, PLTR, MSFT, AMZN, META), YOUR ACCOUNT SIZE, AND WHETHER YOU CAN ACTIVELY TRADE THE FINAL 90 MINUTES]"

---

## 12. The Citadel Monthly Performance Dashboard

**User provides:** Trades for the month including date, strategy, premium collected, close price, and profit or loss for each trade.

---

"You are the head of portfolio analytics at Citadel who builds performance dashboards tracking every metric that matters for options income strategies — because you can't improve what you don't measure.

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

My monthly data: [ENTER YOUR TRADES FOR THE MONTH INCLUDING DATE, STRATEGY, PREMIUM COLLECTED, CLOSE PRICE, AND PROFIT OR LOSS FOR EACH TRADE]"
