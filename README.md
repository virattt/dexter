# Dexter

**A researcher who thinks. Not a search engine with opinions.**

Dexter is a financial research agent that starts from a thesis and works inward. Before it pulls a single data point, it reads **SOUL.md** — the document that tells it who it is, what it believes, and where the edge lives. The thesis constrains the search space. The data fills the positions. The attribution measures the outcome.

The bar is the **Portfolio Builder**: build and maintain a portfolio aligned with your thesis that beats the benchmarks (S&P 500, NASDAQ, BTC, top hedge funds). The tool doesn’t succeed by answering questions well; it succeeds by producing a portfolio that outperforms. Otherwise it fails the bar. *[More: [The Researcher Who Thinks](https://ikigaistudio.substack.com/p/the-researcher-who-thinks)]*

## Table of Contents

- [What you get](#what-you-get)
- [Customization](#customization)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running Dexter](#running-dexter)
  - [CLI shortcuts](#cli-shortcuts)
- [Project structure](#project-structure)
- [SOUL and HEARTBEAT](#soul-and-heartbeat)
- [Example queries](#example-queries)
- [tastytrade](#tastytrade)
  - [Theta logic (Phase 5)](#theta-logic-phase-5)
- [Hyperliquid](#hyperliquid)
- [Evaluating, rate limits, debugging](#evaluating-rate-limits-debugging)
- [Documentation](#documentation)
- [License](#license)

---

## What you get

Not a chatbot. A **research loop**: plan → execute → validate → refine. A search engine retrieves; a researcher interrogates. When the numbers say one thing and the narrative says another, Dexter digs until it finds which one is lying. Every answer is constrained by **SOUL.md** — your identity and thesis, not a one-off prompt.

You get weekly rebalance checks (Mondays), quarterly benchmark reports, and optional dollar rebalancing when AUM is set. Regime labels, concentration alerts, investor-letter drafts. Fund ops: AUM config, YTD and since-inception performance, reports in `~/.dexter/`. **VOICE.md** gives every response a consistent tone; override at `~/.dexter/VOICE.md`.

**Two portfolios, zero overlap:** tastytrade sleeve (PORTFOLIO.md) for names *not* on Hyperliquid (e.g. AMAT, ASML, LRCX, KLAC, VRT, CEG — no TSM, AAPL, or any HL-tradable ticker). On-chain sleeve (PORTFOLIO-HYPERLIQUID.md) is for **HIP-3 onchain equities only** (tokenized stocks, commodities, indices) — not crypto. Core crypto (BTC, SOL, HYPE, ETH, SUI, NEAR) is held separately (e.g. 80% BTC / 10% SOL / 10% HYPE for options on Hypersurface); the HL sleeve focuses on what HIP-3 uniquely offers: onchain stocks like TSM, NVDA, PLTR, ORCL, COIN, HOOD, CRCL. Use both sleeves. Suggest both. Save both.

**tastytrade:** Full theta engine — SOUL-aligned scan (thesis names, not index defaults), THETA-POLICY hard block, strategy preview, roll/repair, analytics. Dry-run before any live order; submit/cancel require explicit approval.

The thesis is structural. The sizing is tactical. The discipline is the moat.

---

## Customization

This fork extends [virattt/dexter](https://github.com/virattt/dexter) with a defined thesis, data stack, and broker integrations.

| Layer | What | Why |
|-------|------|-----|
| **Portfolio Builder** | Agent owns the outcome: rebalance, benchmark, report. Bar = beat hedge funds, indexes, BTC. Measurement is a number, not “insightful.” | Generic agents answer questions. This one is judged on the portfolio. |
| **SOUL.md** | Identity + thesis: AI infra supply chain (7 layers), conviction tiers, sizing rules. BTC-heavy core; HYPE, SOL/NEAR/SUI/ETH as satellites. “When the evidence conflicts with doctrine, I follow the evidence.” | Not a prompt — a worldview. The edge lives where standard tools can’t see (equipment, EDA, power). SOUL constrains every query. |
| **HEARTBEAT** | Weekly rebalance vs target. Quarterly report vs S&P, NASDAQ, BTC. Regime label. Newsletter draft when it matters. Dollar rebalancing when AUM set. | Passive monitoring isn't enough. Scheduled action: detect drift, deliver reports. |
| **VOICE.md** | ikigaistudio tone and structure in every prompt. | Generic output sounds generic. Essays and letters need a recognizable voice. |
| **Financial Datasets** | Primary source for prices, fundamentals, filings, insider trades, news. Optional Finnhub fallback for price/news when FD is down or rate-limited. | Built for agents: section-level filings, structured JSON. [DATA-API-FINANCIAL-DATASETS.md](docs/DATA-API-FINANCIAL-DATASETS.md). |
| **tastytrade** | 6 shipped phases: accounts + positions + balances (Ph 1), option chain + quote (Ph 2), dry-run/submit/cancel (Ph 3, opt-in), portfolio sync with Target/Actual/Gap + heartbeat (Ph 4), SOUL-aligned theta engine — scan, preview, roll, repair (Ph 5), analytics — transactions, earnings calendar, watchlist, risk metrics scorecard (Ph 6). | Live broker data vs static PORTFOLIO.md. Theta scan defaults to SOUL thesis names — not SPX/SPY/QQQ. THETA-POLICY hard block + no-call list protects Core Compounders. Dry-run before any live order; submit/cancel require explicit approval. [PRD-TASTYTRADE-INTEGRATION.md](docs/PRD-TASTYTRADE-INTEGRATION.md), [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](docs/PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md). |
| **Hyperliquid** | HIP-3 data, liquidity ranking, period returns, portfolio ops, live sync, order preview, opt-in execution with approval. **HL sleeve = onchain equities only** (TSM, NVDA, PLTR, COIN, HOOD, CRCL, etc.) — no BTC/SOL/HYPE/ETH/SUI/NEAR (those live in the core crypto portfolio). | Third portfolio: on-chain, 24/7, preview-first then execute when you say. [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md). |

Core thesis: BTC HODL is the foundation. Diversification satellites are HYPE and SOL/NEAR/SUI/ETH. The AI infrastructure universe is the opportunity set. Dexter helps decide when to diversify — and when HODLing is the right call.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| [Bun](https://bun.com) v1.0+ | Primary runtime |
| OpenAI API key | Required. [Get one](https://platform.openai.com/api-keys). |
| Financial Datasets API key | Required for market data. [Get one](https://financialdatasets.ai). |
| Exa API key | Optional, for web search. |
| tastytrade OAuth | Optional, for positions and options workflows. [developer.tastytrade.com](https://developer.tastytrade.com/). |

Install Bun:

```bash
curl -fsSL https://bun.com/install | bash   # macOS/Linux
# Windows: powershell -c "irm bun.sh/install.ps1|iex"
```

Restart the terminal. Verify: `bun --version`.

---

## Installation

```bash
git clone https://github.com/virattt/dexter.git
cd dexter
bun install
cp env.example .env
```

Edit `.env`: set at least `OPENAI_API_KEY` and `FINANCIAL_DATASETS_API_KEY`. Optional: Exa, Finnhub, tastytrade client ID/secret, Hyperliquid address. See comments in `env.example`.

---

## Running Dexter

```bash
bun start          # Interactive CLI
bun dev            # Watch mode
bun run typecheck  # Types only
bun test           # Tests
bun run heartbeat # Single heartbeat cycle (no gateway)
bun run heartbeat -- --dry-run   # Print query only
bun run validate-portfolio       # Exit 1 if weights ≠ 100% or HL symbols invalid
```

When the HTTP API is running, **GET /health** returns 200 when LLM and Financial Datasets are configured, 503 otherwise (response includes `checks` and `failed`). **GET /health?probe=true** runs a real FD reachability check.

Quick validation:

```bash
bun run typecheck && bun test && bun run heartbeat -- --dry-run && bun run validate-portfolio
```

Type a shortcut in the CLI to run a full query; see [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) for the full library.

### CLI shortcuts

| Shortcut | What it does |
|----------|--------------|
| **Portfolio & reports** | |
| `/suggest` | Suggest and save two portfolios (tastytrade sleeve + Hyperliquid sleeve) from SOUL.md; zero overlap. |
| `/weekly` | Weekly performance report: portfolio return vs BTC, GLD, SPY; best/worst performers; one-line takeaway. |
| `/quarterly` | Quarterly report: portfolio vs benchmarks, layer attribution, regime assessment, outlook; save to `~/.dexter/QUARTERLY-REPORT-*.md`. |
| `/suggest-hl` | Suggest Hyperliquid portfolio (HIP-3 onchain equities only — no BTC/SOL/HYPE); save to PORTFOLIO-HYPERLIQUID.md. |
| `/hl-report` | Quarterly performance report for the HL sleeve only; save to `~/.dexter/QUARTERLY-REPORT-HL-*.md`. |
| `/hl-essay` | 600–800 word reflection on the on-chain stocks thesis using the latest HL quarterly report. |
| **Theta (tastytrade options)** | |
| `/theta-policy` | Bootstrap or explain `~/.dexter/THETA-POLICY.md` (allowed underlyings, no-call list, DTE, risk caps). No trades. |
| `/theta-help` | When to use each theta shortcut; safest order for a normal day vs a challenged short; reference THETA-POLICY. |
| `/theta-risk` | Live tastytrade options book: portfolio theta/delta, challenged shorts, concentration, assignment risk. |
| `/theta-scan` | Scan for safest theta trade today (THETA-POLICY defaults, SOUL non-crypto). Table + top 2 candidates; no submit. |
| `/theta-preview` | Run scan, pick best candidate, run strategy preview + dry-run. No submit. |
| `/theta-roll` | Find most challenged short put; build later-dated roll; show dry-run. No submit until you confirm. |
| `/theta-repair` | Analyze challenged short option; recommend hold, roll, close, or assignment. No submit. |
| `/options` | **Suggest options to execute on tastytrade** that fit SOUL.md thesis (equities only, non-crypto). Table + top 2–3 candidates; you preview and submit when ready. |
| **Hypersurface & BTC** | |
| `/theta-btc-weekly` | Optimal strike advice for **BTC options** expiring this Friday (same calendar as Hypersurface). Uses IBIT/BITO for data; **you execute on Hypersurface** — no tastytrade order. Prioritizes **why a given strike is best versus nearby strikes**, with only a short `IBIT on tastytrade instead` note. |
| `/hypersurface` | **Hypersurface-first advice** — optimal strike for BTC options this Friday. You execute manually on Hypersurface; no broker orders. Prioritizes **why the chosen strike wins versus neighboring lines** and keeps IBIT/tastytrade commentary brief. |
| **Broker status** | |
| `/tastytrade-status` | Report tastytrade setup: OAuth state, credentials path, configured vs connected. |

---

## Project structure

```
dexter/
├── src/
│   ├── agent/       # Loop, prompts, scratchpad
│   ├── cli.tsx      # Ink/React CLI
│   ├── gateway/     # WhatsApp and channels
│   ├── model/       # Multi-provider LLM
│   ├── skills/      # SKILL.md workflows (e.g. DCF)
│   └── tools/       # finance, search, portfolio, tastytrade, hyperliquid, heartbeat
├── SOUL.md          # Thesis and coverage universe
├── docs/            # VOICE, HEARTBEAT.example, PRDs, data APIs
└── .dexter/        # Runtime state (gitignored): HEARTBEAT.md, PORTFOLIO.md, fund-config, credentials
```

---

## SOUL and HEARTBEAT

**SOUL.md** in the repo root is injected into every session. It’s not a system prompt — it’s the lens. It defines the coverage universe (seven layers: chip → foundry → equipment → EDA → power → memory → networking), conviction tiering (Core Compounders vs Cyclical vs Speculative vs Avoid), and sizing rules (regime, layer durability, catalyst timing). Standard tools validate the consensus names; the edge lives where they can’t — equipment cycles, EDA complexity, power bottlenecks. Edit SOUL to reflect your thesis. Structure matters more than the names.

**~/.dexter/HEARTBEAT.md** is your monitoring checklist. Weekly: rebalance vs target, regime label, concentration alerts, newsletter draft. Quarterly: performance vs BTC, SPY, GLD; result recorded for since-inception tracking. Keep **~/.dexter/PORTFOLIO.md** (and optionally **PORTFOLIO-HYPERLIQUID.md**) so Dexter can compare actual to target.

```bash
cp docs/HEARTBEAT.example.md ~/.dexter/HEARTBEAT.md
```

---

## Example queries

Thesis-aware research: *What's our thesis on Bloom Energy and where does it sit in the durability hierarchy?*

Data + thesis: *Pull price and key ratios for Layer 3 equipment: AMAT, ASML, LRCX, KLAC. Analyze TSM's latest income statement through the foundry tollbooth lens.*

Stress-test: *What's the bear case for Layer 1 chip designers right now?*

Portfolio: *Does my portfolio need rebalancing? Compare to SOUL target. What would a near-perfect portfolio look like given our thesis?*

More: [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md).

---

## tastytrade

Three states: **not connected** → **read-only** → **trading enabled**. In read-only you get accounts, positions, balances, option chain, theta scan, strategy preview, and **order dry-run** — no live orders. When you set `TASTYTRADE_ORDER_ENABLED=true`, live_orders, submit, and cancel appear; submit and cancel still require explicit approval in the CLI. Use `/tastytrade-status` to see your state.

### Theta logic (Phase 5)

**What it is:** Theta = options premium selling (credit spreads, covered calls, cash-secured puts, iron condors). You sell time decay; Dexter helps find setups that fit your thesis and risk rules. The whole flow is **SOUL-first**: underlyings, sizing, and guardrails come from your identity and from **~/.dexter/THETA-POLICY.md**, not from generic index defaults.

**Why these trades:** Options income here is **thesis-serving**, not a separate strategy. (1) **Get paid to wait:** Sell cash-secured puts on names you’d buy anyway — you collect premium and may get assigned at a lower price. (2) **Earn on what you hold:** Sell covered calls only on names you’re willing to sell at the strike (never on Core Compounders; they’re on the no-call list so you don’t get called away). (3) **Defined-risk premium:** Credit spreads and iron condors cap max loss while harvesting time decay on thesis underlyings. (4) **Discipline:** Every underlying is a SOUL name with a reason to be there; sizing and risk caps in THETA-POLICY keep one bad trade from blowing up the book. The goal isn’t “trade options” — it’s **improve portfolio outcome** (lower cost basis, extra income, better entries) while staying within the thesis.

**Flow:** (1) **THETA-POLICY** defines allowed underlyings, no-call list, delta/DTE/risk caps, and earnings exclusion. (2) **Scan** runs over those underlyings (and your live positions/balances), filters by policy, and returns ranked candidates. (3) **Preview** turns a chosen candidate into an order payload; **roll** and **repair** suggest adjustments for existing positions. (4) **Dry-run** shows what would be sent; **submit**/ **cancel** only after you approve in the CLI. No auto-submit.

**Key rules:**

- **Hard block:** Only policy-compliant candidates are returned. If a trade would violate delta range, max risk, buying power cap, or no-call list, the tool returns `policy_blocked` and the violations — it never suggests a non-compliant order.
- **No-call list:** Names on this list (e.g. TSM, ASML, AMAT, LRCX, KLAC, ANET, CEG) must not get covered calls, so Core Compounders can’t be called away. Puts and spreads on those names are still allowed (e.g. cash-secured puts to add size).
- **Venue split:** Theta scan and tastytrade orders use **only** symbols that are *not* tradable on Hyperliquid. HL-tradable tickers (TSM, AAPL, COIN, etc.) are stripped from the scan universe and from the tastytrade sleeve; they live in PORTFOLIO-HYPERLIQUID.md and HL tools.
- **Earnings:** When THETA-POLICY sets `exclude_earnings_days` and Financial Datasets is configured, underlyings with earnings inside that window are dropped from the scan. If the key is missing, you get `earnings_exclusion_degraded` and no filtering.

**CLI shortcuts:** `/theta-policy` (show policy), `/theta-help` (workflow), `/theta-risk` (position risk), `/theta-scan` (run scan), `/theta-preview`, `/theta-roll`, `/theta-repair`, `/theta-btc-weekly` (BTC via IBIT), `/hypersurface` (Hypersurface strike advice), `/options` (tastytrade options that fit SOUL.md). Recommended loop: policy → risk → scan → preview → dry-run → approve → submit when you’re ready.

**Theta (Phase 5) tools (summary):** Position risk, scan, strategy preview, roll, repair. Scan defaults to **SOUL.md thesis names** (equipment, foundry, chip, power, memory, networking, cyclical adjacents) — not SPX/SPY/QQQ. THETA-POLICY is enforced as a **hard block**; no-call list protects Core Compounders; venue split keeps HL names out of tastytrade theta. **Use case:** Execution on tastytrade = SOUL non-crypto (equities) only; BTC options = advice for Hypersurface (strike/APR/prob via IBIT), execute on Hypersurface.

**Portfolio sync (Phase 4):** Sync from tastytrade to a PORTFOLIO.md-style table with **Target/Actual/Gap** columns. Optional write to `~/.dexter/PORTFOLIO.md`. Session cache (5-min TTL) avoids redundant API calls. With `TASTYTRADE_HEARTBEAT_ENABLED=true`, heartbeat compares live positions to SOUL.md target and flags drift. **Venue split:** The tastytrade sleeve has zero overlap with Hyperliquid — symbols tradable on HL (e.g. TSM, AAPL, MSFT, BTC, SOL, COIN) are hard-blocked from theta scan, preview, submit, and from the default PORTFOLIO.md; use PORTFOLIO-HYPERLIQUID.md for those.

**Analytics (Phase 6):** Realized P&L and win rate (`tastytrade_transactions`), upcoming earnings for SOUL underlyings + current positions with `within_7_days` flag (`tastytrade_earnings_calendar`), watchlist management with policy-alignment scan (`tastytrade_watchlist`), portfolio risk scorecard — Herfindahl concentration, theta/delta aggregate, buying power utilization (`tastytrade_risk_metrics`).

**Setup:** `TASTYTRADE_CLIENT_ID` and `TASTYTRADE_CLIENT_SECRET` in `.env`, then `bun run tastytrade:login` and paste the refresh token from my.tastytrade.com. Credentials in `~/.dexter/tastytrade-credentials.json`. Theta policy: copy [THETA-POLICY.example.md](docs/THETA-POLICY.example.md) to `~/.dexter/THETA-POLICY.md` and edit to match your holdings. Docs: [TASTYTRADE.md](docs/TASTYTRADE.md), [THETA-POLICY.md](docs/THETA-POLICY.md), [DATA-API-TASTYTRADE.md](docs/DATA-API-TASTYTRADE.md).

---

## Hyperliquid

**HIP-3 sleeve = onchain equities only.** The HL portfolio (PORTFOLIO-HYPERLIQUID.md) is for tokenized stocks, commodities, and indices — TSM, NVDA, PLTR, ORCL, COIN, HOOD, CRCL, TSLA, META, etc. Do *not* put BTC, SOL, HYPE, ETH, SUI, or NEAR in the HL target: core crypto is held separately (e.g. 80% BTC, 10% SOL, 10% HYPE for onchain options on Hypersurface). This keeps the HL sleeve focused on what HIP-3 uniquely offers (24/7 onchain equities) and avoids duplicating crypto weight.

HIP-3 stack: prices, liquidity ranking, period returns, portfolio ops (rebalance_check, quarterly_summary), live sync to PORTFOLIO-HYPERLIQUID.md, order preview, then opt-in execution (submit/cancel) gated by `HYPERLIQUID_ORDER_ENABLED` and private key, with runtime approval. Preview first; heartbeat never submits. Env: `HYPERLIQUID_ACCOUNT_ADDRESS`; optional `HYPERLIQUID_ORDER_ENABLED` and `HYPERLIQUID_PRIVATE_KEY`. **Test balance read:** `bun run hyperliquid:balance` (prints account value, withdrawable, and positions; requires `HYPERLIQUID_ACCOUNT_ADDRESS` in `.env`). [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md), [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) (Queries 8, 8b–8e).

---

## Evaluating, rate limits, debugging

**Evals:** `bun run src/evals/run.ts` or `--sample 10`. LangSmith for tracking; set `LANGSMITH_API_KEY` and `LANGSMITH_TRACING=true` to trace.

**Rate limiting:** Concurrency cap (5), exponential backoff, retries. Batched tool calls. FD may have no data for some international tickers; fallback to web_search. Note OTC ADRs (e.g. BESIY) in SOUL when relevant.

**Debugging:** Tool calls and results go to `.dexter/scratchpad/` as JSONL per query (init, tool_result, thinking).

**WhatsApp:** `bun run gateway:login` then `bun run gateway`. [WhatsApp README](src/gateway/channels/whatsapp/README.md).

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [SOUL.md](SOUL.md) | Thesis, coverage universe, conviction tiers, sizing rules |
| [VOICE.md](docs/VOICE.md) | Brand and writing style |
| [HEARTBEAT.example.md](docs/HEARTBEAT.example.md) | Monitoring template → `~/.dexter/HEARTBEAT.md` |
| [DATA-API-FINANCIAL-DATASETS.md](docs/DATA-API-FINANCIAL-DATASETS.md) | Financial Datasets API reference |
| [**TASTYTRADE.md**](docs/TASTYTRADE.md) | **tastytrade user guide: setup, all tools, theta workflows** |
| [DATA-API-TASTYTRADE.md](docs/DATA-API-TASTYTRADE.md) | tastytrade API reference: all 6 phases, SOUL-aligned defaults |
| [THETA-POLICY.md](docs/THETA-POLICY.md) | Theta policy format and field reference |
| [THETA-POLICY.example.md](docs/THETA-POLICY.example.md) | SOUL-aligned policy template (copy to `~/.dexter/THETA-POLICY.md`) |
| [THETA-PROMPTS-12.md](docs/THETA-PROMPTS-12.md) | 12 canonical theta prompts (v1.1, SOUL-aligned) |
| [PRD-TASTYTRADE-INTEGRATION.md](docs/PRD-TASTYTRADE-INTEGRATION.md) | tastytrade integration PRD — all 6 phases |
| [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](docs/PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md) | Phase 5 theta engine: tools, SOUL policy, guardrails |
| [PRD-TASTYTRADE-OPTIONS-EXPLORATION.md](docs/PRD-TASTYTRADE-OPTIONS-EXPLORATION.md) | Explore tastytrade options alongside Hypersurface (venue comparison, gaps, readiness) |
| [RUNBOOK-TASTYTRADE-OPTIONS-FROM-HYPERSURFACE.md](docs/RUNBOOK-TASTYTRADE-OPTIONS-FROM-HYPERSURFACE.md) | One-page: from Hypersurface to tastytrade options via Dexter (venue split, flow, prerequisites) |
| [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md) | Hyperliquid portfolio and execution |
| [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) | Copy-paste query library |
| [FUND-CONFIG.md](docs/FUND-CONFIG.md), [EXTERNAL-RESOURCES.md](docs/EXTERNAL-RESOURCES.md) | AUM, inception date, research references |

**Related:** [AI Hedge Fund](https://github.com/eliza420ai-beep/ai-hedge-fund) — same org; multi-agent equity analysis (18 analyst agents + risk/portfolio manager), Hyperliquid integration (planned), Tastytrade daily options (experimental). Shares thesis context via **SOUL.md** (and optional `~/.ai-hedge-fund/` config). Use it for signals and portfolio construction experiments; use Dexter for research, live broker data, theta workflows, and execution. Details: [EXTERNAL-RESOURCES.md §9](docs/EXTERNAL-RESOURCES.md#9-ai-hedge-fund--multi-agent-portfolio-construction).

---

## Contributing

Fork, branch, commit, push, open a PR. Keep PRs small and focused.

**Syncing with upstream** (if you forked from virattt/dexter):

We're often many commits ahead (thesis, tastytrade, Hyperliquid, portfolio builder). To pull in upstream changes without losing our work:

```bash
git remote add upstream https://github.com/virattt/dexter.git   # once
git fetch upstream
git merge upstream/main
```

- If Git reports conflicts, resolve them in the listed files (keep our fork behavior and add upstream’s new behavior where it makes sense), then `git add` the resolved files and `git commit`.
- **Do not use GitHub’s “Discard commits” or “Sync fork” in a way that drops our commits** — always merge upstream into your branch locally so your 40+ commits stay intact.

---

## License

MIT
