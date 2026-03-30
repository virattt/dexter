---
name: risk-management
description: Quantitative risk management using Kelly Criterion, Monte Carlo simulation, correlation decomposition, and volatility-adjusted position sizing. Triggers when user asks about position sizing, risk per trade, lot size, correlation risk, portfolio heat, drawdown recovery, optimal risk percentage, or Kelly fraction.
---

# Quantitative Risk Management Skill

## Workflow Checklist

```
Quantitative Risk Management:
- [ ] Step 1: Account context and performance statistics
- [ ] Step 2: Kelly Criterion position sizing
- [ ] Step 3: Volatility-adjusted risk calibration
- [ ] Step 4: Correlation factor decomposition
- [ ] Step 5: Portfolio heat and risk concentration analysis
- [ ] Step 6: Drawdown recovery modeling (if applicable)
- [ ] Step 7: Present risk management framework
```

## Step 1: Account Context

Call `get_trade_history` with status: "open" — get current exposure.
Call `get_trade_stats` with period: "last_30_days" — get performance statistics.
Call `check_account_health` — get drawdown status.

## Step 2: Kelly Criterion Position Sizing

The Kelly Criterion gives the mathematically optimal fraction of capital to risk:

```
f* = (p × b - q) / b
where:
  f* = optimal fraction of capital
  p  = win probability
  q  = 1 - p (loss probability)
  b  = average win / average loss (payoff ratio)
```

**From trade stats, extract:**
- Win rate (p)
- Average win / average loss ratio (b)
- Kelly fraction (f*)

**Adjustments for Fintokei:**
- Full Kelly is too aggressive for prop trading challenges
- Use fractional Kelly: 0.25x to 0.5x depending on account health
  - HEALTHY (DD < 3%): 0.5x Kelly
  - CAUTION (DD 3-5%): 0.3x Kelly
  - WARNING (DD 5-7%): 0.2x Kelly
  - DANGER (DD > 7%): 0.1x Kelly or stop trading

**For each instrument the user wants to trade:**
Call `calculate_position_size` with the Kelly-derived risk percentage and the specific stop loss distance.

## Step 3: Volatility-Adjusted Risk Calibration

Different volatility regimes require different position sizes even with the same Kelly fraction.

**Tool:** `get_volatility_regime` for each instrument in the portfolio

**Adjustment table:**

| Vol Regime | Vol Percentile | Risk Multiplier | Stop Multiplier |
|-----------|---------------|----------------|-----------------|
| LOW       | < 25th        | 1.2x base      | 1.0x ATR        |
| NORMAL    | 25-75th       | 1.0x base      | 1.0x ATR        |
| HIGH      | 75-90th       | 0.6x base      | 1.5x ATR        |
| CRISIS    | > 90th        | 0.3x base      | 2.0x ATR        |

**Applied risk:**
```
adjustedRisk = baseKellyRisk × volMultiplier × drawdownMultiplier
```

## Step 4: Correlation Factor Decomposition

**Tool:** `get_correlation_matrix` with all instruments in current + planned portfolio

**Factor exposure analysis:**
Decompose positions into common factor exposures:
- USD factor: sum of all USD-linked positions
- JPY factor: sum of all JPY-linked positions
- Risk factor: sum of all risk-on/risk-off positions
- Commodity factor: gold + oil exposure

**Rules:**
- If correlation > 0.7 between two positions: treat as 1.5x single position risk
- If correlation > 0.9: treat as nearly identical — one position should be closed
- Net factor exposure should not exceed 3x single-position risk
- For Fintokei: maximum portfolio heat = 5% of account

## Step 5: Portfolio Heat Analysis

Portfolio Heat = Σ(position risk as % of account), adjusted for correlations.

For each open position:
1. Current distance to stop loss (in pips)
2. Position size (lots)
3. Pip value
4. Risk amount = distance × lots × pip value
5. Risk % = risk amount / account balance

**Aggregate:**
- Raw heat: sum of all risk %
- Correlation-adjusted heat: apply correlation multipliers from Step 4
- Available heat: max portfolio heat (5%) - current heat

**Traffic light system:**
- GREEN (< 3%): Room for new positions
- YELLOW (3-5%): Limit new entries, only add if strong edge
- ORANGE (5-7%): Reduce weakest positions
- RED (> 7%): Immediate reduction required

## Step 6: Drawdown Recovery Modeling

If account is in drawdown:

### Mathematical framework
```
Recovery required = DD / (1 - DD)
Expected trades to recover = recovery / (expectedPayoff × adjustedRisk)
Expected days = tradesNeeded / tradesPerDay
```

### Monte Carlo recovery simulation
Call `monte_carlo_simulation` with:
- Current win rate and avg win/loss
- Start from current equity level (not 100%)
- Target: recover to breakeven (not profit target)
- Track: P(recovery within N days) for N = 5, 10, 20, 30

### Recovery protocol
- **Mild DD (< 3%):** Normal trading, slight risk reduction
- **Moderate DD (3-5%):** Reduce risk by 40%, extend timeline expectations
- **Severe DD (5-8%):** Reduce risk by 60%, only trade highest-conviction setups, consider 1-day break
- **Critical DD (8-9%):** Reduce risk by 80%, maximum 1 trade per day, stop after any loss
- **Terminal DD (> 9%):** Stop trading. 1% remaining buffer is not enough to trade safely.

**Golden rule:** NEVER increase risk to "recover faster." Mathematically, this accelerates account destruction.

## Step 7: Output — Risk Management Framework

```
QUANTITATIVE RISK MANAGEMENT FRAMEWORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KELLY CRITERION ANALYSIS
  Win Rate: XX.X% | Payoff Ratio: X.XX | Kelly: X.X%
  Applied Fraction: 0.Xx (based on account health)
  Effective Risk/Trade: X.X%

VOLATILITY-ADJUSTED SIZING
  | Instrument | Vol Regime | ATR  | Adj Risk | Lot Size | SL Distance |
  |-----------|-----------|------|----------|----------|-------------|
  | EUR/USD   | NORMAL    | 0.XX | X.X%     | X.XX     | XX pips     |
  | XAUUSD    | HIGH      | XX.X | X.X%     | X.XX     | XXX pips    |

PORTFOLIO RISK DECOMPOSITION
  Raw Heat: X.X% | Correlation-Adjusted: X.X% | Available: X.X%
  USD Exposure: X.Xx | JPY Exposure: X.Xx | Risk Factor: X.Xx

CORRELATION MATRIX (significant pairs only)
  EUR/USD ↔ GBP/USD: 0.82 (STRONG — reduce combined exposure)

DRAWDOWN STATUS
  Current: X.X% | Recovery needed: X.X% | Est. trades: XX
  P(recovery in 10 days): XX% | P(recovery in 20 days): XX%

RULES FOR TODAY
  1. Max risk per trade: X.X% = ¥XX,XXX
  2. Max trades: X
  3. Stop trading if daily P&L reaches: -¥XX,XXX
  4. [Any additional instrument-specific rules]
```
