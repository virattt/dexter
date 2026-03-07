# THETA-POLICY.md

Defines the persistent risk and permissions layer for Phase 5 tastytrade theta workflows. Store the live file at:

`~/.dexter/THETA-POLICY.md`

Dexter reads this file when scanning or previewing theta trades so options remain subordinate to the Portfolio Builder thesis.

**Quick start:** copy [THETA-POLICY.example.md](THETA-POLICY.example.md) to `~/.dexter/THETA-POLICY.md`, then edit the values to match your rules.

---

## Suggested format

```markdown
# THETA POLICY

Allowed underlyings: SPX, SPY, QQQ, IWM
No-call list: NVDA, TSM, ASML
Short delta range: 0.10-0.20
DTE range: 0-45
Max risk per trade: 3%
Max buying power usage: 50%
Exclude earnings days: 2
```

---

## Fields

| Field | Purpose |
|-------|---------|
| `Allowed underlyings` | Which underlyings Dexter may scan by default |
| `No-call list` | Tickers where covered calls should not be suggested |
| `Short delta range` | Default short strike delta band |
| `DTE range` | Default days-to-expiration window |
| `Max risk per trade` | Per-trade max loss as % of account equity |
| `Max buying power usage` | Cap on buying power usage for a candidate trade |
| `Exclude earnings days` | Days before/after earnings where earnings trades should be filtered |

---

## Behavior

- If the file is missing, Dexter falls back to conservative defaults:
  - `SPX, SPY, QQQ, IWM`
  - short delta `0.10-0.20`
  - DTE `0-45`
  - max risk per trade `3%`
  - max buying power usage `50%`
  - exclude earnings days `2`
- The file does **not** auto-submit trades.
- `tastytrade_strategy_preview` and `tastytrade_theta_scan` still require explicit user confirmation before any live order submission.
