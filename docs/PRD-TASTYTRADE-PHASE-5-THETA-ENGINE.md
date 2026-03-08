# PRD: tastytrade Phase 5 — Portfolio-Aware Theta Engine

**Version:** 2.0  
**Status:** Shipped  
**Last Updated:** 2026-03-08  
**Reference:** [PRD-TASTYTRADE-INTEGRATION.md](PRD-TASTYTRADE-INTEGRATION.md) | [THETA-PROMPTS-12.md](THETA-PROMPTS-12.md)

---

## 1. Executive Summary

Phase 5 is the **decision engine** layer for options on top of tastytrade connectivity. Phases 1–4 provide broker truth (positions, balances), market data (option chains, quotes), portfolio sync with Target/Actual/Gap, heartbeat drift checks, session cache, and optional order flow. Phase 5 turns that into **actionable theta workflows**: scan SOUL.md thesis setups, assess portfolio fit, preview trade risk, and support roll/repair logic — all enforced against a persistent SOUL-aligned policy.

**All Phase 5 tools are shipped.**

**Core value:**
- **Position intelligence** — Enrich live tastytrade positions into a decision-ready view (underlying, DTE, theta/delta risk, assignment risk, concentration).
- **Opportunity scanning** — Find theta setups (covered calls, cash-secured puts, credit spreads, iron condors) on SOUL.md thesis names that match user constraints and portfolio policy. Not SPX/SPY/QQQ by default.
- **Strategy preview** — Generate a full trade memo (thesis, legs, risk, exit plan) and dry-run before any submission.
- **Roll/repair workflows** — Support "repair a challenged short option" and "roll or take assignment" decisions.
- **SOUL-aligned policy layer** — Every recommendation checked against THETA-POLICY.md (SOUL.md thesis underlyings, Core Compounder no-call list, concentration caps) so options stay subordinate to the Portfolio Builder north star.

---

## 2. Why Phase 5

- **Broker state exists** — Phases 1–4 provide live positions, balances, option chains, quotes, and (opt-in) order submission. The missing piece was *what trade to do* and *whether it fits*.
- **SOUL.md is the source of truth** — Theta income and hedging must be subordinate to the thesis. No overwriting Core Compounders with covered calls, no overconcentration, explicit caps enforced as hard blocks.
- **Theta prompts are defined** — [THETA-PROMPTS-12.md](THETA-PROMPTS-12.md) v1.1 specifies SOUL-aligned workflows. Phase 5 operationalizes these with tools and policy.
- **Order flow is last step** — Phase 3 (dry-run, submit, cancel) is the execution layer. Phase 5 sits in front: scan → preview → confirm → then optionally submit.

---

## 3. Product Goals

| Goal | Description |
|------|-------------|
| **SOUL-aligned theta** | Underlyings scanned are SOUL.md thesis names (equipment, foundry, chip, power/infra, memory, networking, cyclical adjacents). Not generic indices. |
| **Portfolio-aware** | Every suggested trade is checked against SOUL.md, PORTFOLIO.md, and live tastytrade positions. Flag conflicts (e.g. selling calls on a Core Compounder) and concentration drift. |
| **Small setup universe** | Covered calls, cash-secured puts, defined-risk credit spreads, iron condors. Earnings IV crush, jade lizard, etc. are secondary. |
| **Scan → preview → confirm** | User flows: "scan today's setup," "show safest income trade," "repair this short put." Agent returns ranked candidates and a trade memo; submission only after explicit user confirmation. |
| **Persistent policy** | `~/.dexter/THETA-POLICY.md` defines what theta trades are allowed: SOUL-aligned underlyings, Core Compounder no-call list, delta/DTE bounds, max risk per trade, earnings filters. |

---

## 4. User Workflows

