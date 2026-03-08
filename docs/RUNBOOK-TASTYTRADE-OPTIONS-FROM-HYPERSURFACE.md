# Runbook: From Hypersurface to tastytrade Options (via Dexter)

One-page guide for adding **US equity theta** on tastytrade via Dexter when you already use **Hypersurface** for crypto options.

---

## Venue split

| Venue | Use for | In Dexter |
|-------|--------|-----------|
| **Hypersurface** | Crypto options (BTC, SOL, HYPE, etc.) — on-chain, 24/7, web UI (strike, APR, probability) | Out of scope; you check Hypersurface in-app |
| **tastytrade (Dexter)** | US equity theta on **SOUL thesis names** only (e.g. AMAT, ASML, LRCX, KLAC, VRT, CEG) | `/theta-scan`, `/theta-preview`, roll/repair, optional submit |

**Zero overlap:** Symbols tradable on Hyperliquid (e.g. AAPL, COIN, HL equities) are **hard-blocked** from tastytrade theta in Dexter; those belong in PORTFOLIO-HYPERLIQUID.md and HL tools. The tastytrade sleeve is for **non-HL** names only.

---

## Prerequisites

1. **THETA-POLICY.md** — Copy from [THETA-POLICY.example.md](THETA-POLICY.example.md) to `~/.dexter/THETA-POLICY.md`. Set allowed underlyings (SOUL thesis names), no-call list, delta/DTE, max risk, earnings filter.
2. **OAuth and credentials** — [TASTYTRADE.md](TASTYTRADE.md): `TASTYTRADE_CLIENT_ID`, `TASTYTRADE_CLIENT_SECRET`, refresh token in `~/.dexter/tastytrade-credentials.json`.
3. **Venue split understood** — tastytrade = non-HL only; HL symbols are excluded from scan/preview/submit.

See the full **readiness checklist** in [PRD-TASTYTRADE-OPTIONS-EXPLORATION.md](PRD-TASTYTRADE-OPTIONS-EXPLORATION.md#34-readiness-checklist).

---

## Flow

1. **`/theta-scan`** — Scan for theta candidates (credit spread, covered call, cash-secured put, iron condor). Dexter returns a table (Underlying, Strategy, Strike(s), Credit, APR-like, Prob (ITM), DTE, Max loss) and ranked candidates. Policy is a hard block (no-call list, DTE, etc.).
2. **Pick a candidate** — Choose from the table or candidate list.
3. **`/theta-preview`** — Run strategy preview + dry-run. If `policy_blocked: true`, do not recommend. Otherwise you get trade memo, breakevens, dry-run result.
4. **Approve** — You explicitly confirm. No submit from heartbeat or without confirmation.
5. **Submit** — Only when `TASTYTRADE_ORDER_ENABLED=true`; Dexter still shows dry-run before submit.

**Habit:** Always preview and dry-run before submit. Use `TASTYTRADE_SANDBOX=true` with a paper account to test first.

---

## References

| Doc | Purpose |
|-----|---------|
| [TASTYTRADE.md](TASTYTRADE.md) | Setup, tools, theta workflows, venue split |
| [THETA-POLICY.md](THETA-POLICY.md) | Policy format, no-call list, venue split |
| [PRD-TASTYTRADE-OPTIONS-EXPLORATION.md](PRD-TASTYTRADE-OPTIONS-EXPLORATION.md) | Venue comparison, gap analysis, readiness checklist |
