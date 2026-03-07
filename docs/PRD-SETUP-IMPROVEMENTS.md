# PRD: Dexter Setup Improvements — Ship It All

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-07

---

## 1. Executive Summary

This PRD consolidates **all setup and operational improvements** identified for Dexter into a single, phased roadmap. Goals: **resilience** (fallbacks, validation), **operability** (backup, health checks, CLI triggers), **observability** (cost, tracing), and **developer experience** (wizard, shortcuts, CI).

---

## 2. Scope Overview

| Phase | Theme | Items | Effort |
|-------|-------|-------|--------|
| **Phase 1** | Fail fast & protect data | Env validation, backup script | Low |
| **Phase 2** | Operability | CLI heartbeat trigger, health check endpoint | Low–Medium |
| **Phase 3** | Resilience | Finnhub fallback, Perplexity/Tavily search fallback | Medium |
| **Phase 4** | Observability | Token/cost estimation, LangSmith defaults | Low |
| **Phase 5** | Validation & CI | Portfolio validation tool, evals in CI | Medium |
| **Phase 6** | DX & onboarding | Setup wizard, query shortcuts, README quick validation | Low |
| **Phase 7** | Advanced ops | Heartbeat dry run, SOUL-HL.md support | Low |
| **Phase 8** | Nice-to-have | Options data, macro indicators, Docker Compose | Future |

---

## 3. Phase 1 — Fail Fast & Protect Data

### 3.1 Env Validation on Startup

**Problem:** Missing or invalid API keys cause cryptic failures mid-query.

**Solution:** Validate required env vars at startup (CLI, gateway, API server). Exit with a clear message if critical keys are missing.

**Required keys (block startup):**
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (at least one LLM)
- `FINANCIAL_DATASETS_API_KEY`

**Optional keys (warn only):**
- `EXASEARCH_API_KEY` / `TAVILY_API_KEY` — web search degraded
- `LANGSMITH_API_KEY` — tracing disabled

**Implementation:**
- New module: `src/utils/env-validation.ts`
- `validateEnv(options?: { strict?: boolean })` → `{ ok: boolean; errors: string[]; warnings: string[] }`
- Call from `src/index.tsx` (CLI), `src/gateway/index.ts`, `src/gateway/api-server.ts`
- On failure: print errors, exit 1

**Acceptance criteria:**
- [ ] Missing OPENAI + ANTHROPIC → exit 1 with "Set OPENAI_API_KEY or ANTHROPIC_API_KEY"
- [ ] Missing FINANCIAL_DATASETS_API_KEY → exit 1 with "Set FINANCIAL_DATASETS_API_KEY for market data"
- [ ] Missing EXA/TAVILY → warn, continue
- [ ] All present → no output, normal startup

---

### 3.2 Backup Script for ~/.dexter

**Problem:** PORTFOLIO, performance-history, HEARTBEAT, fund-config are critical. No automated backup.

**Solution:** Shell script that backs up `~/.dexter` to a timestamped archive.

**Implementation:**
- New file: `scripts/backup-dexter.sh`
- Backs up: `~/.dexter/*.md`, `~/.dexter/*.json`, `~/.dexter/scratchpad/` (optional)
- Output: `~/.dexter-backups/dexter-YYYY-MM-DD-HHMMSS.tar.gz`
- Excludes: `gateway.json` (contains auth), large cache dirs
- Add to README: "Back up: `bash scripts/backup-dexter.sh`"

**Acceptance criteria:**
- [ ] Script creates `~/.dexter-backups/` if missing
- [ ] Archive includes PORTFOLIO.md, PORTFOLIO-HYPERLIQUID.md, HEARTBEAT.md, fund-config.json, performance-history.json
- [ ] Archive excludes gateway.json
- [ ] Idempotent; can run multiple times per day

---

## 4. Phase 2 — Operability

### 4.1 CLI Heartbeat Trigger

**Problem:** Heartbeat only runs when the gateway is up. No way to run heartbeat manually (e.g. cron) without full gateway.

**Solution:** New CLI command or script that runs a single heartbeat cycle and outputs the result (no WhatsApp send, or optional send).

