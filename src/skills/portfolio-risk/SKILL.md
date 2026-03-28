---
name: portfolio_risk
description: Analyse portfolio risk metrics — VaR, Sharpe ratio, correlation matrix, max drawdown — for watchlist positions or a specified list of tickers.
---

# Portfolio Risk Analysis Skill

Use this skill when the user asks about portfolio risk, Value at Risk (VaR), Sharpe ratio, correlation between holdings, max drawdown, or position-sizing guidance.

## Workflow

### Step 1 — Fetch Risk Metrics

Call the `portfolio_risk` tool. If the user specified tickers, pass them; otherwise omit `tickers` to auto-read the watchlist.

```
portfolio_risk({ tickers?: [...], lookback_days: 252, confidence_level: 0.95, risk_free_rate: 0.05 })
```

This returns per-ticker volatility, Sharpe, VaR, CVaR, maxDrawdown, and the full correlation matrix plus equal-weighted portfolio aggregates.

### Step 2 — Interpret Per-Ticker Metrics

For each ticker, flag:
- **High VaR** (> 5 % at 95 % confidence): position carries outsized tail risk
- **Negative Sharpe**: risk-adjusted return is below the risk-free rate — poor efficiency
- **High drawdown** (> 25 %): the asset has historically suffered severe peak-to-trough losses

Present findings in a concise table:

| Ticker | Volatility (ann.) | Sharpe | VaR 95 % | CVaR 95 % | Max Drawdown | Flag |
|--------|-------------------|--------|-----------|-----------|--------------|------|
| AAPL   | 28 %              | 1.2    | 3.1 %     | 4.0 %     | 33 %         |      |
| TSLA   | 62 %              | 0.4    | 6.8 %     | 9.1 %     | 73 %         | ⚠️ High VaR + Drawdown |

### Step 3 — Correlation Analysis

From the correlation matrix:
- Highlight **pairs with correlation > 0.7** as concentration risk — they move together and provide little diversification
- Highlight **pairs with correlation < 0.2** as good diversifiers
- If all pairwise correlations are > 0.7, warn that the portfolio is effectively concentrated in a single risk factor

### Step 4 — Portfolio-Level Summary

Report the equal-weighted portfolio aggregates (volatility, Sharpe, VaR, CVaR, max drawdown) and interpret them:

- **Diversification benefit**: compare portfolio VaR to the average individual VaR. If portfolio VaR < average individual VaR, diversification is working.
- **Diversification score**: 1 − (portfolio_vol / average_individual_vol). Higher is better (0 = no benefit, positive = diversified).
- **Overall assessment**: rate the portfolio as Low / Moderate / High risk based on portfolio VaR and Sharpe.

### Step 5 — Actionable Recommendations

Provide 2–4 specific, actionable suggestions:
- If a position has both high VaR and high drawdown, suggest reducing position size or adding a hedge
- If two positions are highly correlated, suggest replacing one with an uncorrelated alternative
- If portfolio Sharpe < 0.5, suggest adding a diversifier or raising cash
- If max drawdown > 50 %, flag it as a significant risk that may warrant stop-loss rules

### Step 6 — Save Report (optional)

If the user asked to save the report, write it to `~/reports/portfolio-risk-{YYYY-MM-DD}.md` using `write_file`. Include all tables and recommendations from the steps above.
