---
name: trade-analysis
description: Performs rigorous quantitative trade analysis for FX pairs, indices, and commodities. Triggers when user asks to analyze a trade setup, evaluate a pair, check a trade idea, find statistical edge, or wants a full quantitative breakdown of any Fintokei instrument.
---

# Quantitative Trade Analysis Skill

## Workflow Checklist

```
Quantitative Trade Analysis:
- [ ] Step 1: Statistical regime identification
- [ ] Step 2: Return distribution analysis
- [ ] Step 3: Volatility regime classification
- [ ] Step 4: Macro context and rate differentials
- [ ] Step 5: Cross-asset regime check
- [ ] Step 6: Correlation and exposure analysis
- [ ] Step 7: Economic event risk assessment
- [ ] Step 8: Expected value calculation and trade plan
```

## Step 1: Statistical Regime Identification

Determine if the instrument is trending, mean-reverting, or random walk.

**Tool:** `get_return_distribution` with interval: "1day", lookback: 252

**Extract:**
- Hurst exponent (H > 0.6 = trending, H < 0.4 = mean-reverting, ~0.5 = random walk)
- Autocorrelation at lag 1-5 (significant positive = momentum, negative = mean-reversion)
- This determines which strategy class is statistically appropriate

**Tool:** `get_zscore` with interval: "1day", lookback: 100

**Extract:**
- Current z-score (> 2.0 or < -2.0 = statistical extreme)
- Percentile rank
- Historical mean-reversion probability at extreme z-scores

**Decision matrix:**
- H > 0.6 AND positive autocorrelation → Momentum/trend-following strategies
- H < 0.4 AND negative autocorrelation → Mean-reversion strategies
- H ≈ 0.5 → No statistical edge from trend or mean-reversion; rely on event-driven or macro analysis

## Step 2: Return Distribution Analysis

Understand tail risk and whether standard risk models apply.

**Tool:** `get_return_distribution` (already called in Step 1)

**Analyze:**
- Skewness (negative skew = fat left tail = crash risk)
- Excess kurtosis (> 0 = fatter tails than normal)
- Jarque-Bera test (is normal distribution assumption valid?)
- VaR(95%) and CVaR(95%) for tail risk quantification

**Implications:**
- If kurtosis > 3: Standard VaR underestimates risk → use wider stops
- If negative skew: Asymmetric downside → reduce position size or use options-like stop placement
- If JB test fails: Cannot use Gaussian models for risk → use empirical distributions

## Step 3: Volatility Regime Classification

**Tool:** `get_volatility_regime` with interval: "1day"

**Extract:**
- Current regime: LOW / NORMAL / HIGH / CRISIS
- Volatility percentile rank
- Vol term structure (inverted = recent shock, steep = calm)
- Vol-of-vol (high = regime change likely)

**Position sizing adjustment:**
- CRISIS: 0.25-0.5% risk per trade, 2x ATR stops
- HIGH: 0.5-1.0% risk, 1.5x ATR stops
- NORMAL: 1.0-1.5% risk, 1x ATR stops
- LOW: 1.0-2.0% risk, watch for breakout setups

## Step 4: Macro Context

**Tool:** `get_rate_differential` with the base and quote currencies

**Extract:**
- Rate differential and policy divergence
- Carry trade direction and yield
- Medium-term macro bias

**Tool:** `get_macro_regime` for both base and quote economies

**Extract:**
- Regime state (expansion/slowdown/contraction/recovery)
- Leading indicator trends
- FX implications

**Synthesis:**
- Rate differential > +1% with supportive divergence → Strong fundamental bias
- Conflicting macro regimes → Uncertainty premium, wider stops needed
- Both economies same regime → Pair driven by relative strength, not absolute

## Step 5: Cross-Asset Regime

**Tool:** `get_cross_asset_regime`

**Extract:**
- Risk-on / risk-off / mixed
- Implications for specific instrument (e.g., risk-off → JPY strong, AUD weak, gold up)

## Step 6: Correlation and Exposure Analysis

**Tool:** `get_correlation_matrix` with the target instrument plus correlated instruments

**Examples:**
- For EUR/USD, include: GBP/USD, USD/CHF, DXY, gold
- For XAUUSD, include: USD/JPY, US30, EUR/USD
- For JP225, include: USD/JPY, US500, AUD/JPY

**Check:**
- Are any of the user's current open positions highly correlated with this trade?
- Would this trade create hidden concentrated exposure to a single factor (e.g., USD strength)?

## Step 7: Economic Event Risk Assessment

**Tool:** `get_economic_calendar` for the next 48 hours, filtered by relevant currencies

**Rules:**
- HIGH impact event within 4 hours → DO NOT ENTER
- HIGH impact event within 24 hours → Reduce position size by 50%
- Consider the historical volatility impact of specific events (NFP, CPI, rate decisions)

## Step 8: Expected Value and Trade Plan

Based on all the above analysis, formulate the trade:

**If statistical edge identified (positive Hurst signal + macro alignment):**

**Tool:** `calculate_expected_value` with scenarios:
- Scenario 1: TP hit (probability from backtest/historical data)
- Scenario 2: SL hit (complement probability)
- Scenario 3: Breakeven exit (partial probability)

**Tool:** `calculate_position_size` with account details and stop distance

## Output Format

Present a structured quantitative report:

1. **Statistical Regime**: Hurst, autocorrelation, z-score, interpretation
2. **Distribution Profile**: Skew, kurtosis, VaR, normality test result
3. **Volatility State**: Regime, percentile, position sizing adjustment
4. **Macro Backdrop**: Rate differential, regime, cross-asset alignment
5. **Correlation Risk**: Matrix highlights, exposure warnings
6. **Event Risk**: Upcoming catalysts, impact assessment
7. **Trade Decision**:
   - If EV > 0: Full trade plan with entry, SL, TP, lot size, and statistical basis
   - If EV ≤ 0: "No statistical edge identified. Stand aside."
8. **Confidence Assessment**: HIGH / MODERATE / LOW based on data quality and signal alignment