**Implementation:**
- New script: `src/scripts/run-heartbeat.ts` or `bun run heartbeat`
- Loads `buildHeartbeatQuery()`, runs agent, prints answer to stdout
- Flags: `--dry-run` (build query only, no agent), `--send` (optional: send via gateway if configured)
- For cron: `0 9 * * 1 cd /path/to/dexter && bun run heartbeat` (Mondays 9am)

**Acceptance criteria:**
- [ ] `bun run heartbeat` runs one heartbeat cycle and prints result
- [ ] `bun run heartbeat --dry-run` prints the built query only
- [ ] Works without gateway running
- [ ] README documents cron example

---

### 4.2 Health Check Endpoint

**Problem:** No way to verify API server readiness (keys, FD connectivity).

**Solution:** `GET /health` (or `/api/health`) returns status of critical dependencies.

**Implementation:**
- Add to `src/gateway/api-server.ts` (or wherever HTTP API lives)
- Response: `{ status: 'ok' | 'degraded', checks: { llm: boolean, financialDatasets: boolean, search?: boolean } }`
- LLM: verify at least one key present
- FD: optional HEAD or lightweight request to FD API
- Search: EXA or TAVILY key present

**Acceptance criteria:**
- [ ] `GET /health` returns 200 when all critical checks pass
- [ ] Returns 503 when FD or LLM check fails
- [ ] Response includes which checks failed

---

## 5. Phase 3 — Resilience

### 5.1 Finnhub Fallback

**Problem:** FD outage or rate limit → all finance queries fail.

**Solution:** Implement [PRD-FINNHUB-SUBAGENTS.md](PRD-FINNHUB-SUBAGENTS.md). Finnhub free tier (60 calls/min) as fallback for `get_stock_price`, `get_company_news`, `get_stock_prices` (candles).

**Implementation:**
- Add `FINNHUB_API_KEY` to env.example (free tier: get key at finnhub.io)
- Create `src/tools/finance/finnhub/` with quote, profile, news, candle clients
- In each FD subagent: on FD error or 429, retry with Finnhub
- Rate-limit Finnhub calls (60/min) to respect free tier

**Acceptance criteria:**
- [ ] FD 429 or 5xx → Finnhub used for quote, news, candles
- [ ] Finnhub free tier respected (no 403)
- [ ] FD remains primary when healthy

---

### 5.2 Perplexity/Tavily Search Fallback

**Problem:** Exa is primary search; if it fails, web search fails entirely.

**Solution:** When Exa fails (or key missing), fall back to Tavily, then Perplexity (keys already in env).

**Implementation:**
- In `web_search` tool or search routing: try Exa → Tavily → Perplexity
- Order: Exa (best for research) → Tavily (good) → Perplexity (fallback)

**Acceptance criteria:**
- [ ] Exa fails → Tavily used
- [ ] Both fail → Perplexity used
- [ ] Log which provider was used (debug)

---

## 6. Phase 4 — Observability

### 6.1 Token/Cost Estimation

**Problem:** No visibility into cost per query.

**Solution:** Post-run summary (CLI and/or scratchpad) with tokens used and estimated cost.

**Implementation:**
- LangChain callbacks already expose usage in some providers
- Add callback or wrapper that aggregates `prompt_tokens`, `completion_tokens`
- At end of run: print `Tokens: X prompt, Y completion | Est. cost: $Z` (use rough pricing: GPT-4 ~$0.03/1K input, ~$0.06/1K output)
- Optional: append to scratchpad JSONL

**Acceptance criteria:**
- [ ] CLI shows token summary after each query
- [ ] Cost estimate uses configurable rates (or defaults for OpenAI/Anthropic)

---

### 6.2 LangSmith Tracing Defaults

**Problem:** `LANGSMITH_TRACING=false` by default; users don't discover tracing.

**Solution:** Document in README; add `LANGSMITH_TRACING=true` to env.example with comment. Consider enabling when `LANGSMITH_API_KEY` is set (opt-in by setting key).

**Implementation:**
- env.example: `LANGSMITH_TRACING=true` (user can disable)
- README: "Set LANGSMITH_API_KEY and LANGSMITH_TRACING=true to trace tool calls and debug failures"

