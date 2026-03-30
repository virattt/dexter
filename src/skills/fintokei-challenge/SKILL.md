---
name: fintokei-challenge
description: Fintokei challenge management and tracking. Triggers when user asks about their challenge progress, account health, drawdown status, daily loss remaining, how to pass the challenge, challenge strategy, or wants to evaluate their Fintokei account status.
---

# Fintokei Challenge Management Skill

## Workflow Checklist

```
Fintokei Challenge Check:
- [ ] Step 1: Gather account information
- [ ] Step 2: Check account health against rules
- [ ] Step 3: Analyze recent trading performance
- [ ] Step 4: Calculate remaining risk budget
- [ ] Step 5: Generate recommendations
- [ ] Step 6: Present challenge dashboard
```

## Step 1: Gather Account Information

Ask the user for (or recall from memory):
- **Plan type**: ProTrader, SwiftTrader, or StartTrader
- **Current phase**: Phase 1 (Challenge), Phase 2 (Verification), or Funded
- **Account size**: Initial balance (e.g., 2,000,000 JPY)
- **Current balance**: Current equity
- **Today's P&L**: Profit/loss for today

If the user hasn't provided this, use `memory_search` to check if it was stored previously.

Then call `get_fintokei_rules` to get the exact rules for their plan:
**Tool call:** `get_fintokei_rules` with `plan: "[their_plan]"`

## Step 2: Check Account Health

Call `check_account_health` with the gathered information:

**Parameters:**
- accountBalance: [current balance]
- accountCurrency: JPY (or USD)
- initialBalance: [initial balance]
- currentPnl: [current balance - initial balance]
- todayPnl: [today's P&L]
- plan: [their plan]
- phase: [current phase number]

## Step 3: Analyze Recent Trading Performance

Call `get_trade_stats` to review recent performance:

**Query 1:** `get_trade_stats` with `period: "this_week"` — Weekly performance snapshot
**Query 2:** `get_trade_stats` with `period: "last_30_days"` — Monthly trend

**Key metrics to evaluate:**
- Win rate (target: > 50% for 1:2+ R:R trades)
- Average R:R ratio (target: > 1.5)
- Profit factor (target: > 1.5)
- Trading frequency (avoid overtrading)
- Performance by instrument (find strengths)
- Long vs short performance (identify directional bias)

## Step 4: Calculate Remaining Risk Budget

Based on account health results:

### Daily Budget
- Daily loss limit amount = initialBalance × (maxDailyLoss% / 100)
- Remaining daily budget = dailyLossLimit - |todayLoss|
- Maximum position risk for next trade = MIN(remainingDailyBudget, accountBalance × 1%)

### Total Drawdown Budget
- Max drawdown amount = initialBalance × (maxTotalDrawdown% / 100)
- Current drawdown = initialBalance - currentBalance
- Remaining drawdown budget = maxDrawdown - currentDrawdown
- Days to maintain at minimum risk if in drawdown

### Profit Target Remaining
- Target amount = initialBalance × (profitTarget% / 100)
- Remaining to target = targetAmount - currentPnl
- Required daily average = remaining ÷ estimated trading days left

## Step 5: Generate Recommendations

Based on the analysis, provide specific recommendations:

### If Account is HEALTHY (drawdown < 5%)
- Normal risk per trade: 1-2%
- Focus on A and B+ setups
- Maintain current strategy

### If Account is in WARNING (drawdown 5-7%)
- Reduce risk to 0.5-1% per trade
- Only take A+ setups with 1:3+ R:R
- Avoid correlated pairs
- Consider reducing trading frequency

### If Account is in DANGER (drawdown 7-9%)
- Reduce risk to 0.25-0.5% per trade
- Only take the highest conviction setups
- Maximum 1-2 trades per day
- No trades before high-impact news
- Consider stopping for the day if 1 loss occurs

### If Close to Target (>80% of profit target reached)
- Reduce risk to preserve gains
- Take partial profits more aggressively
- Consider stopping early if target reached with buffer
- Don't give back profits trying to overshoot

## Step 6: Output Format — Challenge Dashboard

Present a clear dashboard:

```
📊 FINTOKEI CHALLENGE DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plan: [ProTrader/SwiftTrader/StartTrader]
Phase: [Phase 1 / Phase 2 / Funded]
Status: [HEALTHY / WARNING / DANGER]

💰 Account
  Initial Balance:  ¥X,XXX,XXX
  Current Balance:  ¥X,XXX,XXX
  P&L:             +/-¥XX,XXX (X.X%)

📉 Drawdown Status
  Current:     X.X% / 10% max
  Daily Loss:  X.X% / 5% max
  ████████░░ [visual bar]

🎯 Profit Target
  Target:      X% = ¥XXX,XXX
  Progress:    XX.X% complete
  Remaining:   ¥XX,XXX
  ████░░░░░░ [visual bar]

📈 This Week's Performance
  Trades: X | Win Rate: XX% | Avg R:R: X.X
  P&L: +/-¥XX,XXX

⚠️ Risk Budget
  Max risk per trade: ¥XX,XXX (X.X%)
  Recommended lots:   X.XX (with 20-pip SL)

💡 Recommendations
  - [Specific, actionable advice]
  - [...]
```
