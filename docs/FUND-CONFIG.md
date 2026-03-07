# Fund Config — AUM & Inception

**Path:** `~/.dexter/fund-config.json`

Used for dollar-amount rebalance recommendations and since-inception performance.

## Schema

```json
{
  "aum": 1000000,
  "inceptionDate": "2025-01-01"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `aum` | number | Assets under management in dollars |
| `inceptionDate` | string | Inception date (YYYY-MM-DD) for since-inception returns |

## Setting via Dexter

```
Set my AUM to $1,000,000 and inception date to 2025-01-01
```

Or use the fund_config tool directly (the agent will call it).

## Effect

- **Weekly rebalance:** When AUM is set, the agent outputs "Sell $X of Ticker, Buy $Y of Ticker" instead of just percentage trims
- **Quarterly report:** When inceptionDate is set, the agent computes since-inception returns vs BTC, SPY, GLD
