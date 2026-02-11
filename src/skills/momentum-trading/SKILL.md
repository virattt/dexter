---
name: momentum-trading
description: RSI + MACD crossover momentum trading strategy with position sizing and stop-loss placement. Triggers when user asks about momentum trades, RSI/MACD setups, trend-following entries, or breakout strategies.
---

# Momentum Trading Skill

Identifies momentum trades using RSI + MACD crossover signals with defined entry, stop-loss, and take-profit levels.

## Strategy Overview

**Entry conditions (all must be met):**
- RSI between 40-65 (not overbought, has room to run)
- MACD bullish crossover (MACD line crosses above signal line)
- Price above 20-day SMA (confirming uptrend)

**Exit / avoid conditions:**
- RSI > 70 (overbought — don't chase)
- MACD bearish crossover (momentum fading)
- Price below 50-day SMA (trend broken)

## Workflow

### Step 1: Screen the Ticker

Call the `trading` tool:
**Query:** `"technical analysis on [TICKER] over 3m with indicators RSI, MACD, SMA"`

**Check entry conditions:**
1. RSI(14) is between 40-65
2. MACD histogram is positive AND recently crossed from negative
3. Price is above SMA(20)

If all three are met → **momentum setup detected**, proceed to Step 2.
If not → report which conditions are missing and suggest waiting.

### Step 2: Assess Trend Strength

Call the `trading` tool:
**Query:** `"technical analysis on [TICKER] over 6m with indicators EMA, ATR, BollingerBands"`

**Evaluate:**
- EMA(12) > EMA(26) → short-term trend bullish
- ATR value → measure volatility for stop-loss sizing
- Bollinger Band position → confirm price isn't already at upper extreme

### Step 3: Check News Catalyst

Call the `financial_search` tool:
**Query:** `"[TICKER] latest news and analyst estimates"`

**Look for:** Earnings catalysts, upgrades, sector tailwinds that could sustain momentum.
**Red flags:** Pending litigation, regulatory risk, insider selling.

### Step 4: Calculate Trade Parameters

Using ATR and current price:

- **Entry**: Current price (market) or slight pullback to EMA(12)
- **Stop-Loss**: Entry - (2 × ATR) — gives room for normal volatility
- **Take-Profit 1**: Entry + (2 × ATR) — 1:1 risk/reward
- **Take-Profit 2**: Entry + (4 × ATR) — 1:2 risk/reward (trail stop)
- **Position Size**: Risk amount / (Entry - Stop-Loss)
  - Default risk: 1-2% of account equity per trade

### Step 5: Present the Setup

Format the trade setup:

```
MOMENTUM SETUP: [TICKER]
Signal: BUY (Momentum)
Entry: $XX.XX (market or limit at EMA12)
Stop-Loss: $XX.XX (2x ATR below entry)
Target 1: $XX.XX (2x ATR, 1:1 R/R)
Target 2: $XX.XX (4x ATR, 1:2 R/R)
Position Size: XX shares (X% of equity at risk)
Risk/Reward: 1:2

Conditions Met:
✓ RSI(14): XX (40-65 range)
✓ MACD: Bullish crossover
✓ Price > SMA(20)

Catalyst: [brief news summary]
```

### Step 6: Execute (Only with Confirmation)

If user confirms:
1. Call `trading` with `"show my account"` to verify buying power
2. Place limit order at calculated entry price
3. Note: Stop-loss must be managed manually (Alpaca basic orders don't support bracket orders via this tool)
4. **Always confirm order details before placing**

## Risk Management Rules

- Never risk more than 2% of account equity on a single trade
- Exit immediately if MACD crosses bearish after entry
- Move stop to breakeven after Target 1 is hit
- This strategy works best in trending markets; avoid during consolidation

## Disclaimer

This is a systematic momentum strategy for educational purposes. It does not guarantee profits. Always use paper trading to test before risking real capital.
