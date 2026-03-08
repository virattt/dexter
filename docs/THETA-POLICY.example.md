# THETA POLICY

# Use case: (1) Execution on tastytrade = SOUL.md non-crypto underlyings only (equities: equipment,
# foundry, chip, power, memory, networking, cyclical adjacents). Secured puts and covered calls
# you actually place on tastytrade should be from this set. (2) BTC options = advisory for
# Hypersurface. We use tastytrade (IBIT) only for strike/APR/probability data; execute BTC
# secured puts or covered calls on Hypersurface, not necessarily on tastytrade.
#
# Allowed underlyings — SOUL.md thesis names with liquid US equity options on tastytrade (non-crypto).
# IMPORTANT: Tastytrade is the non-Hyperliquid sleeve. Do NOT list symbols that are tradable on
# Hyperliquid (e.g. AAPL, MSFT, AMZN, META, COIN, BTC, SOL) — they are blocked by policy.
# Use only names that are NOT in the HL universe (e.g. TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET).
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
# (HL-tradable names like AAPL, AMD, PLTR, MSFT, AMZN, META, COIN are auto-excluded by Dexter.)
#
# BTC options (weekly, same calendar as Hypersurface Friday): advisory only — for secured puts or
# covered calls on BTC that you execute on Hypersurface. Tastytrade has no spot BTC; use a US
# Bitcoin ETF (IBIT, BITO, GBTC) as data source. Add one (e.g. IBIT) to allowed underlyings only
# if you want /theta-btc-weekly to run; use theta_scan with underlyings_csv=IBIT, min_dte=1,
# max_dte=7 for "this week's Friday" expiry. Do not use IBIT for tastytrade execution unless you
# explicitly want to trade the ETF options on tastytrade.
Allowed underlyings: TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET

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
| AAPL, AMD, AVGO, PLTR, MSFT, AMZN, META, COIN, BTC, SOL, etc. | **Hyperliquid-tradable** — tastytrade sleeve has zero overlap with HL; these are hard-blocked in scan/preview/submit and belong in PORTFOLIO-HYPERLIQUID.md |
| SPX, SPY, QQQ, IWM | Index indices — not in the SOUL thesis; add manually if wanted |
| NVDA | SOUL "Avoid/Too Crowded" — consensus expression of AI thesis, thin edge for new positions |
| MSTR | SOUL "Avoid" — financial engineering, no durable bottleneck |
| HYPE, SOL, NEAR, SUI, ETH | Crypto spot — not US equity options; for BTC use IBIT/BITO/GBTC |
| BESI / BESIY | ADR with typically thin option market |
| TEL / TOELY | ADR with typically thin option market |
| BE, SEI, PSIX | Speculative Optionality tier — add only if you hold and want to sell covered calls |

Copy this file to `~/.dexter/THETA-POLICY.md` and edit it to match your actual holdings and rules.
