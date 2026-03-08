# THETA-POLICY.md

Defines the persistent risk and permissions layer for Phase 5 tastytrade theta workflows. Store the live file at:

`~/.dexter/THETA-POLICY.md`

Dexter reads this file when scanning or previewing theta trades so options remain subordinate to the Portfolio Builder thesis.

**Quick start:** copy [THETA-POLICY.example.md](THETA-POLICY.example.md) to `~/.dexter/THETA-POLICY.md`, then edit the values to match your rules.

---

## Suggested format

Underlyings must be **SOUL.md thesis names with liquid US equity options on tastytrade** — not generic indices. The scan focuses on the AI infrastructure supply chain: equipment, foundry, chip designers, power/infra, memory, networking, and thesis-adjacent cyclicals. Add indices (SPX, SPY, QQQ) only if you specifically want index premium.

```markdown
# THETA POLICY

# SOUL.md thesis names — liquid US equity options on tastytrade:
# Layer 1 (Chip):      AAPL, AMD, AVGO
# Layer 2 (Foundry):   TSM
# Layer 3 (Equipment): AMAT, ASML, LRCX, KLAC
# Layer 5 (Power):     VRT, CEG
# Layer 6 (Memory):    MU
# Layer 7 (Networking):ANET
# Cyclical/Adjacent:   PLTR, MSFT, AMZN, META, COIN
Allowed underlyings: AAPL, AMD, AVGO, TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET, PLTR, MSFT, AMZN, META, COIN

# Core Compounders — durable bottleneck holds; block covered calls so they can't be called away.
# Puts and spreads remain valid (good for building position at better price).
No-call list: TSM, ASML, AMAT, LRCX, KLAC, SNPS, CDNS, ANET, CEG

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
| `Allowed underlyings` | Which SOUL.md thesis names Dexter scans by default. Align with names you hold or are willing to own via put assignment. |
| `No-call list` | SOUL Core Compounders where covered calls must not be suggested — protects long-term holds from being called away. Puts and spreads still allowed. |
| `Short delta range` | Default short strike delta band |
| `DTE range` | Default days-to-expiration window |
| `Max risk per trade` | Per-trade max loss as % of account equity |
| `Max buying power usage` | Cap on buying power usage for a candidate trade |
| `Exclude earnings days` | Days before/after earnings where theta trades are filtered |

---

## What belongs in Allowed underlyings

| SOUL Layer | Include | Do NOT include by default |
|------------|---------|---------------------------|
| Layer 1 — Chip | AAPL, AMD, AVGO | NVDA (SOUL "Avoid/Too Crowded") |
| Layer 2 — Foundry | TSM | — |
| Layer 3 — Equipment | AMAT, ASML, LRCX, KLAC | BESI/BESIY, TEL/TOELY (thin ADR option markets) |
| Layer 4 — EDA | SNPS, CDNS (if you hold them) | — |
| Layer 5 — Power | VRT, CEG | BE, SEI, PSIX (speculative tier — add only if you hold) |
| Layer 6 — Memory | MU | SNDK, WDC, STX (less liquid options) |
| Layer 7 — Networking | ANET | LITE, COHR, CIEN (thinner options) |
| Cyclical / Adjacent | PLTR, MSFT, AMZN, META, COIN | MSTR (SOUL "Avoid"), HYPE/SOL/NEAR/SUI/ETH (crypto only) |
| Indices | Add manually if you want index theta | SPX, SPY, QQQ, IWM (not in thesis; not in defaults) |

---

## Behavior

- If the file is missing, Dexter falls back to code defaults drawn from SOUL.md:
  - `AAPL, AMD, AVGO, TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET, PLTR, MSFT, AMZN, META, COIN`
  - no-call list: `TSM, ASML, AMAT, LRCX, KLAC, SNPS, CDNS, ANET, CEG`
  - short delta `0.10-0.20`
  - DTE `0-45`
  - max risk per trade `3%`
  - max buying power usage `50%`
  - exclude earnings days `2`
- The file does **not** auto-submit trades.
- `tastytrade_strategy_preview` and `tastytrade_theta_scan` still require explicit user confirmation before any live order submission.
