# THETA POLICY

# Allowed underlyings — SOUL.md thesis names with liquid US equity options on tastytrade.
# Do NOT add SPX/SPY/QQQ/IWM unless you specifically want index premium; the thesis focus is
# the AI infrastructure supply chain. Add or remove names to match what you actually hold
# or are willing to own via put assignment.
#
# Layer 1 — Chip Designers:      AAPL, AMD, AVGO
# Layer 2 — Foundry:             TSM
# Layer 3 — Equipment:           AMAT, ASML, LRCX, KLAC
# Layer 5 — Power/Infra:         VRT, CEG
# Layer 6 — Memory:              MU
# Layer 7 — Networking:          ANET
# Cyclical/Adjacent (liquid):    PLTR, MSFT, AMZN, META, COIN
# Speculative (add only if you hold these):  CRWV, IREN, SMCI, DELL, INTC
Allowed underlyings: AAPL, AMD, AVGO, TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET, PLTR, MSFT, AMZN, META, COIN

# No-call list — SOUL Core Compounders you want to hold long-term.
# Covered-call suggestions are hard-blocked on these (no getting called away).
# Puts and spreads are still allowed (good for entering/sizing positions at better prices).
No-call list: TSM, ASML, AMAT, LRCX, KLAC, SNPS, CDNS, ANET, CEG

# Remaining policy parameters
Short delta range: 0.10-0.20
DTE range: 0-45
Max risk per trade: 3%
Max buying power usage: 50%
Exclude earnings days: 2

## Notes

- **Align underlyings with SOUL.md.** The scan focuses on your thesis names. Indices (SPX, SPY, QQQ) are optional — add them if you specifically want index theta income.
- **No-call list protects Core Compounders.** TSM, ASML, AMAT, LRCX, KLAC, ANET, CEG are durable bottleneck holds — the tool blocks covered calls so they can't be called away at a local high.
- **Puts are not blocked by no-call.** Selling cash-secured puts on Core Compounders is valid — it's how you build a position at a better price.
- `Allowed underlyings` controls what Dexter scans by default in `tastytrade_theta_scan`.
- `Short delta range` and `DTE range` are defaults; override per-scan with explicit parameters.
- `Max risk per trade` and `Max buying power usage` are safety caps for preview and scan ranking.
- `Exclude earnings days` avoids pre/post-earnings vol crush / gap risk.

## What's excluded and why

| Ticker | Reason excluded from defaults |
|--------|-------------------------------|
| SPX, SPY, QQQ, IWM | Index indices — not in the SOUL thesis; add manually if wanted |
| NVDA | SOUL "Avoid/Too Crowded" — consensus expression of AI thesis, thin edge for new positions |
| MSTR | SOUL "Avoid" — financial engineering, no durable bottleneck |
| HYPE, SOL, NEAR, SUI, ETH | Crypto only on tastytrade (not US equity options) |
| BESI / BESIY | ADR with typically thin option market |
| TEL / TOELY | ADR with typically thin option market |
| BE, SEI, PSIX | Speculative Optionality tier — add only if you hold and want to sell covered calls |

Copy this file to `~/.dexter/THETA-POLICY.md` and edit it to match your actual holdings and rules.