**Acceptance criteria:**
- [ ] README explains LangSmith setup
- [ ] When key + tracing enabled, traces appear in LangSmith project

---

## 7. Phase 5 — Validation & CI

### 7.1 Portfolio Validation Tool

**Problem:** Invalid PORTFOLIO.md (weights ≠ 100%, bad tickers) causes confusing rebalance/report failures.

**Solution:** New tool or CLI command that validates portfolio structure.

**Implementation:**
- Tool: `portfolio_validate` or extend `portfolio` with `action: 'validate'`
- Checks: weights sum to 100% (±1% tolerance), required fields (ticker, weight), valid ticker format
- For PORTFOLIO-HYPERLIQUID: validate against HYPERLIQUID-SYMBOL-MAP
- CLI: `bun run validate-portfolio` reads ~/.dexter/PORTFOLIO.md and reports errors

**Acceptance criteria:**
- [ ] Detects weights ≠ 100%
- [ ] Detects missing ticker/weight
- [ ] For HL: validates symbols exist in map
- [ ] Exit 1 if invalid; 0 if valid

---

### 7.2 Evals in CI

**Problem:** Evals exist but aren't run in CI; regressions slip through.

**Solution:** Add GitHub Action (or similar) that runs `bun run src/evals/run.ts --sample 5` on PRs.

**Implementation:**
- `.github/workflows/evals.yml`: on pull_request, run evals with small sample
- Use `--sample 5` to keep run time <5 min
- Optional: gate merge on eval pass (or report only)

**Acceptance criteria:**
- [ ] PR triggers eval run
- [ ] Results visible in Actions
- [ ] Fail if sample accuracy below threshold (optional)

---

## 8. Phase 6 — DX & Onboarding

### 8.1 ~/.dexter Setup Wizard

**Problem:** First-time users must manually create .dexter, copy HEARTBEAT.example, etc.

**Solution:** On first CLI run, if `~/.dexter` missing or empty, prompt to run setup.

**Implementation:**
- `src/utils/setup-wizard.ts`: `ensureDexterDir()` creates `~/.dexter`, copies HEARTBEAT.example.md if no HEARTBEAT.md
- Optionally: prompt for fund-config (aum, inception) and create fund-config.json
- Call from `src/index.tsx` before main loop

**Acceptance criteria:**
- [ ] First run creates ~/.dexter if missing
- [ ] Copies HEARTBEAT.example.md → HEARTBEAT.md if HEARTBEAT.md missing
- [ ] No prompt if already configured (idempotent)

---

### 8.2 Query Shortcuts in CLI

**Problem:** Users must copy-paste long queries from ULTIMATE-TEST-QUERIES.

**Solution:** Slash commands that expand to full query text.

**Implementation:**
- Commands: `/weekly`, `/quarterly`, `/hl-report`, `/hl-essay`, `/suggest`, `/suggest-hl`
- Map to Query 2, 4, 12, 10, 1, 8 respectively
- In CLI input handler: if input starts with `/weekly`, replace with full query before sending to agent

**Acceptance criteria:**
- [ ] `/weekly` → Query 2 text
- [ ] `/quarterly` → Query 4 text
- [ ] `/suggest-hl` → Query 8 text
- [ ] List in README and ULTIMATE-TEST-QUERIES

---

### 8.3 README Quick Validation

**Problem:** No quick way to verify setup works.

**Solution:** Add "Quick validation" section to README with a 4-step checklist.

**Implementation:**
- Section: "Quick validation (5 min)"
- Steps: (1) `bun run start`, (2) paste Query 1, (3) verify PORTFOLIO.md created, (4) run `bun test` and `bun run src/evals/run.ts --sample 3`
- Links to ULTIMATE-TEST-QUERIES

**Acceptance criteria:**
- [ ] README has "Quick validation" section
- [ ] Steps are copy-pasteable

---

## 9. Phase 7 — Advanced Ops

### 9.1 Heartbeat Dry Run

**Problem:** Testing checklist changes requires waiting for next heartbeat or running full agent.

