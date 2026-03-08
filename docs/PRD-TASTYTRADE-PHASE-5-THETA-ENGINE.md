# PRD: tastytrade Phase 5 — Portfolio-Aware Theta Engine

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-07  
**Reference:** [PRD-TASTYTRADE-INTEGRATION.md](PRD-TASTYTRADE-INTEGRATION.md) | [THETA-PROMPTS-12.md](THETA-PROMPTS-12.md)

---

## 1. Executive Summary

Phase 5 is the first **decision engine** layer for options on top of tastytrade connectivity. Phases 1–4 give Dexter broker truth (positions, balances), market data (option chains, quotes), portfolio sync, heartbeat drift checks, and optional order flow. Phase 5 turns that into **actionable theta workflows**: scan setups, assess portfolio fit, preview trade risk, and support roll/repair logic before optional submission.

**Core value:**
- **Position intelligence** — Enrich live tastytrade positions into a decision-ready view (underlying, DTE, theta/delta risk, assignment risk, concentration).
- **Opportunity scanning** — Find theta setups (covered calls, cash-secured puts, credit spreads, iron condors) that match user constraints and portfolio policy.
- **Strategy preview** — Generate a full trade memo (thesis, legs, risk, exit plan) and dry-run before any submission.
- **Roll/repair workflows** — Support "repair a challenged short option" and "roll or take assignment" decisions.
- **Policy layer** — Every recommendation checked against a persistent theta policy (e.g. no calls on core holdings, concentration caps) so options stay subordinate to the Portfolio Builder north star.

---

## 2. Why Phase 5 Now

- **Broker state exists** — Phases 1–4 provide live positions, balances, option chains, quotes, and (opt-in) order submission. The missing piece is *what trade to do* and *whether it fits*.
- **Theta prompts are defined** — [THETA-PROMPTS-12.md](THETA-PROMPTS-12.md) already specifies the workflows (0DTE scanner, regime classifier, theta decay, strike selection, iron condors, risk management, etc.). Phase 5 operationalizes these with tools and policy.
- **Portfolio Builder sets the bar** — Heartbeat and SOUL.md/PORTFOLIO.md define the target portfolio. Theta income and hedging must be subordinate: no overwriting core thesis positions, no overconcentration, explicit caps.
- **Order flow is last step** — Phase 3 (dry-run, submit, cancel) is the execution layer. Phase 5 sits in front: scan → preview → confirm → then optionally submit via existing tools.

---

## 3. Product Goals

| Goal | Description |
|------|-------------|
| **Portfolio-aware theta** | Every suggested trade is checked against SOUL.md, PORTFOLIO.md, and live tastytrade positions. Flag conflicts (e.g. selling calls on a Core Compounder) and concentration drift. |
| **Small setup universe first** | Initial strategies: covered calls, cash-secured puts, defined-risk credit spreads, iron condors. Expand later (earnings IV crush, jade lizard, etc.). |
| **Scan → preview → confirm** | User flows: "scan today's setup," "show safest income trade," "repair this short put." Agent returns ranked candidates and a trade memo; submission only after explicit user confirmation. |
| **Persistent policy** | A user-editable policy file (e.g. `~/.dexter/THETA-POLICY.md`) defines what theta trades are allowed: ticker restrictions, delta/DTE bounds, max risk per trade, earnings/event filters. |

---

## 4. User Workflows

| Flow | User intent | Agent actions |
|------|-------------|---------------|
| **Scan today's setup** | "What 0DTE SPX credit spread should I do today?" / "Best iron condor for SPY this week?" | Call position risk (optional), fetch option chain + quote, apply regime/IV context, return ranked setups with strikes, credit, max loss, and portfolio-fit note. |
| **Safest income trade** | "What's the safest theta trade given my account and policy?" | Use balances + positions + THETA-POLICY; filter by allowed underlyings and risk caps; return 1–3 candidates with rationale. |
| **Strategy preview** | "Preview this iron condor before I submit." | Build trade memo (thesis, legs, credit, breakevens, buying power effect); call tastytrade_order_dry_run; return memo + dry-run result. User confirms before submit. |
| **Repair challenged short** | "My short put is in the money with 2 DTE — roll or take assignment?" | Enrich position (underlying, strike, DTE, P&amp;L); fetch roll options (same/next expiration); compare roll cost vs assignment + wheel; recommend with rationale. |
| **Roll short option** | "Roll my AAPL 150 put to next week." | Resolve current position, get target expiration strikes, build roll order (close + open), dry-run, then submit only after user confirmation. |

---

## 5. Proposed Tools