| Flow | User intent | Agent actions |
|------|-------------|---------------|
| **Scan today's setup** | "What's the safest theta trade for my account today?" | Call `tastytrade_theta_scan` with THETA-POLICY defaults (SOUL names); apply regime/IV context; return top 2 candidates with strikes, credit, max loss, portfolio-fit. |
| **Safest income trade** | "What's the safest theta trade given my account and policy?" | Use balances + positions + THETA-POLICY; filter by allowed SOUL underlyings and risk caps; return top 2 candidates with rationale. |
| **Strategy preview** | "Preview this trade before I submit." | Build trade memo (thesis, legs, credit, breakevens, BP effect); validate against THETA-POLICY; call `tastytrade_order_dry_run`; return memo + dry-run result. User confirms before submit. |
| **Repair challenged short** | "My short put is in the money with 2 DTE — roll or take assignment?" | Enrich position (underlying, strike, DTE, P&L); fetch roll options; compare roll cost vs assignment + wheel; recommend with rationale. |
| **Roll short option** | "Roll my TSM 150 put to next week." | Resolve current position, get target expiration strikes, build roll order (close + open), dry-run, submit only after user confirmation. |
| **Earnings avoidance** | "Which of my SOUL holdings have earnings this week?" | Call `tastytrade_earnings_calendar` with THETA-POLICY underlyings; flag `within_7_days`; exclude from scan. |

---

## 5. Tools (All Shipped)

| Tool | Purpose | Key Outputs |
|------|---------|-------------|
| **tastytrade_position_risk** | Enrich live positions into a decision-ready risk view. | Per-position: underlying, symbol, quantity, side, DTE, option type, strike; aggregate: concentration by underlying, theta/delta/gamma if available, buying power usage, challenged shorts. |
| **tastytrade_theta_scan** | Find theta opportunities from SOUL.md thesis names that match THETA-POLICY. Hard block: only compliant candidates returned. | `policy_mode: "hard_block"`, `excluded_by_policy` (reason buckets), `excluded_by_earnings`, `earnings_exclusion_degraded` (when FINANCIAL_DATASETS_API_KEY missing), `no_candidates` + `next_steps` (when zero pass). Ranked candidates: underlying, strategy, strikes, credit, max loss, breakevens, DTE, delta, portfolio_fit, order_json. |
| **tastytrade_strategy_preview** | Trade memo + THETA-POLICY validation + dry-run. Never recommends if policy_blocked. | When compliant: `policy_blocked: false`, trade memo (thesis, legs, credit/debit, max profit/loss, breakevens, BP effect, portfolio_fit, exit plan, roll plan), dry-run result. When violated: `policy_blocked: true`, `violations` list — do not submit. |
| **tastytrade_roll_short_option** | Later-dated roll candidate for a short option. Validated against THETA-POLICY. | Current position, target contract, net credit/debit, `dry_run_result`, `order_json`, `policy_blocked` when applicable. |
| **tastytrade_repair_position** | Recommend action for a challenged short (roll, close, hold, assignment). | Recommendation, alternatives (hold/close/roll with order_json + policy status, assignment implications). |

**Registration:** All Phase 5 tools registered when `TASTYTRADE_CLIENT_ID` is set. Roll/repair submit steps require `TASTYTRADE_ORDER_ENABLED=true`; preview and scan do not.

---

## 6. Policy and Risk Layer

### 6.1 THETA-POLICY.md

**Path:** `~/.dexter/THETA-POLICY.md`  
**Example:** `docs/THETA-POLICY.example.md`  
**Reference:** `docs/THETA-POLICY.md`

A user-editable markdown file that defines what theta trades are allowed. The agent reads it when scanning or previewing.

| Section | Purpose | Default (when file missing) |
|---------|---------|-----------------------------|
| **Allowed underlyings** | SOUL.md thesis names with liquid US equity options. Do not include SPX/SPY/QQQ/IWM unless you want index theta. | AAPL, AMD, AVGO, TSM, AMAT, ASML, LRCX, KLAC, VRT, CEG, MU, ANET, PLTR, MSFT, AMZN, META, COIN |
| **No-call list** | SOUL Core Compounders — covered calls blocked so they can't be called away. Puts and spreads still valid. | TSM, ASML, AMAT, LRCX, KLAC, SNPS, CDNS, ANET, CEG |
| **Delta / DTE bounds** | Short strike delta range; DTE window. | `0.10–0.20` delta; `0–45` DTE |
| **Max risk per trade** | Per-trade max loss as % of account equity. | `3%` |
| **Max buying power usage** | Cap on buying power usage. | `50%` |
| **Earnings filter** | Skip underlyings with earnings within N days. | `2` days |

