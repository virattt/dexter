# PRD: Hyperliquid Portfolio — Full Parity with Main Portfolio

**Status:** Draft  
**Last Updated:** 2026-03-07  
**Depends on:** [PRD-HYPERLIQUID-PORTFOLIO.md](PRD-HYPERLIQUID-PORTFOLIO.md) (Phases 1–4 shipped)

---

## 1. Goal

The **Recommended HIP-3 portfolio** (saved to `~/.dexter/PORTFOLIO-HYPERLIQUID.md`) should have **full parity** with the main portfolio:

1. **Investment thesis** — A clear, documented thesis that defines the target allocation (like SOUL.md for the main portfolio)
2. **Weekly rebalancing** — Heartbeat compares HL holdings to target, flags drift, recommends trim/add
3. **Quarterly performance tracking** — Dedicated quarterly report, YTD/since-inception vs benchmarks, `performance_history` integration
4. **Essay publish** — Turn quarterly report into a reflection essay with clear investment thesis, ready for Substack

Same logic as the main portfolio, but scoped to the on-chain (HIP-3) universe.

---

## 2. Current State vs Target

| Capability | Main Portfolio | Hyperliquid Portfolio (Current) | Target |
|------------|----------------|----------------------------------|--------|
| **Target definition** | SOUL.md (thesis, layers, tiers) | None — agent infers from SOUL | SOUL-HL.md or equivalent |
| **Weekly rebalance** | Heartbeat compares to SOUL target | Heartbeat loads HL but no target comparison | Full rebalance check vs HL thesis |
| **Concentration alerts** | Flag positions >5% above target | Not scoped to HL | Same logic for HL positions |
| **Quarterly report** | QUARTERLY-REPORT-YYYY-QN.md | Folds into main report (if HL exists) | QUARTERLY-REPORT-HL-YYYY-QN.md (dedicated) |
| **Performance history** | portfolio, btc, spy, gld | portfolio_hl, hl_basket (optional) | Mandatory portfolio_hl in record_quarter |
| **Essay draft** | Query 5 — reflection from quarterly report | None | Query 10 — HL reflection essay |
| **Investor letter** | Query 7 — structured letter | None | Query 11 — HL investor letter |
| **Weekly newsletter draft** | WEEKLY-DRAFT-YYYY-MM-DD.md | Same file (combined?) | WEEKLY-DRAFT-HL-YYYY-MM-DD.md (optional) or combined |

---

## 3. Investment Thesis for HIP-3 Portfolio

### 3.1 Document: SOUL-HL.md or HEARTBEAT-HL section

Define the **target** allocation for the Hyperliquid portfolio. Without this, the agent cannot compare current holdings to target for rebalancing.

**Proposed structure** (mirrors SOUL.md but scoped to HL universe):

```markdown
# HIP-3 Portfolio Thesis

## Core
- BTC: 35–40% — Base layer
- HYPE: 10–15% — Onchain equities / HIP-3 direct exposure

## Agentic Web4 (L1)
- SOL: 8–12%
- ETH: 6–10%
- NEAR: 4–6%
- SUI: 4–6%

## AI Infra / Software
- ORCL, PLTR: 4–8% combined

## Tokenization & Rails
- COIN, HOOD, CRCL: 4–8% combined

## Hyperscalers (optional)
- AMZN, MSFT, GOOGL: 0–3% each

## Sizing Rules
- Regime determines size; conviction determines inclusion
- No single position >15% except BTC
- Concentration alert threshold: >5% above target
```

**Location options:**
- `docs/SOUL-HL.md` — bundled, versioned
- `~/.dexter/SOUL-HL.md` — user override (like SOUL.md)
- Section in `HEARTBEAT.md` — "## HIP-3 Target" (simpler, single file)

**Recommendation:** Start with a section in `HEARTBEAT.example.md` and `~/.dexter/HEARTBEAT.md`. Copy-paste template for "HIP-3 target allocation". Agent reads it when PORTFOLIO-HYPERLIQUID.md exists.

---

## 4. Weekly Rebalancing (HL)

### 4.1 Heartbeat Logic

When `PORTFOLIO-HYPERLIQUID.md` exists **and** a HIP-3 target is defined (SOUL-HL or HEARTBEAT section):

1. **Load** PORTFOLIO-HYPERLIQUID.md and target
2. **Compare** current weights to target weights
3. **Flag** positions >5% above target (concentration alerts)
4. **Recommend** trim/add actions (e.g. "Trim HYPE 2%, add to SOL")
5. **Dollar rebalancing** — If AUM is set and user wants HL-specific rebalancing, output "Sell $X of Ticker, Buy $Y of Ticker" for HL positions