| Tool | Purpose | Inputs (conceptual) | Outputs (conceptual) |
|------|---------|---------------------|---------------------|
| **tastytrade_position_risk** | Enrich live positions into a decision-ready risk view. | Optional `account_number`. | Per-position: underlying, symbol, quantity, side (long/short), DTE, option type, strike; aggregate: theta/delta/gamma/vega if available, assignment risk, concentration by underlying, % of buying power in use. |
| **tastytrade_theta_scan** | Find theta opportunities that match policy and constraints. Policy is enforced as a **hard block**: only compliant candidates with portfolio_fit pass are returned. | Underlying(s) or watchlist, strategy type (covered_call, cash_secured_put, credit_spread, iron_condor), DTE range, delta range, min credit, max buying power, exclude_earnings (bool). | Ranked list of compliant candidates: underlying, strategy, strikes, credit, max loss, breakevens, DTE, delta, portfolio_fit; `policy_mode: "hard_block"`; `excluded_by_policy` (reason buckets) and `excluded_by_earnings` when applicable; `earnings_exclusion_degraded` when exclusion requested but API key missing; when zero candidates pass, `no_candidates: true` and `next_steps`. |
| **tastytrade_strategy_preview** | Produce a full trade memo and dry-run result without submitting. Validates order against THETA-POLICY first; if violated, returns **policy_blocked** and does not recommend. | Candidate trade (underlying, strategy, legs) or explicit leg list. | When compliant: `policy_blocked: false`, trade memo (thesis, setup type, legs, credit/debit, max profit/loss, breakevens, buying power effect, portfolio_fit, exit plan, invalidation, roll plan), dry-run result if order flow enabled. When violated: `policy_blocked: true`, `violations` (list), `note` (do not submit). |
| **tastytrade_roll_short_option** | Suggest and optionally execute a roll (close + open) for a short option. | Position identifier (symbol or position id), target expiration (or "next week"). | Roll options: same-DTE roll, next expiration roll; cost, net credit/debit; recommended roll; dry-run; submit only after confirmation. |
| **tastytrade_repair_position** | Recommend action for a challenged short option (roll, close, or take assignment). | Position identifier. | Current P&amp;L, DTE, assignment risk; options: roll (with strikes/cost), close (cost), take assignment (implications); recommendation with rationale. |

**Registration:** Phase 5 tools are registered when `TASTYTRADE_CLIENT_ID` is set. Roll/repair tools that submit orders require `TASTYTRADE_ORDER_ENABLED=true` for the submit step; preview and scan do not.

**Data dependencies:** Position risk and theta scan depend on tastytrade positions, balances, option chain, and quotes. Greeks/IV may come from tastytrade market data or a future enrichment source; PRD does not mandate a single source.

---

## 6. Policy and Risk Layer

### 6.1 THETA-POLICY.md (proposed)

**Path:** `~/.dexter/THETA-POLICY.md`

A user-editable markdown file that defines what theta trades are allowed. The agent reads it when scanning or previewing. Suggested sections:

| Section | Purpose |
|---------|---------|
| **Allowed underlyings** | SPX, SPY, QQQ, or a watchlist; exclude single names that are core long-term holds. |
| **No-call list** | Tickers on which the user does not sell covered calls (e.g. Core Compounders in SOUL.md). |
| **Delta / DTE bounds** | e.g. short strikes 0.10–0.20 delta; DTE between 1 and 45. |
| **Position sizing** | Max % of account or max dollar risk per trade; max contracts per underlying. |
| **Event filters** | Exclude earnings N days before/after; exclude Fed/CPI days for 0DTE. |
| **Concentration caps** | Cap short premium or delta exposure per underlying or per sector. |

If the file is missing, the agent uses conservative defaults (e.g. index/ETF only, tight delta/DTE) and suggests creating THETA-POLICY.md.

### 6.2 Portfolio Builder alignment

- **SOUL.md** — Defines conviction tiers and "avoid" names. Theta policy should not suggest selling calls on Core Compounders unless explicitly allowed.
- **PORTFOLIO.md** — Target weights and layers. Theta scan should flag when a candidate adds exposure above target (e.g. "NVDA 8% vs 5% target").
- **tastytrade positions** — Source of truth for current option and equity exposure. Position risk tool aggregates by underlying for comparison.

---

## 7. Data Dependencies

| Data | Source (today) | Notes |
|------|----------------|-------|
| Positions / balances | tastytrade (Phase 1) | Already implemented. |
| Option chain / quotes | tastytrade (Phase 2) | Already implemented. |
| Greeks / IV | tastytrade market data or quote response | Use wherever available; if tastytrade does not expose enough, document as future enrichment (e.g. external options analytics). |
| Earnings / events | financial_search or web_search | Used to apply event filters in theta scan. |
| Policy | ~/.dexter/THETA-POLICY.md | New file; agent reads when performing scan/preview. |