**Why not SPX/SPY/QQQ as defaults?** Index theta is valid but generic. The SOUL thesis is the AI infrastructure supply chain (equipment, foundry, chip, power, memory, networking). Theta income should be generated on names you track, understand, and potentially want to own. Add indices manually if you specifically want index premium.

### 6.2 Portfolio Builder alignment

- **SOUL.md** — Conviction tiers: Core Compounders (covered calls blocked), Cyclical Beneficiaries (theta valid with sizing discipline), Speculative Optionality (keep small), Avoid/Too Crowded (not in defaults). Theta scan respects these tiers.
- **PORTFOLIO.md** — Target weights and layers. Theta scan flags when a candidate adds exposure above target (e.g. "AMAT 6% vs 4% target — selling this put increases concentration").
- **tastytrade positions** — Source of truth for current option and equity exposure. Position risk aggregates by underlying for comparison.

### 6.3 No-call list rationale

Core Compounders are durable bottleneck holds (TSM, ASML, AMAT, LRCX, KLAC, SNPS, CDNS, ANET, CEG). Covered calls cap upside at a strike — if the thesis plays out and the stock rips, you miss the move and have to rebuy at a higher price. The no-call list blocks this mistake automatically. **Puts and spreads remain valid** — selling cash-secured puts on Core Compounders is a disciplined way to enter at a better price or collect premium while waiting.

---

## 7. Data Dependencies

| Data | Source | Notes |
|------|--------|-------|
| Positions / balances | tastytrade (Phase 1) | Session-cached 5-min TTL. |
| Option chain / quotes | tastytrade (Phase 2) | Per-underlying, per-expiration. |
| Greeks / IV | tastytrade quote response | Use wherever available; delta and theta in quote/chain data. |
| Earnings / events | `tastytrade_earnings_calendar` → Financial Datasets | When `FINANCIAL_DATASETS_API_KEY` missing, returns `earnings_exclusion_degraded`. |
| Theta policy | `~/.dexter/THETA-POLICY.md` | Falls back to SOUL-aligned code defaults when file missing. |

---

## 8. Agent and Prompt Integration

- **Tool descriptions** — `descriptions.ts` for theta_scan states: prefer SOUL.md underlyings; do not default to SPX/SPY/QQQ unless the user's policy lists them.
- **THETA-PROMPTS-12.md v1.1** — Prompt 1 (SOUL Thesis Credit Spread Scanner), Prompt 9 (SOUL Thesis Weekly Income Calendar) now reference SOUL thesis names. Prompts 4, 5, 11 use SOUL names in inputs. Prompts 2, 6 retain SPX as market regime indicator (correct use — SPX is the regime proxy, not the underlying).
- **System prompt** — THETA-POLICY summary injected at startup when `~/.dexter/THETA-POLICY.md` is present.
- **Heartbeat** — Optional: when tastytrade and theta policy are configured, heartbeat includes a "theta check" (any short options expiring this week? any roll/repair suggested?) without submitting orders.

---

## 9. Safety and Guardrails

| Guardrail | Implementation |
|-----------|----------------|
| **Dry-run first** | `strategy_preview` and `roll_short_option` always call `tastytrade_order_dry_run` before any submit path. Submit only via separate user confirmation. |
| **Explicit confirmation** | Phase 3 order tools require user opt-in (`TASTYTRADE_ORDER_ENABLED=true`) and explicit confirmation before any live order. Phase 5 tools never auto-submit. |
| **Policy enforcement (hard block)** | `theta_scan` excludes policy-violating candidates before ranking — only compliant candidates returned. `strategy_preview` validates against THETA-POLICY before dry-run; if violated, returns `policy_blocked: true` + violations list and does not recommend. |
| **No-call enforcement** | Covered calls on Core Compounders (default no-call list) are hard-blocked at scan and preview. |
| **Concentration checks** | Position risk and theta scan output concentration by underlying; agent flags when candidate would exceed target weight from PORTFOLIO.md. |
| **Earnings filter** | When `exclude_earnings=true`, scan skips underlyings with earnings within the configured window. When `FINANCIAL_DATASETS_API_KEY` is missing, returns `earnings_exclusion_degraded` so user knows filter wasn't applied. |

