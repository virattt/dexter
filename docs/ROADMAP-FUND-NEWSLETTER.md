# Roadmap: Fund on Autopilot + Newsletter

**Version:** 1.0  
**Last Updated:** 2026-03-07

Plan to ship: fund operations, newsletter automation, and brand consistency for [ikigaistudio Substack](https://ikigaistudio.substack.com/).

**Status:** Phases 1–5 shipped. Phase 6 (Substack API, drawdown) optional.

---

## Phase 1 — Brand & Voice ✅ Shipped

**Goal:** Every Dexter output matches ikigaistudio's writing style.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 1.1 | Create `docs/VOICE.md` — tone, phrases, structure, 2–3 example excerpts from published essays, tagline anchor | Small | `docs/VOICE.md` |
| 1.2 | Load VOICE in agent bootstrap (like SOUL) — `loadVoiceDocument()`, inject into system prompt | Small | `src/agent/prompts.ts`, `src/agent/channels.ts` or config |
| 1.3 | Add "Voice & Output Style" section to system prompt — reference VOICE, brand checklist | Small | `src/agent/prompts.ts` |
| 1.4 | Update Query 5 with few-shot example paragraph | Small | `docs/ULTIMATE-TEST-QUERIES.md` |
| 1.5 | Add VOICE.md to README docs table | Trivial | `README.md` |

**Deliverable:** Reports, essay drafts, and newsletter snippets sound like ikigaistudio.

---

## Phase 2 — Heartbeat Upgrades ✅ Shipped

**Goal:** Heartbeat produces newsletter-ready output and regime context.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 2.1 | **Regime label** — Add to heartbeat prompt: "Output one line: Regime: risk-on / risk-off / mixed. Basis: BTC, Gold, SPY direction." | Small | `src/gateway/heartbeat/prompt.ts` |
| 2.2 | **Weekly newsletter draft** — When Monday + noteworthy: "Draft a 150–250 word Substack snippet. Save to ~/.dexter/WEEKLY-DRAFT-YYYY-MM-DD.md via save_report." | Small | `src/gateway/heartbeat/prompt.ts`, `docs/VOICE.md` ref |
| 2.3 | **Concentration alerts** — In weekly rebalance: "Flag any position >X% above target (e.g. TSM 18% vs 12% target). Recommend trim amount." | Small | `src/gateway/heartbeat/prompt.ts`, SOUL sizing rules |
| 2.4 | Add Query 6 — "Draft weekly newsletter snippet" (standalone, for manual run) | Trivial | `docs/ULTIMATE-TEST-QUERIES.md` |

**Deliverable:** Heartbeat outputs regime + concentration alerts + optional weekly draft.

---

## Phase 3 — AUM & Dollar Rebalancing ✅ Shipped

**Goal:** Agent recommends specific dollar amounts for rebalancing.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 3.1 | Add `~/.dexter/config.json` (or extend existing) — `aum`, `inceptionDate` | Small | Config schema, `src/utils/config.ts` or new |
| 3.2 | Portfolio tool or new config tool — `view`/`update` for AUM | Small | `src/tools/portfolio/` or `src/tools/config/` |
| 3.3 | Heartbeat + rebalance logic — "Given AUM $X, current weights, target weights: output Sell $Y of Ticker, Buy $Z of Ticker" | Medium | `src/gateway/heartbeat/prompt.ts`, agent reasoning |
| 3.4 | Document config in README / PRD | Trivial | `README.md`, `docs/PRD-PORTFOLIO-BUILDER.md` |

**Deliverable:** Rebalance recommendations in dollar terms.

---

## Phase 4 — Cumulative Performance Tracking ✅ Shipped

**Goal:** YTD and since-inception returns vs benchmarks.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 4.1 | Create `~/.dexter/performance-history.json` — `{ "quarters": [{ "period": "2026-Q1", "portfolio": -5.8, "btc": -23.6, "spy": -1.6, "gld": 22.9 }] }` | Medium | New file format, migration |
| 4.2 | Report tool or new tool — append quarterly result when saving QUARTERLY-REPORT | Medium | `src/tools/report/report-tool.ts` or extend |
| 4.3 | Agent prompt — "When writing quarterly report, read performance-history.json, compute YTD and since-inception, include in report" | Small | `src/agent/prompts.ts`, heartbeat |
| 4.4 | Inception date from config — use for "since inception" calc | Small | Phase 3 config |

**Deliverable:** Quarterly reports include YTD and since-inception vs BTC, SPY, GLD.

---

## Phase 5 — Investor Letter & Newsletter Archive ✅ Shipped

**Goal:** Structured investor letter template + newsletter archive in repo.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 5.1 | **Investor letter template** — Add Query 7: "Turn quarterly report into investor letter format: Performance, Attribution, Regime, Outlook" | Small | `docs/ULTIMATE-TEST-QUERIES.md` |
| 5.2 | **Newsletter archive** — Create `docs/newsletter/` with index: published essays, dates, key thesis takeaways | Small | `docs/newsletter/README.md`, add links |
| 5.3 | Link archive to VOICE — "Example essays: [list]" for few-shot | Trivial | `docs/VOICE.md` |

**Deliverable:** Investor letter query + living newsletter archive.

---

## Phase 6 — Optional / Later

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 6.1 | Substack API integration — auto-create draft from WEEKLY-DRAFT | Medium | Requires Substack API, auth |
| 6.2 | Drawdown tracking — max drawdown, alert if >X% | Medium | Needs historical series |
| 6.3 | Sharpe ratio, risk metrics | Medium | Needs return series, volatility |

---

## Dependency Graph

```
Phase 1 (VOICE) ──────────────────────────────────────────┐
     │                                                     │
     └──► Phase 2 (Heartbeat) ──► Phase 5 (Archive)        │
     │         │                        │                  │
     │         │                        └──► VOICE examples
     │         │
     │         └──► Phase 3 (AUM) ──► Phase 4 (Cumulative)
     │
     └──► Query 5 few-shot, all outputs on-brand
```

---

## Suggested Ship Order

| Week | Phase | Focus |
|------|-------|-------|
| 1 | Phase 1 | VOICE.md, prompt injection, Query 5 update |
| 2 | Phase 2 | Regime label, weekly draft, concentration alerts |
| 3 | Phase 3 | AUM config, dollar rebalancing |
| 4 | Phase 4 | Performance history, YTD/since-inception |
| 5 | Phase 5 | Investor letter query, newsletter archive |

---

## Success Criteria

- [ ] All reports and drafts pass "sounds like ikigaistudio" test
- [ ] Heartbeat outputs regime + concentration alerts
- [ ] Weekly draft saved when noteworthy
- [ ] Rebalance recommendations include dollar amounts (when AUM set)
- [ ] Quarterly report includes YTD and since-inception
- [ ] Newsletter archive maintained