---

## 8. Agent and Prompt Integration

- **System prompt / tool descriptions** — Tool descriptions for position_risk, theta_scan, strategy_preview, roll, repair must state when to use each and that submission requires explicit user confirmation after preview/dry-run.
- **THETA-PROMPTS-12.md** — Phase 5 tools supply the *data* and *constraints*; the 12 canonical prompts (0DTE scanner, regime classifier, theta decay, strike selection, iron condor, risk management, etc.) remain the *reasoning* templates. The agent composes: use tools to get positions and chains, then apply the relevant prompt logic to produce the answer.
- **Heartbeat** — Optional: when tastytrade and theta policy are configured, heartbeat can include a "theta check" (e.g. "any short options expiring this week? any roll/repair suggested?") without submitting orders.

---

## 9. Safety and Guardrails

| Guardrail | Implementation |
|-----------|----------------|
| **Dry-run first** | strategy_preview and roll/repair always call tastytrade_order_dry_run before any submit. Submit only via separate user confirmation (e.g. "submit this order?"). |
| **Explicit confirmation** | Phase 3 order tools already require user opt-in. Phase 5 tools must not auto-submit; they return memos and dry-run results. |
| **Policy enforcement (hard block)** | theta_scan excludes policy-violating and portfolio-fit-block candidates before ranking; only compliant candidates are returned. strategy_preview validates the order against THETA-POLICY before dry-run; if violated, returns `policy_blocked: true` and a violations list and does not recommend. Agent must not recommend trades that violate policy. |
| **Concentration checks** | Position risk and theta scan output concentration by underlying; agent flags when a candidate would exceed caps or target weight. |
| **Earnings/event filter** | When exclude_earnings or event filter is set, scan excludes underlyings with earnings in the window when FINANCIAL_DATASETS_API_KEY is available; when the key is missing, scan returns `earnings_exclusion_degraded` so the user knows exclusion was not applied. |

---

## 10. Success Criteria

- [x] **tastytrade_position_risk** returns an enriched view of current positions (underlying, DTE, side, risk metrics where available).
- [x] **tastytrade_theta_scan** returns ranked candidates for covered call, CSP, credit spread, iron condor with policy compliance and SOUL/PORTFOLIO notes.
- [x] **tastytrade_strategy_preview** produces a trade memo and dry-run result; submit requires explicit user approval (same as Hyperliquid).
- [x] **tastytrade_roll_short_option** and **tastytrade_repair_position** suggest roll/close/assignment with rationale; submit only when user confirms and TASTYTRADE_ORDER_ENABLED=true.
- [x] **THETA-POLICY.md** is documented and read when scanning or previewing; missing file falls back to conservative defaults.
- [x] Theta scan and strategy preview check SOUL.md (Core/Avoid tickers) and PORTFOLIO.md (target weights) and add portfolio-fit notes to candidates.

---

## 11. Non-Goals

- **Streaming / real-time Greeks** — REST polling only; no DXLink or live stream requirement for Phase 5.
- **Backtesting** — tastytrade backtesting API is out of scope for this PRD.
- **Multi-strategy automation** — No automatic scheduling of scans or auto-submit; user or heartbeat triggers actions.
- **Tax or lot accounting** — Roll/repair suggests economic roll; tax implications (e.g. wash sale) are user responsibility.
- **Replacing THETA-PROMPTS-12** — The 12 prompts remain the canonical reasoning layer; Phase 5 adds tools and policy, not a new prompt set.

---

## 12. References

- [PRD-TASTYTRADE-INTEGRATION.md](PRD-TASTYTRADE-INTEGRATION.md) — Phases 1–4, auth, portfolio sync, order flow.
- [DATA-API-TASTYTRADE.md](DATA-API-TASTYTRADE.md) — Endpoints and tool behavior.
- [THETA-PROMPTS-12.md](THETA-PROMPTS-12.md) — Canonical theta workflows (0DTE, regime, theta decay, strike selection, iron condor, risk, etc.).
- [PRD-PORTFOLIO-BUILDER.md](PRD-PORTFOLIO-BUILDER.md) — North star, SOUL.md, heartbeat, PORTFOLIO.md.
- [TASTYTRADE-SYMBOLOGY.md](TASTYTRADE-SYMBOLOGY.md) — Option symbol mapping for underlying aggregation.
- [tastytrade Developer Portal](https://developer.tastytrade.com/) — API reference, market data, order management.