### 4.2 AUM Handling

**Option A (simple):** Single AUM in fund-config. User mentally allocates (e.g. 70% main, 30% HL). Rebalance recommendations are in % terms; user converts.

**Option B (full):** Add `aum_hl` to fund-config for HL-specific dollar rebalancing. When set, heartbeat outputs dollar amounts for HL rebalance.

**Recommendation:** Phase 1 — % terms only. Phase 2 — add `aum_hl` if needed.

---

## 5. Quarterly Performance Tracking (HL)

### 5.1 Dedicated Report

**File:** `~/.dexter/QUARTERLY-REPORT-HL-YYYY-QN.md`

**Content:**
- Portfolio return (weighted) for the quarter
- Benchmark returns: BTC, SPY, GLD, hl_basket
- Category attribution: Core (BTC), L1 (SOL/ETH/NEAR/SUI), AI infra, tokenization, hyperscalers
- Best/worst performers
- Regime assessment
- YTD and since-inception (from performance_history)
- Outlook and rebalance recommendations

### 5.2 Performance History

**Mandatory fields when HL portfolio exists:**
- `portfolio_hl` — return of PORTFOLIO-HYPERLIQUID.md
- `hl_basket` — return of HL benchmark basket (optional but recommended)

**Heartbeat:** When writing quarterly report and PORTFOLIO-HYPERLIQUID.md exists, agent MUST:
1. Compute portfolio_hl return
2. Optionally compute hl_basket
3. Call `performance_history record_quarter` with portfolio_hl (and hl_basket if computed)
4. Save **two** reports: QUARTERLY-REPORT-YYYY-QN.md (main) and QUARTERLY-REPORT-HL-YYYY-QN.md (HL)

### 5.3 Separate vs Combined Reports

**Option A:** Two reports — main and HL. Clean separation. Two essay drafts.

**Option B:** One combined report with two sections. Simpler file management.

**Recommendation:** Option A — separate reports. Different theses, different audiences, different essay angles.

---

## 6. Essay Publish (HL)

### 6.1 Reflection Essay (Query 10)

**Purpose:** Turn QUARTERLY-REPORT-HL-YYYY-QN.md into a 600–800 word reflection essay.

**Structure:**
1. **The HIP-3 thesis** — What we're betting on (24/7 tradeable, no fiat conversion, tokenization)
2. **What the numbers say** — Which categories validated, which didn't
3. **Regime** — What BTC/Gold/SPY told us; how HL portfolio responded
4. **One sentence** — Tension between thesis and regime

**Voice:** VOICE.md (structural, precise, no hype)

**Output:** Markdown ready for Claude polish → Substack

### 6.2 Investor Letter (Query 11)

**Purpose:** Structured investor letter for the HL portfolio.

**Structure:**
1. Performance — portfolio_hl vs BTC, SPY, GLD, hl_basket; YTD and since-inception
2. Attribution — category-level (Core, L1, AI infra, tokenization)
3. Regime — risk-on/risk-off/mixed
4. Outlook — positioning for next quarter

### 6.3 Weekly Newsletter Draft (HL)

**Option A:** Same WEEKLY-DRAFT-YYYY-MM-DD.md — include both portfolios when both exist.

**Option B:** WEEKLY-DRAFT-HL-YYYY-MM-DD.md — HL-only when user wants separate HL newsletter.

**Recommendation:** Option A for Phase 1. Single weekly draft can have two sections (Main, HIP-3) when both portfolios exist.

---

## 7. Implementation Phases

### Phase 1 — Thesis + Rebalance Logic (Small)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 1.1 | Add HIP-3 target section to HEARTBEAT.example.md | Trivial | docs/HEARTBEAT.example.md |
| 1.2 | Heartbeat: when PORTFOLIO-HYPERLIQUID.md exists, load target from HEARTBEAT.md (section "## HIP-3 Target") or SOUL-HL.md | Small | src/gateway/heartbeat/prompt.ts |
| 1.3 | Heartbeat: weekly rebalance for HL — compare to target, concentration alerts, trim/add recommendations | Small | src/gateway/heartbeat/prompt.ts |
| 1.4 | Document in README / PRD | Trivial | README.md, this PRD |

### Phase 2 — Dedicated Quarterly Report (Small)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 2.1 | Heartbeat: when HL portfolio exists, save QUARTERLY-REPORT-HL-YYYY-QN.md in addition to main report | Small | src/gateway/heartbeat/prompt.ts |
| 2.2 | Heartbeat: mandatory portfolio_hl (and optional hl_basket) in performance_history record_quarter | Small | Already supported; ensure prompt enforces |
| 2.3 | Add Query: "Write quarterly report for my Hyperliquid portfolio" (standalone) | Trivial | docs/ULTIMATE-TEST-QUERIES.md |

