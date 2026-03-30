---
name: trade-analysis
description: Performs comprehensive multi-timeframe trade analysis for FX pairs, indices, and commodities. Triggers when user asks to analyze a trade setup, check a pair, evaluate an entry, find trade opportunities, or wants a full technical breakdown of any Fintokei instrument.
---

# Trade Analysis Skill

## Workflow Checklist

Copy and track progress:
```
Trade Analysis Progress:
- [ ] Step 1: Identify instrument and gather current price
- [ ] Step 2: Higher timeframe trend analysis (Daily/H4)
- [ ] Step 3: Trading timeframe analysis (H1/M15)
- [ ] Step 4: Key level identification
- [ ] Step 5: Indicator confluence check
- [ ] Step 6: Economic calendar risk check
- [ ] Step 7: Trade plan formulation
- [ ] Step 8: Present analysis with clear trade plan
```

## Step 1: Identify Instrument & Current Price

Call the `get_market_data` tool:

**Query:** `"[INSTRUMENT] current price quote"`

**Extract:** Current bid/ask, daily high/low, current spread

Also call `list_instruments` if the instrument name is ambiguous.

## Step 2: Higher Timeframe Trend Analysis (Daily / H4)

Call `get_market_data` with these queries:

### 2.1 Daily Chart Structure
**Query:** `"[INSTRUMENT] daily chart last 50 candles"`

**Analyze:**
- Overall trend direction (higher highs/higher lows or lower highs/lower lows)
- Recent swing points
- Distance from key round numbers

### 2.2 Daily Indicators
**Query:** `"[INSTRUMENT] daily SMA-20, SMA-50, SMA-200, RSI-14, ADX-14"`

**Analyze:**
- Price relative to MAs (above = bullish bias, below = bearish bias)
- MA alignment (20 > 50 > 200 = strong uptrend)
- RSI trend (above 50 = bullish momentum, below 50 = bearish)
- ADX > 25 = trending, < 20 = ranging

### 2.3 H4 Chart
**Query:** `"[INSTRUMENT] 4h chart last 50 candles with EMA-20, EMA-50, MACD"`

**Analyze:**
- H4 trend alignment with Daily
- MACD histogram direction and crossovers
- Recent momentum shifts

## Step 3: Trading Timeframe Analysis (H1 / M15)

**Query:** `"[INSTRUMENT] 1h chart last 50 candles with RSI-14, Bollinger Bands, Stochastic"`

**Analyze:**
- Price action patterns (pin bars, engulfing, inside bars)
- RSI divergences (bullish/bearish)
- Bollinger Band squeeze or expansion
- Stochastic overbought/oversold zones

For scalping setups, also check M15:
**Query:** `"[INSTRUMENT] 15min chart last 30 candles with EMA-9, EMA-21"`

## Step 4: Key Level Identification

Based on the price data gathered:

1. **Support levels**: Recent swing lows, daily open, weekly open, round numbers
2. **Resistance levels**: Recent swing highs, daily high, weekly high, round numbers
3. **Dynamic levels**: Key EMAs (20, 50, 200), Bollinger Band boundaries
4. **Pivot Points**: Call `get_market_data` with `"[INSTRUMENT] daily pivot points"`

## Step 5: Indicator Confluence Check

Score the setup based on alignment:
- **Trend alignment** (Daily + H4 + H1 same direction): +2 points
- **Price at key level** (support/resistance): +1 point
- **RSI confirmation** (not overbought for longs, not oversold for shorts): +1 point
- **MACD confirmation** (histogram growing in trade direction): +1 point
- **Volume/momentum confirmation**: +1 point
- **Bollinger Band support** (price at band edge with reversal): +1 point

**Minimum score for trade: 4/7**

## Step 6: Economic Calendar Risk Check

Call `get_economic_calendar`:

**Query:** Check events for the next 24 hours for currencies related to the instrument.

**Rules:**
- If HIGH impact event within 2 hours: **DO NOT ENTER** — wait for release
- If HIGH impact event within 24 hours: Note in trade plan, consider reducing position size
- If no major events: Proceed normally

For indices (US30, NAS100, etc.), check US economic events.
For gold (XAUUSD), check US events AND Fed speakers.
For JPY pairs and JP225, check both currencies' events.

## Step 7: Trade Plan Formulation

If confluence score >= 4 and no imminent news risk:

### Entry
- Specific price level or condition for entry
- Entry type: limit order at level, or market on confirmation

### Stop Loss
- Below/above the nearest key structure level
- Minimum distance: 1.5x ATR on the trading timeframe
- Call `get_market_data`: `"[INSTRUMENT] 1h ATR-14"` for reference

### Take Profit
- At the next significant level in trade direction
- Minimum 1:2 risk-reward ratio
- Consider partial take profit at 1:1 with stop to breakeven

### Position Sizing
- Calculate using `calculate_position_size` tool with the stop loss distance
- Respect Fintokei daily loss limit

## Step 8: Output Format

Present a structured summary:

1. **Instrument & Bias**: Instrument name, overall bias (Bullish/Bearish/Neutral)
2. **Multi-Timeframe Summary**:
   - Daily: [Trend + key observation]
   - H4: [Trend + key observation]
   - H1: [Setup + trigger]
3. **Key Levels Table**: Support and resistance levels
4. **Confluence Score**: X/7 with breakdown
5. **Trade Plan** (if score >= 4):
   - Direction, Entry, Stop Loss, Take Profit
   - Risk-Reward Ratio
   - Position Size recommendation
6. **Risk Warnings**: Economic calendar events, correlation risks, any caveats
7. **Invalidation**: Clear condition that would invalidate the analysis
