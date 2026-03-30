---
name: risk-management
description: Advanced risk management analysis for Fintokei trading. Triggers when user asks about position sizing, risk per trade, lot size calculation, correlation risk, portfolio heat, maximum exposure, drawdown recovery, or optimal risk percentage for their account.
---

# Risk Management Skill

## Workflow Checklist

```
Risk Management Analysis:
- [ ] Step 1: Gather account context
- [ ] Step 2: Calculate optimal position sizing
- [ ] Step 3: Analyze correlation risk
- [ ] Step 4: Evaluate portfolio heat
- [ ] Step 5: Drawdown recovery analysis (if applicable)
- [ ] Step 6: Present risk management plan
```

## Step 1: Gather Account Context

Collect or recall from memory:
- Account balance and currency (JPY/USD)
- Fintokei plan and phase
- Current open positions (check trade journal)
- Today's P&L
- Current drawdown level

Call `get_trade_history` with `status: "open"` to see current exposure.
Call `check_account_health` if drawdown information is available.

## Step 2: Calculate Optimal Position Sizing

### Per-Trade Risk Rules for Fintokei

| Account Status | Max Risk/Trade | Max Daily Risk | Strategy |
|---------------|---------------|----------------|----------|
| Healthy (DD < 3%) | 1-2% | 5% | Normal trading |
| Caution (DD 3-5%) | 0.5-1% | 3% | Selective setups |
| Warning (DD 5-7%) | 0.25-0.5% | 2% | A+ setups only |
| Danger (DD 7-9%) | 0.1-0.25% | 1% | Survival mode |
| Critical (DD > 9%) | Do not trade | 0% | Stop trading |

For each requested trade, call `calculate_position_size` with:
- Account balance
- Appropriate risk percentage based on status
- Instrument
- Stop loss distance in pips
- Daily loss limit and current daily P&L

### Stop Loss Guidelines by Instrument Category

**FX Majors (EUR/USD, GBP/USD, etc.):**
- Scalp: 8-15 pips
- Intraday: 15-30 pips
- Swing: 30-80 pips
- Minimum: 1.5x ATR on trading timeframe

**FX Crosses (GBP/JPY, EUR/AUD, etc.):**
- Typically 1.5-2x the major pair SL due to higher volatility
- GBP/JPY: 20-50 pips intraday, 50-150 pips swing
- EUR/AUD: 15-40 pips intraday, 40-100 pips swing

**Gold (XAUUSD):**
- Scalp: 30-80 pips ($3-8)
- Intraday: 80-200 pips ($8-20)
- Swing: 200-500 pips ($20-50)

**Indices (US30, NAS100, etc.):**
- US30: 20-50 points intraday, 50-150 points swing
- NAS100: 15-40 points intraday, 40-100 points swing
- JP225: 50-200 points intraday

## Step 3: Analyze Correlation Risk

### Key Correlations to Monitor

**Highly Correlated (avoid simultaneous positions in same direction):**
- EUR/USD and GBP/USD (positive ~0.80)
- EUR/USD and USD/CHF (negative ~-0.85)
- AUD/USD and NZD/USD (positive ~0.90)
- US30 and US500 and NAS100 (positive ~0.85-0.95)
- XAUUSD and USD (negative correlation)

**Rules:**
- If 2 correlated pairs are traded in the same effective direction, treat combined risk as 1.5x
- Maximum 3 correlated positions at once
- For indices: count US30 + US500 + NAS100 as a single risk unit

### Portfolio Heat Calculation

Portfolio Heat = Sum of all open position risks (as % of account)

| Heat Level | Action |
|-----------|--------|
| < 3% | Green — room for more trades |
| 3-5% | Yellow — limit new entries |
| 5-8% | Orange — close weakest positions first |
| > 8% | Red — reduce immediately |

## Step 4: Evaluate Portfolio Heat

For each open position from trade journal:
1. Calculate current risk (distance to SL × lot size)
2. Convert to account percentage
3. Sum for total portfolio heat
4. Apply correlation multiplier for correlated positions

## Step 5: Drawdown Recovery Analysis

If the account is in drawdown:

### Recovery Math
- From 3% DD: Need 3.1% gain to recover
- From 5% DD: Need 5.3% gain to recover
- From 8% DD: Need 8.7% gain to recover
- From 10% DD: FAILED (Fintokei challenge over)

### Recovery Strategy
Calculate:
- Number of trades needed to recover at current win rate and average R:R
- Estimated trading days needed
- Safe daily risk budget during recovery

**Recovery Formula:**
```
Required_Gain = Drawdown / (1 - Drawdown)
Trades_to_Recover = Required_Gain / (AvgWin × WinRate - AvgLoss × LossRate)
```

### Recovery Rules
1. Never increase risk to "make it back quickly" — this is the #1 challenge killer
2. Focus on the process, not the P&L
3. Reduce risk as drawdown increases (see table in Step 2)
4. Consider taking a 1-2 day break to reset mentally if drawdown > 5%

## Step 6: Output Format

Present a structured risk management plan:

1. **Account Status Summary**: Health level, drawdown, daily budget
2. **Position Sizing Table**: For common instruments with recommended lot sizes
3. **Current Portfolio Heat**: Open positions and combined risk
4. **Correlation Alert**: Any correlated positions that need attention
5. **Recovery Plan** (if in drawdown): Timeline, required trades, safe risk levels
6. **Risk Rules**: Clear, actionable rules to follow

### Position Sizing Quick Reference Table

| Instrument | SL (pips) | Max Lots | Risk Amount | R:R 1:2 TP |
|-----------|----------|---------|-------------|------------|
| EUR/USD | 20 | X.XX | ¥XX,XXX | 40 pips |
| GBP/JPY | 35 | X.XX | ¥XX,XXX | 70 pips |
| XAUUSD | 100 | X.XX | ¥XX,XXX | 200 pips |
| US30 | 30 | X.XX | ¥XX,XXX | 60 points |

Customize the table based on the user's actual account status and typical instruments.