### Phase 3 — Essay + Investor Letter (Small)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 3.1 | Add Query 10 — HL reflection essay (from QUARTERLY-REPORT-HL-*.md) | Small | docs/ULTIMATE-TEST-QUERIES.md |
| 3.2 | Add Query 11 — HL investor letter | Small | docs/ULTIMATE-TEST-QUERIES.md |
| 3.3 | Essay workflow doc: add HL loop (Dexter → Claude → Substack for HIP-3) | Trivial | docs/ESSAY-WORKFLOW.md |

### Phase 4 — Optional Enhancements (Medium)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 4.1 | aum_hl in fund-config for HL-specific dollar rebalancing | Small | fund-config schema, heartbeat |
| 4.2 | SOUL-HL.md as standalone thesis doc (like SOUL.md) | Small | loadSoulHLDocument(), prompt |
| 4.3 | HL newsletter archive in docs/newsletter/ | Trivial | Index HL essays |

---

## 8. Example Queries (New)

### Query 10 — HL Reflection Essay

```
Using the quarterly performance report from ~/.dexter/QUARTERLY-REPORT-HL-2026-Q1.md, write a 600–800 word reflection essay for the HIP-3 portfolio. Structure:
1. The HIP-3 thesis — what we're betting on (24/7 tradeable, no fiat conversion, tokenization)
2. What the numbers say — which categories validated, which didn't
3. Regime — what BTC/Gold/SPY told us; how the HL portfolio responded
4. One sentence that captures the tension between thesis and regime

Voice: structural, precise numbers, no hype (VOICE.md). Output markdown ready for Claude polish.
```

### Query 11 — HL Investor Letter

```
Using the quarterly report from ~/.dexter/QUARTERLY-REPORT-HL-*.md, write an investor letter for the Hyperliquid portfolio. Structure:
1. Performance — portfolio vs BTC, SPY, GLD, HL basket; YTD and since-inception
2. Attribution — category-level (Core, L1, AI infra, tokenization)
3. Regime — risk-on/risk-off/mixed
4. Outlook — positioning for next quarter

Voice: structural, precise numbers, no hype (VOICE.md). Output markdown.
```

### Query 12 — HL Quarterly Report (Standalone)

```
Write a quarterly performance report for my Hyperliquid portfolio. Use ~/.dexter/PORTFOLIO-HYPERLIQUID.md. Map HL symbols to FD tickers per docs/HYPERLIQUID-SYMBOL-MAP.md. Fetch 90-day prices for all positions plus BTC-USD, GLD, SPY. Include:
- Portfolio return vs benchmarks (BTC, SPY, GLD, HL basket if computable)
- Category attribution (Core, L1, AI infra, tokenization)
- Best/worst performers
- Regime assessment, outlook
- YTD and since-inception from performance_history
- Save to ~/.dexter/QUARTERLY-REPORT-HL-YYYY-QN.md via save_report
- Call performance_history record_quarter with portfolio_hl (and hl_basket if computed)
```

---

## 9. Success Criteria

- [ ] HIP-3 target defined (HEARTBEAT section or SOUL-HL.md)
- [ ] Weekly rebalance compares HL holdings to target; concentration alerts; trim/add recommendations
- [ ] Quarterly report saved to QUARTERLY-REPORT-HL-YYYY-QN.md when HL portfolio exists
- [ ] performance_history record_quarter includes portfolio_hl (and hl_basket when computed)
- [ ] Query 10 produces HL reflection essay from quarterly report
- [ ] Query 11 produces HL investor letter
- [ ] Essay workflow doc includes HL loop

---

## 10. References

- [PRD-HYPERLIQUID-PORTFOLIO.md](PRD-HYPERLIQUID-PORTFOLIO.md) — Base HL portfolio PRD
- [PRD-PORTFOLIO-BUILDER.md](PRD-PORTFOLIO-BUILDER.md) — Main portfolio logic
- [ROADMAP-FUND-NEWSLETTER.md](ROADMAP-FUND-NEWSLETTER.md) — Phases 1–5 (main portfolio)
- [ESSAY-WORKFLOW.md](ESSAY-WORKFLOW.md) — Dexter → Claude → Substack
- [ULTIMATE-TEST-QUERIES.md](ULTIMATE-TEST-QUERIES.md) — Query library