**Solution:** `bun run heartbeat --dry-run` already in Phase 2. Extend to optionally run agent but not send (print only).

**Implementation:**
- `--dry-run`: build query, print, exit
- `--no-send`: run agent, print answer, don't send to WhatsApp (for gateway mode, would need gateway running but skip send — or make this CLI-only)

**Acceptance criteria:**
- [ ] `--dry-run` prints query
- [ ] `--no-send` (or similar) runs agent, prints result, no WhatsApp

---

### 9.2 SOUL-HL.md Support

**Problem:** HL portfolio uses HEARTBEAT "## HIP-3 Target" section; no dedicated thesis file for HL-only context.

**Solution:** Optional `~/.dexter/SOUL-HL.md` (or `docs/SOUL-HL.md`). When present and PORTFOLIO-HYPERLIQUID exists, inject into agent context for HL-specific queries.

**Implementation:**
- Load SOUL-HL.md when HL portfolio in scope (heartbeat, Query 8–12)
- Merge or append to system prompt for HL context
- Template in docs/SOUL-HL.example.md

**Acceptance criteria:**
- [ ] SOUL-HL.md loaded when HL portfolio used
- [ ] Agent uses HL thesis for HL rebalance and reports

---

## 10. Phase 8 — Nice-to-Have (Future)

| Item | Description |
|------|--------------|
| **Options/derivatives data** | If FD or another source supports it, options flow could enrich thesis and regime analysis. |
| **Macro indicators** | Fed funds, DXY, VIX in a provider or tool for regime context. |
| **Newsletter scheduling** | Cron to run weekly draft and optionally post to Substack. |
| **Docker Compose** | One-command setup for gateway + API for deployment. |
| **Unified frontend** | See [PRD-UNIFIED-FRONTEND-DEXTER-HEDGEFUND.md](PRD-UNIFIED-FRONTEND-DEXTER-HEDGEFUND.md). |

---

## 11. Implementation Order

| Order | Phase | Item | Rationale |
|-------|-------|------|------------|
| 1 | 1 | Env validation | Prevents confusing failures; quick win |
| 2 | 1 | Backup script | Protects data; trivial to add |
| 3 | 2 | CLI heartbeat trigger | Enables cron; high value |
| 4 | 2 | Health check endpoint | Ops visibility |
| 5 | 4 | Token/cost estimation | Observability; moderate effort |
| 6 | 6 | Setup wizard | Better onboarding |
| 7 | 6 | Query shortcuts | DX win |
| 8 | 5 | Portfolio validation | Prevents bad data |
| 9 | 5 | Evals in CI | Prevents regressions |
| 10 | 3 | Finnhub fallback | Resilience; depends on PRD-FINNHUB |
| 11 | 3 | Search fallback | Resilience |
| 12 | 7 | Heartbeat dry run (extend) | Testing |
| 13 | 7 | SOUL-HL.md | HL parity completeness |

---

## 12. Dependencies

| Item | Depends on |
|------|------------|
| Finnhub fallback | [PRD-FINNHUB-SUBAGENTS.md](PRD-FINNHUB-SUBAGENTS.md) |
| SOUL-HL.md | HL portfolio parity (shipped) |
| Evals in CI | Existing `src/evals/run.ts` |
| Health check | API server (`src/gateway/api-server.ts`) |

---

## 13. Success Metrics

- **Resilience:** FD or Exa outage → queries still succeed (fallback path)
- **Operability:** `bun run heartbeat` works without gateway; backup script exists
- **Observability:** Token/cost visible per query; health endpoint returns 200/503
- **DX:** First-time user can run Query 1 within 5 min; `/weekly` works
- **Quality:** Evals run on every PR; portfolio validation catches invalid files

---

## 14. References

- [PRD-FINNHUB-SUBAGENTS.md](PRD-FINNHUB-SUBAGENTS.md)
- [PRD-HYPERLIQUID-PORTFOLIO-PARITY.md](PRD-HYPERLIQUID-PORTFOLIO-PARITY.md)
- [ULTIMATE-TEST-QUERIES.md](ULTIMATE-TEST-QUERIES.md)
- [AGENTS.md](../AGENTS.md)
