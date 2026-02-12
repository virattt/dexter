---
name: trading-signals
description: Combined technical analysis + fundamental + sentiment trading signal generation. Triggers when user asks "should I buy/sell X?", "trading signals for X", "is X a good trade?", "entry/exit for X", or wants a comprehensive trade recommendation with confidence level.
---

# Trading Signals Skill

Generates a comprehensive trading recommendation by combining technical indicators, news sentiment, and fundamental data.

## Workflow Checklist

Copy and track progress:
```
Trading Signal Analysis:
- [ ] Step 1: Run technical analysis
- [ ] Step 2: Fetch recent news
- [ ] Step 3: Check fundamentals
- [ ] Step 4: Synthesize signals
- [ ] Step 5: Generate recommendation
- [ ] Step 6: Position sizing (if confirmed)
```

## Step 1: Technical Analysis

Call the `trading` tool:
**Query:** `"technical analysis on [TICKER] over 3m"`

**Extract:** Overall signal (bullish/bearish/neutral), RSI level, MACD crossover status, price vs moving averages, Bollinger Band position, ATR for volatility.

## Step 2: News Sentiment

Call the `financial_search` tool:
**Query:** `"[TICKER] latest news"`

**Analyze:** Count positive vs negative headlines. Look for:
- Earnings beats/misses
- Analyst upgrades/downgrades
- Product launches or regulatory actions
- Sector-wide trends

**Classify:** Positive / Negative / Mixed sentiment

## Step 3: Fundamental Check

Call the `financial_search` tool:
**Query:** `"[TICKER] key ratios snapshot"`

**Extract:** P/E ratio, revenue growth, profit margins, debt-to-equity

**Quick assessment:**
- P/E vs sector average (overvalued/undervalued)
- Revenue growth trend (accelerating/decelerating)
- Margin expansion/compression
- Debt level (manageable/concerning)

## Step 4: Signal Synthesis

Combine all three dimensions:

| Factor | Weight | Signal |
|--------|--------|--------|
| Technical indicators | 40% | From Step 1 |
| News sentiment | 30% | From Step 2 |
| Fundamentals | 30% | From Step 3 |

**Agreement scoring:**
- All 3 agree → High confidence
- 2 of 3 agree → Moderate confidence
- Mixed signals → Low confidence (suggest waiting)

## Step 5: Generate Recommendation

Present a structured recommendation:

1. **Signal**: BUY / SELL / HOLD
2. **Confidence**: High / Moderate / Low
3. **Technical Summary**: Key indicator readings
4. **Sentiment**: News tone + key catalysts
5. **Fundamental View**: Valuation + growth assessment
6. **Risk Factors**: What could go wrong
7. **Suggested Entry**: Based on support levels / Bollinger lower band
8. **Suggested Stop-Loss**: Based on ATR (1.5-2x ATR below entry)

## Step 6: Position Sizing (Only If User Confirms)

If the user explicitly says they want to trade:

1. Call `trading` with `"show my account"` to get equity
2. Calculate position size: **max 5% of equity** by default
3. Determine shares: position_value / current_price
4. Suggest order parameters:
   - Type: limit (at suggested entry) or market
   - Stop-loss: based on ATR
   - Time in force: day (stocks) or gtc (crypto)
5. **Show order preview and ask for confirmation before placing**

## Disclaimer

Always end with: "This analysis is for informational purposes only and does not constitute financial advice. Trading involves risk of loss. Past performance does not guarantee future results."
