---
name: fintokei-challenge
description: Quantitative Fintokei challenge management using Monte Carlo simulation and statistical optimization. Triggers when user asks about challenge probability, optimal strategy for passing, account health, drawdown risk, or how to optimize their Fintokei challenge approach.
---

# Fintokei Challenge Optimization Skill

## Workflow Checklist

```
Fintokei Challenge Optimization:
- [ ] Step 1: Gather account and performance data
- [ ] Step 2: Statistical performance audit
- [ ] Step 3: Monte Carlo challenge simulation
- [ ] Step 4: Optimal strategy calculation
- [ ] Step 5: Risk budget allocation
- [ ] Step 6: Present quantitative challenge dashboard
```

## Step 1: Gather Account Information

Collect or recall from memory:
- Plan type (ProTrader / SwiftTrader / StartTrader)
- Current phase (1, 2, or funded)
- Initial balance and current balance
- Today's P&L

Call `get_fintokei_rules` for exact challenge constraints.
Call `check_account_health` for current status.

## Step 2: Statistical Performance Audit

Call `get_trade_stats` with `period: "last_30_days"` for the most robust sample.

**Key metrics to extract:**
- Win rate, average win, average loss (in pips and %)
- Sharpe ratio (target: > 0.5 per session)
- Sortino ratio (target: > 1.0 — penalizes only downside volatility)
- Profit factor (target: > 1.5)
- Kelly Criterion (determines maximum safe position size)
- Expected payoff per trade (must be positive)
- Max drawdown from equity curve
- Risk of ruin estimate

**If Kelly Criterion is negative:** The trader has no statistical edge. Recommend stopping trading and analyzing what's going wrong before continuing the challenge.

## Step 3: Monte Carlo Challenge Simulation

**This is the core quantitative analysis.** Using the trader's actual statistics, simulate thousands of possible challenge outcomes.

Call `monte_carlo_simulation` with:
- winRate: from Step 2 (e.g., 0.55)
- avgWinPct: from Step 2 (convert pips to % of account)
- avgLossPct: from Step 2 (convert pips to % of account, negative)
- tradesPerDay: from trade history (calculate average)
- tradingDays: remaining trading days (or 30 for new challenges)
- profitTargetPct: from Fintokei rules (8% for ProTrader Phase 1)
- maxDrawdownPct: from Fintokei rules (10%)
- dailyLossLimitPct: from Fintokei rules (5%)

**Analyze results:**
- P(pass challenge): target > 50%, ideal > 70%
- P(fail by drawdown): the primary risk
- P(fail by daily limit): indicates overtrading or overleveraging
- Median days to pass: for realistic timeline expectations
- P95 max drawdown: worst-case scenario in 95th percentile

## Step 4: Optimal Strategy Calculation

Based on Monte Carlo results, calculate:

### Optimal Risk Per Trade
- Start with Kelly Criterion from Step 2
- Apply half-Kelly (standard conservative approach)
- Verify with Monte Carlo: does half-Kelly produce P(pass) > 50%?
- If not, iterate: try 0.3x Kelly, 0.4x Kelly until optimal found

### Optimal Trades Per Day
- More trades = faster to target BUT higher daily limit risk
- Run Monte Carlo with different tradesPerDay (1, 2, 3, 5) and compare P(pass)
- Find the sweet spot that maximizes P(pass)

### Strategy Selection
Based on Hurst exponent and autocorrelation of the instruments traded:
- If instruments are trending: momentum strategies maximize payoff
- If instruments are mean-reverting: mean-reversion z-score strategies
- If mixed: diversify strategy types

## Step 5: Risk Budget Allocation

### Daily Risk Budget
- Max daily loss: initialBalance × dailyLossLimit%
- Safe daily budget: 60-70% of max (buffer for slippage)
- Per-trade allocation: safeDailyBudget / tradesPerDay

### Drawdown Recovery Protocol
If currently in drawdown, calculate:
- Required gain to recover: DD / (1 - DD)
- Trades needed: requiredGain / expectedPayoffPerTrade
- Days needed: tradesNeeded / tradesPerDay
- Probability of recovery: run Monte Carlo from current equity level

### Near-Target Protocol
If > 70% to profit target:
- Reduce risk to 0.5x current level
- Goal: protect gains, not maximize returns
- Calculate minimum trades needed at reduced risk to reach target

## Step 6: Output — Quantitative Challenge Dashboard

```
FINTOKEI CHALLENGE — QUANTITATIVE ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACCOUNT STATUS
  Plan: ProTrader | Phase 1 | Status: [HEALTHY/WARNING/DANGER]
  Balance: ¥X,XXX,XXX / ¥X,XXX,XXX initial
  Drawdown: X.X% / 10% max | Daily: X.X% / 5% max
  Target Progress: XX.X% of 8% target

PERFORMANCE STATISTICS (Last 30 days)
  Trades: XX | Win Rate: XX.X% | Profit Factor: X.XX
  Sharpe: X.XXX | Sortino: X.XXX | Expected Payoff: X.XX pips
  Kelly Criterion: X.X% | Recommended Risk: X.X%

MONTE CARLO SIMULATION (10,000 paths)
  ┌─────────────────────────────────────┐
  │ P(Pass Challenge):    XX.X%         │
  │ P(Fail Drawdown):     XX.X%         │
  │ P(Fail Daily Limit):  XX.X%         │
  │ Median Days to Pass:  XX days       │
  │ P95 Max Drawdown:     X.X%          │
  └─────────────────────────────────────┘

OPTIMAL PARAMETERS
  Risk per trade: X.X% (half-Kelly)
  Trades per day: X (optimal for P(pass))
  Stop loss: X.X × ATR | Take profit: X.X × ATR

ACTIONABLE RECOMMENDATIONS
  1. [Specific, data-driven recommendation]
  2. [...]
  3. [...]
```