---

## 10. Success Criteria

### Phase 5 Core ✅
- [x] `tastytrade_position_risk` — enriched view with DTE, concentration, challenged shorts
- [x] `tastytrade_theta_scan` — SOUL-aligned underlyings; hard-block policy; `excluded_by_policy`, `excluded_by_earnings`, `earnings_exclusion_degraded`, `no_candidates` + `next_steps`
- [x] `tastytrade_strategy_preview` — trade memo + THETA-POLICY validation (`policy_blocked: true/false`); submit requires explicit user approval
- [x] `tastytrade_roll_short_option`, `tastytrade_repair_position` — roll/close/assignment with rationale; submit only when user confirms + `TASTYTRADE_ORDER_ENABLED=true`
- [x] THETA-POLICY.md documented; missing file falls back to SOUL-aligned code defaults (not SPX/SPY/QQQ/IWM)

### SOUL Alignment ✅
- [x] `loadThetaPolicy()` defaults: SOUL thesis names across 7 layers + cyclical adjacents
- [x] No-call list defaults: SOUL Core Compounders (TSM, ASML, AMAT, LRCX, KLAC, SNPS, CDNS, ANET, CEG)
- [x] SPX/SPY/QQQ/IWM removed from all code defaults
- [x] THETA-POLICY.md, THETA-POLICY.example.md, TASTYTRADE.md, THETA-PROMPTS-12.md v1.1 all updated
- [x] Theta scan tool description updated: prefer SOUL.md underlyings; do not default to indices
- [x] Non-tradeable SOUL names documented: HYPE/SOL/NEAR/SUI/ETH (crypto only), BESI/BESIY, TEL/TOELY (thin ADR options), NVDA/MSTR (SOUL "Avoid" tier)

### Phase 5 Integration ✅
- [x] THETA-POLICY summary injected into system prompt when present
- [x] PORTFOLIO.md injected into system prompt for portfolio-fit checks
- [x] `tastytrade_earnings_calendar` defaults to THETA-POLICY underlyings + current positions

---

## 11. Non-Goals

- **Streaming / real-time Greeks** — REST polling only; no DXLink or live stream.
- **Backtesting** — tastytrade backtesting API out of scope.
- **Multi-strategy automation** — No automatic scheduling or auto-submit; user or heartbeat triggers.
- **Tax or lot accounting** — Roll/repair suggests economic roll; tax implications are user responsibility.
- **Replacing THETA-PROMPTS-12** — The 12 prompts (now v1.1, SOUL-aligned) remain the canonical reasoning layer; Phase 5 adds tools and policy.

---

## 12. References

- [PRD-TASTYTRADE-INTEGRATION.md](PRD-TASTYTRADE-INTEGRATION.md) — Phases 1–4 and 6, auth, portfolio sync, order flow.
- [DATA-API-TASTYTRADE.md](DATA-API-TASTYTRADE.md) — Endpoints and tool behavior.
- [THETA-PROMPTS-12.md](THETA-PROMPTS-12.md) — Canonical theta workflows (v1.1, SOUL-aligned).
- [THETA-POLICY.md](THETA-POLICY.md) — Policy file format and field reference.
- [THETA-POLICY.example.md](THETA-POLICY.example.md) — Example policy with SOUL layers annotated.
- [SOUL.md](../SOUL.md) — Thesis, conviction tiers, coverage universe.
- [TASTYTRADE-SYMBOLOGY.md](TASTYTRADE-SYMBOLOGY.md) — OCC symbol mapping + SOUL ADR notes.
- [tastytrade Developer Portal](https://developer.tastytrade.com/) — API reference.
