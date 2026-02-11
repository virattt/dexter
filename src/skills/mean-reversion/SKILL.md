---
name: mean-reversion
description: Bollinger Bands mean reversion strategy for identifying oversold bounces and overbought fades. Triggers when user asks about mean reversion trades, Bollinger Band setups, oversold bounces, or range-bound strategies.
---

# Mean Reversion Skill

Identifies mean reversion trades using Bollinger Bands — buying at the lower band and selling at the middle/upper band.

## Strategy Overview

**Buy setup (long):**
- Price touches or closes below lower Bollinger Band (2σ)
- RSI < 35 (confirms oversold)
- Not in a strong downtrend (price above SMA(50) or at least flattening)

**Sell setup (short/exit):**
- Price touches or closes above upper Bollinger Band (2σ)
- RSI > 65 (confirms overbought)
- Target: middle band (SMA 20) for conservative, upper band for aggressive

**Avoid:**
- Strong trending markets (bands expanding rapidly)
- Breakout moves with high volume (trend, not reversion)

## Workflow

### Step 1: Analyze Bollinger Bands

Call the `trading` tool:
**Query:** `"technical analysis on [TICKER] over 3m with indicators BollingerBands, RSI, SMA"`

**Check:**
1. Where is price relative to bands? (above upper, below lower, or middle)
2. Band width — narrow bands suggest consolidation (good for mean reversion)
3. RSI confirmation — oversold (<35) or overbought (>65)
4. SMA(50) trend — flat or slightly up is ideal; steep decline = avoid

### Step 2: Check for Trend vs Range

Call the `trading` tool:
**Query:** `"technical analysis on [TICKER] over 6m with indicators EMA, ATR"`

**Evaluate:**
- If EMA(12) and EMA(26) are close together → range-bound (good)
- If EMA(12) >> EMA(26) → trending (mean reversion is risky)
- ATR trend: stable or declining ATR is favorable; rising ATR suggests breakout

### Step 3: Volume and News Check

Call the `financial_search` tool:
**Query:** `"[TICKER] latest news"`

**Look for:**
- No major catalysts that would cause a sustained move (earnings, FDA, M&A)
- Mean reversion works best during "boring" periods
- If there's a catalyst, this is likely a trend move — skip the trade

### Step 4: Calculate Trade Parameters

**For a BUY (lower band touch):**
- **Entry**: At or near lower Bollinger Band
- **Stop-Loss**: Entry - (1.5 × ATR) — below the lower band extremity
- **Target 1**: Middle band (SMA 20) — conservative, higher probability
- **Target 2**: Upper band — aggressive, lower probability
- **Position Size**: Risk amount / (Entry - Stop-Loss)
  - Default risk: 1% of account equity (tighter risk for mean reversion)

**For a SELL/SHORT (upper band touch):**
- **Entry**: At or near upper Bollinger Band
- **Stop-Loss**: Entry + (1.5 × ATR)
- **Target**: Middle band (SMA 20)

### Step 5: Present the Setup

Format the trade setup:

```
MEAN REVERSION SETUP: [TICKER]
Signal: BUY (Oversold Bounce) / SELL (Overbought Fade)
Entry: $XX.XX (lower/upper Bollinger Band)
Stop-Loss: $XX.XX (1.5x ATR beyond band)
Target 1: $XX.XX (middle band / SMA20)
Target 2: $XX.XX (opposite band)
Position Size: XX shares (X% of equity at risk)

Conditions Met:
✓ Price at [lower/upper] Bollinger Band
✓ RSI(14): XX ([oversold/overbought])
✓ Band width: [narrow/normal] (favorable for reversion)
✓ No major catalyst detected

Band Readings:
  Upper: $XX.XX
  Middle: $XX.XX
  Lower: $XX.XX
  Width: X.X%
```

### Step 6: Execute (Only with Confirmation)

If user confirms:
1. Call `trading` with `"show my account"` to verify buying power
2. Place limit order at the band level (don't chase with market orders)
3. **Always confirm order details before placing**

## Risk Management Rules

- Risk max 1% of equity per mean reversion trade (lower than trend trades)
- Use limit orders only — never chase with market orders
- Exit at middle band if momentum stalls (don't hold for upper band)
- If price closes two consecutive days beyond the band, the setup has failed — exit
- Works best on liquid, range-bound stocks with stable ATR

## Disclaimer

Mean reversion strategies assume prices will return to average. This does not always happen — trends can persist. Use paper trading first. This is not financial advice.
