# Dexter

Dexter is an autonomous financial research agent — think Claude Code, but built for deep financial analysis. It decomposes complex questions into research plans, executes them using live market data and SEC filings, checks its own work, and refines until it has a confident, data-backed answer.

The north star is the **Portfolio Builder**: help build and maintain a near-perfect portfolio aligned with a specific investment thesis, outperforming the S&P 500, NASDAQ, BTC, and best hedge funds.

## Table of Contents

- [Overview](#-overview)
- [How We've Customized Dexter](#-how-weve-customized-dexter)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Running Dexter](#-running-dexter)
- [Project Structure](#-project-structure)
- [Customizing: SOUL.md & HEARTBEAT.md](#-customizing-soulmd--heartbeatmd)
- [Example Queries](#-example-queries)
- [Evaluating](#-evaluating)
- [API Rate Limiting](#-api-rate-limiting)
- [Debugging](#-debugging)
- [WhatsApp Interface](#-whatsapp-interface)
- [Contributing](#-contributing)
- [Syncing with Upstream](#-syncing-with-upstream)
- [Documentation](#-documentation)
- [License](#-license)

---

## 👋 Overview

Dexter's **north star** is the **Portfolio Builder** — building and maintaining a near-perfect portfolio aligned with your investment thesis (defined in `SOUL.md`). Performance must beat best hedge funds, S&P 500, NASDAQ, and BTC — otherwise it fails the bar.

**What it does:**

- **Intelligent task planning** — decomposes complex queries into structured, multi-step research plans
- **Autonomous execution** — selects and runs the right tools to gather financial data, filings, and news
- **Self-validation** — checks its own work, iterates, and refines until tasks are complete
- **Real-time market data** — income statements, balance sheets, cash flows, insider trades, SEC filings
- **Thesis-aware analysis** — every answer is contextualized by your investment thesis from `SOUL.md`
- **Scheduled monitoring** — weekly rebalance checks (Mondays) and quarterly benchmark reports
- **Fund operations** — AUM config, dollar rebalancing, YTD and since-inception performance tracking
- **Newsletter output** — regime labels, weekly drafts, concentration alerts, investor letter templates
- **Brand voice** — `VOICE.md` injects ikigaistudio tone into every response
- **Safety guards** — loop detection and step limits prevent runaway execution
- **tastytrade integration** — three operator states (not connected → read-only → trading enabled). In read-only: accounts, positions, theta scan, strategy preview, and **order dry-run** without enabling live trading; submit/cancel only when `TASTYTRADE_ORDER_ENABLED=true` and with explicit approval. Theta scan is event-aware (earnings exclusion in-tool when THETA-POLICY and FINANCIAL_DATASETS_API_KEY allow); scan and preview return **portfolio-fit** pass/warn/block from SOUL.md and PORTFOLIO.md. Use `/tastytrade-status` in the CLI to see your state. Phase 5: position risk, theta scan, strategy preview, roll, repair; sync portfolio from broker to PORTFOLIO.md; optional heartbeat drift check.
- **Hyperliquid (Phases 6–10)** — full on-chain HIP-3 stack: HL-native prices and liquidity ranking; period returns (hl_basket + portfolio_hl); deterministic rebalance/report ops; live account sync (positions → PORTFOLIO-HYPERLIQUID.md); execution planning (order preview, market resolver, policy); opt-in signed execution (submit, cancel, live orders) with approval and reconciliation.

---

## 🔧 How We've Customized Dexter

This fork extends [virattt/dexter](https://github.com/virattt/dexter) with a specific investment thesis, data stack, and operational tooling.

| Customization | What | Why |
|---|---|---|
| **Portfolio Builder** | Agent's primary purpose is building and maintaining a near-perfect portfolio aligned with `SOUL.md`. Must beat hedge funds, indexes, and BTC. | Generic research agents answer questions. We need one that *owns the outcome* — rebalancing, benchmarking, reporting. |
| **SOUL.md** | Investment thesis: AI infrastructure supply chain (7 layers), conviction tiering, sizing rules, analytical edge. BTC-heavy core; HYPE and SOL/NEAR/SUI/ETH as satellites. | The edge lives where consensus hasn't priced. SOUL.md gives every query structural context — equipment cycle dynamics, EDA complexity, power bottlenecks. |
| **HEARTBEAT** | Weekly rebalance check vs target. Quarterly performance report vs S&P, NASDAQ, BTC. Regime label. Newsletter draft when noteworthy. Dollar rebalancing when AUM is set. | Passive monitoring isn't enough. We need scheduled action: detect drift, compare to benchmarks, deliver reports. |
| **VOICE.md** | ikigaistudio tone, phrases, structure. Injected into every system prompt. Override at `~/.dexter/VOICE.md`. | Generic AI output sounds generic. Essays and investor letters need a consistent, recognizable voice. |
| **Fund config** | `~/.dexter/fund-config.json` (AUM, inception). `~/.dexter/performance-history.json` (quarterly history). Tools: `fund_config`, `performance_history`, `save_report`. | Dollar rebalancing and since-inception returns require AUM. Reports auto-save to `~/.dexter/`. |
| **Financial Datasets API** | All finance subagents (prices, fundamentals, filings, insider trades, news) use Financial Datasets as primary data source. Optional **Finnhub** fallback for `get_stock_price`, `get_stock_prices`, `get_company_news` when FD is down or rate-limited (`FINNHUB_API_KEY`). | Built for AI agents: section-level SEC filings, structured JSON, real-time ingestion. See [DATA-API-FINANCIAL-DATASETS.md](docs/DATA-API-FINANCIAL-DATASETS.md), [PRD-FINNHUB-SUBAGENTS.md](docs/PRD-FINNHUB-SUBAGENTS.md). |
| **Finnhub fallback** | PRD for Finnhub free tier as fallback when FD fails or is rate-limited. | Resilience and cost reduction. Zero marginal cost for overflow on simple price/news queries. See [PRD-FINNHUB-SUBAGENTS.md](docs/PRD-FINNHUB-SUBAGENTS.md). |
| **WhatsApp interface** | Gateway for WhatsApp; group chat is the primary interaction surface. | Research and alerts in the same place we already communicate. CLI and HTTP API remain for power users. |
| **Startup stack** | PRD for moving from MVP to startup: Wyoming LLC, custody, tokenized equity, USDC on Base (doola, Coinbase, Fairmint). | Collapses entity formation, compliance, and settlement into something a solo founder can access. See [PRD-STARTUP-STACK.md](docs/PRD-STARTUP-STACK.md). |
| **External research** | Documented references for AI monetary preferences, crypto tax by jurisdiction, back-office tools, Web3 entity formation. | Informs thesis (BTC preference in AI agents), entity planning (tax efficiency), and startup infra. See [EXTERNAL-RESOURCES.md](docs/EXTERNAL-RESOURCES.md). |
| **tastytrade** | OAuth2 tools in three states: read_only (accounts, positions, theta_scan, strategy_preview, order_dry_run) and trading_enabled (live_orders, submit_order, cancel_order when `TASTYTRADE_ORDER_ENABLED=true`). Credentials in `~/.dexter/tastytrade-credentials.json`. Use `/tastytrade-status` for operator state. | **Why:** Manual PORTFOLIO.md is static. Live broker data lets Dexter compare actual holdings to thesis, sync portfolio from tastytrade, and power theta/options workflows. **Unlocks:** 0DTE scanners, iron condors, weekly theta income, IV crush plays, challenged-position repair, and roll workflows — agent sees your real positions and cash, can scan and dry-run in read-only, then submit only with explicit approval. **Recent improvements:** Dry-run and strategy preview available without enabling live orders; theta scan applies earnings exclusion in-tool (THETA-POLICY + optional Financial Datasets); scan and preview return explicit portfolio-fit (pass/warn/block) from SOUL.md and PORTFOLIO.md; CLI reports operator state and next steps. See [PRD-TASTYTRADE-INTEGRATION.md](docs/PRD-TASTYTRADE-INTEGRATION.md), [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](docs/PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md), [DATA-API-TASTYTRADE.md](docs/DATA-API-TASTYTRADE.md), [TASTYTRADE-SYMBOLOGY.md](docs/TASTYTRADE-SYMBOLOGY.md), [THETA-POLICY.md](docs/THETA-POLICY.md). |
| **Hyperliquid (Phases 6–10)** | **Phase 6:** HL API client; `hyperliquid_prices` (HIP-3 + pre-IPO); `hyperliquid_liquidity` (24h volume ranking). **Phase 7:** `hyperliquid_performance` (hl_basket + portfolio_hl for period → performance_history). **Phase 8:** `hyperliquid_portfolio_ops` (rebalance_check, quarterly_summary, validate_target); parse HIP-3 Target from HEARTBEAT.md; drift, alerts, trim/add. **Phase 9:** Read-only account client; `hyperliquid_positions`; `hyperliquid_sync_portfolio` (live → PORTFOLIO-HYPERLIQUID.md); `aum_hl` in fund-config; live-first heartbeat. **Phase 9b:** Execution intent model; market resolver; `hyperliquid_order_preview`; HL execution policy (~/.dexter/hl-execution-policy.json); preview-first UX (heartbeat never submits). **Phase 10:** Authenticated execution client; `hyperliquid_live_orders`, `hyperliquid_submit_order`, `hyperliquid_cancel_order` (gated by HYPERLIQUID_ORDER_ENABLED + private key); runtime approval for submit/cancel; idempotent cloid; post-trade reconciliation. | **Why:** Third portfolio: 24/7 tradeable on-chain (HIP-3), no fiat conversion, tax-friendly. **Unlocks:** Suggest/save HL portfolio; weekly/quarterly HL reports; live sync from wallet; deterministic rebalance vs target; preview-only then opt-in execution with approval and reconciliation. See [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md), [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) (Queries 8, 8b–8e). |

**Core thesis:** BTC HODL is the foundation. Diversification satellites are HYPE (onchain stocks) and SOL/NEAR/SUI/ETH (agentic web4). The AI infrastructure universe is the opportunity set. Dexter helps decide *when to diversify — and when HODLing is the right call*. We are not real estate bulls — housing collapse thesis is in SOUL.md.

---

## ✅ Prerequisites

| Requirement | Notes |
|---|---|
| [Bun](https://bun.com) v1.0+ | Primary runtime |
| OpenAI API key | Required — [get one](https://platform.openai.com/api-keys) |
| Financial Datasets API key | Required for market data — [get one](https://financialdatasets.ai) |
| Exa API key | Optional — for web search |
| tastytrade OAuth | Optional — for live positions/balances and options workflows; [developer.tastytrade.com](https://developer.tastytrade.com/) |

**Install Bun:**

```bash
# macOS/Linux
curl -fsSL https://bun.com/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1|iex"
```

Restart your terminal, then verify: `bun --version`

---

## 💻 Installation

**1. Clone the repository:**

```bash
git clone https://github.com/virattt/dexter.git
cd dexter
```

**2. Install dependencies:**

```bash
bun install
```

**3. Configure environment variables:**

```bash
cp env.example .env
```

Edit `.env` and fill in your keys:

```bash
# LLM providers (at least one required)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=        # Optional
GOOGLE_API_KEY=           # Optional
XAI_API_KEY=              # Optional
OPENROUTER_API_KEY=       # Optional

# Market data (AAPL, NVDA, MSFT are free without a key)
FINANCIAL_DATASETS_API_KEY=
# Optional: Finnhub fallback for prices/news when FD is down or rate-limited (60/min free tier)
# FINNHUB_API_KEY=

# Web search (Exa preferred → Perplexity → Tavily as fallbacks)
EXASEARCH_API_KEY=
PERPLEXITY_API_KEY=       # Optional fallback
TAVILY_API_KEY=           # Optional fallback

# X/Twitter (enables x_search tool for public sentiment research)
X_BEARER_TOKEN=           # Optional

# tastytrade (read-only: accounts, positions, theta_scan, strategy_preview, order_dry_run; trading: live_orders, submit, cancel)
TASTYTRADE_CLIENT_ID=     # Optional — OAuth app from my.tastytrade.com
TASTYTRADE_CLIENT_SECRET= # Optional — then run: bun run tastytrade:login (paste refresh token from Create Grant)
# TASTYTRADE_SANDBOX=true
# TASTYTRADE_ORDER_ENABLED=true   # Opt-in: live_orders, submit_order, cancel_order only (dry_run is in read-only)
# TASTYTRADE_HEARTBEAT_ENABLED=true   # Heartbeat compares broker positions to SOUL/PORTFOLIO target, flags drift
# Phase 5 theta policy lives at ~/.dexter/THETA-POLICY.md

# Local LLM via Ollama (optional)
OLLAMA_BASE_URL=http://127.0.0.1:11434

# Evaluation tracing (optional)
LANGSMITH_API_KEY=
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_PROJECT=dexter
LANGSMITH_TRACING=false
```

---

## 🚀 Running Dexter

```bash
# Interactive mode
bun start

# Watch mode (auto-reloads on file changes)
bun dev

# Type-check only
bun run typecheck

# Run tests
bun test

# Run heartbeat (single cycle, no gateway)
bun run heartbeat
bun run heartbeat -- --dry-run   # Print query only

# Backup ~/.dexter
bun run backup

# Validate portfolio structure (exit 1 if weights ≠ 100% or HL symbols invalid)
bun run validate-portfolio
```

When the HTTP API is running (`bun run api` or via gateway), **GET /health** returns 200 when LLM and Financial Datasets env are set, 503 otherwise (response includes `checks` and `failed`). Use **GET /health?probe=true** to run a real FD reachability check (one request to FD).

### Quick validation (copy-paste checklist)

Run these to confirm the repo and env are healthy:

```bash
# Env and types
bun run typecheck

# Unit tests
bun test

# Heartbeat: build query only (no agent, no gateway)
bun run heartbeat -- --dry-run

# Portfolio: exit 1 if PORTFOLIO.md / PORTFOLIO-HYPERLIQUID.md invalid (weights ≠ 100%, bad HL symbols)
bun run validate-portfolio
```

Optional: **tastytrade** — set `TASTYTRADE_CLIENT_ID` and `TASTYTRADE_CLIENT_SECRET` in `.env`, then `bun run tastytrade:login` and paste your refresh token from my.tastytrade.com. Use `/tastytrade-status` in the CLI to confirm.

**Smoke test:** `bun run start` → type `/suggest` or paste Query 1 from [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) → confirm `~/.dexter/PORTFOLIO.md` is created. Evals: `bun run src/evals/run.ts --sample 3` (requires `OPENAI_API_KEY`).

### Query shortcuts

In the CLI, type a shortcut to expand to the full query:

| Shortcut | Expands to |
|----------|------------|
| `/suggest` | Suggest portfolio (Query 1) |
| `/weekly` | Weekly performance report (Query 2) |
| `/quarterly` | Quarterly report (Query 4) |
| `/suggest-hl` | Suggest Hyperliquid portfolio (Query 8) |
| `/hl-report` | HL quarterly report (Query 12) |
| `/hl-essay` | HL reflection essay (Query 10) |
| `/theta-risk` | Live options book risk review |
| `/theta-scan` | Scan Phase 5 theta candidates |
| `/theta-preview` | Scan then preview best theta trade |
| `/theta-repair` | Diagnose and repair challenged short option |
| `/theta-roll` | Build later-dated roll candidate |
| `/theta-help` | Show the Phase 5 theta operating loop |
| `/theta-policy` | Bootstrap and explain `~/.dexter/THETA-POLICY.md` |

---

## 📁 Project Structure

```
dexter/
├── src/
│   ├── agent/          # Agent loop, prompts, scratchpad, token counting
│   ├── cli.tsx         # Ink/React CLI interface
│   ├── index.tsx       # Entry point
│   ├── components/     # CLI UI components
│   ├── controllers/    # Model selection and configuration
│   ├── evals/          # LangSmith evaluation runner
│   ├── gateway/        # WhatsApp and other channel gateways
│   ├── hooks/          # React hooks (agent runner, model selection, history)
│   ├── model/          # Multi-provider LLM abstraction
│   ├── skills/         # SKILL.md-based extensible workflows (e.g. DCF)
│   └── tools/          # All agent tools
│       ├── finance/    # Prices, fundamentals, filings, insider trades
│       ├── search/     # Exa / Perplexity / Tavily web search
│       ├── browser/    # Playwright-based scraping
│       ├── portfolio/  # Portfolio builder tool
│       ├── tastytrade/ # tastytrade API — read-only (accounts, positions, theta scan, strategy preview, order dry-run) and opt-in order flow (submit, cancel); event-aware scan, portfolio-fit pass/warn/block
│       ├── hyperliquid/ # Hyperliquid (HIP-3) — prices, liquidity, performance, portfolio_ops, positions, sync, order preview, optional live execution
│       ├── heartbeat/  # Weekly/quarterly monitoring
│       ├── fund-config/    # AUM and inception date
│       └── performance-history/  # Quarterly performance tracking
├── SOUL.md             # Investment thesis and coverage universe
├── docs/
│   ├── VOICE.md        # Brand and writing style
│   ├── HEARTBEAT.example.md   # Monitoring checklist template
│   └── ...             # PRDs, roadmaps, data API docs
└── .dexter/            # User-managed runtime state (gitignored)
    ├── HEARTBEAT.md    # Your monitoring checklist
    ├── PORTFOLIO.md    # Your current holdings
    ├── fund-config.json
    └── performance-history.json
```

---

## 🧠 Customizing: SOUL.md & HEARTBEAT.md

Out of the box, Dexter is a general-purpose financial research agent. It becomes dramatically more useful when you give it a persistent investment thesis, a defined coverage universe, and a monitoring discipline. That's what `SOUL.md` and `HEARTBEAT.md` do.

### Why customize?

Standard LLM-based analysis works well for high-coverage names — everyone agrees Nvidia is a buy. But the edge in research lives where standard tools *can't* evaluate: equipment cycle dynamics, EDA complexity growth, power bottleneck economics, memory supply-demand gaps. These require domain-specific context no generic agent carries.

By embedding your thesis into Dexter's identity files, every query is informed by your structural view of the market. Dexter doesn't just answer "what is AMAT's P/E?" — it answers in the context of where AMAT sits in the AI supply chain, what the H2 2026 equipment cycle inflection means, and whether current valuation reflects the structural flywheel.

### SOUL.md — Agent identity and thesis

`SOUL.md` lives in the repo root and is injected into Dexter's system prompt on every query. It defines:

- **Coverage universe** — organized by supply chain layer (Chip Designers, Foundry, Equipment, EDA, Power, Memory, Networking)
- **Structural thesis** — the *why* behind each position, not just the ticker
- **Conviction tiering** — Core Compounder, Cyclical Beneficiary, Speculative Optionality, Avoid/Too Crowded — with bottleneck type, duration, and attackability
- **Sizing rules** — regime determines size (not conviction), layer determines durability, catalyst determines timing
- **Analytical edge** — where standard tools fail and what domain-specific analysis to prioritize

Edit `SOUL.md` to reflect your own thesis. The structure matters more than the specific names.

### HEARTBEAT.md — The monitoring checklist

`~/.dexter/HEARTBEAT.md` is user-managed and defines what Dexter should monitor periodically.

The heartbeat runs:
- **Weekly (Mondays):** Rebalance check vs target from `SOUL.md`. Regime label (risk-on/risk-off/mixed). Concentration alerts for positions >5% above target. Newsletter draft saved to `~/.dexter/WEEKLY-DRAFT-YYYY-MM-DD.md`. Dollar rebalancing when AUM is set.
- **Quarterly (first week of Jan/Apr/Jul/Oct):** Performance report — YTD and since-inception vs BTC, SPY, GLD. Records quarter via `performance_history` for cumulative tracking.

Keep your current holdings in `~/.dexter/PORTFOLIO.md` (ticker, weight, layer, tier) so Dexter can compare against the target.

```bash
# Set up your monitoring checklist from the template
cp docs/HEARTBEAT.example.md ~/.dexter/HEARTBEAT.md
```

The checklist also supports:
- **Per-ticker monitoring criteria** — what to check for each name
- **Conviction tier tags** — `[CC]`, `[CB]`, `[SO]`, `[AV]` so research effort scales with conviction
- **Macro signals** — Fed rates, SOX index, hyperscaler capex, BTC/Gold ratio
- **Research priority guide** — Core Compounders get deep fundamental research; Speculative Optionality gets catalyst-only monitoring

---

## 💬 Example Queries

**Thesis-aware research:**
```
What's our thesis on Bloom Energy and where does it sit in the durability hierarchy?
Compare the structural position of SNDK vs MU in the memory bottleneck thesis
```

**Financial data + thesis context:**
```
Pull current price and key ratios for our Layer 3 equipment names: AMAT, ASML, LRCX, KLAC, TEL, BESI
Pull the latest income statement for TSM and analyze it through the foundry tollbooth lens
```

**Stress-test the thesis:**
```
What's the bear case for holding Layer 1 chip designers right now?
If AI demand is merely good but not euphoric, which positions survive and which don't?
```

**Portfolio building:**
```
Does my portfolio need rebalancing? Compare to the target from SOUL
What would a near-perfect portfolio look like given our thesis?
How and why should we diversify from a BTC-heavy portfolio right now?
```

**tastytrade (live broker data):** Set `TASTYTRADE_CLIENT_ID` and `TASTYTRADE_CLIENT_SECRET` in `.env`, then run `bun run tastytrade:login` and paste your refresh token (from my.tastytrade.com → API Access → Create Grant). Credentials are saved to `~/.dexter/tastytrade-credentials.json`.
```
What's my tastytrade status?
What's in my tastytrade account? Show positions and balances
Sync my portfolio from tastytrade into a table and compare to SOUL target
Show me the AAPL option chain for next week
Do I have enough buying power for a 0DTE SPX credit spread?
What theta trade should I do today? (scan respects THETA-POLICY and earnings exclusion; returns portfolio-fit pass/warn/block)
```
Operator states: **not_connected** → **read_only** (accounts, positions, theta_scan, strategy_preview, order_dry_run) → **trading_enabled** (live_orders, submit, cancel when `TASTYTRADE_ORDER_ENABLED=true`). Use `/tastytrade-status` in the CLI to see your state. Dry-run and preview work in read-only; submit/cancel require explicit enablement and approval. Theta scan applies earnings exclusion in-tool when THETA-POLICY and (optionally) Financial Datasets are configured; scan and strategy preview return **portfolio-fit** (pass/warn/block) from SOUL.md and PORTFOLIO.md. Use `tastytrade_sync_portfolio` to build a PORTFOLIO.md-style table from broker positions (optionally write to `~/.dexter/PORTFOLIO.md`). With `TASTYTRADE_HEARTBEAT_ENABLED=true`, heartbeat compares live positions to target and flags drift. Phase 5: `tastytrade_position_risk`, `tastytrade_theta_scan`, `tastytrade_strategy_preview`, `tastytrade_roll_short_option`, `tastytrade_repair_position`. Configure `~/.dexter/THETA-POLICY.md` for allowed underlyings, no-call list, delta/DTE, and sizing caps.
Quick start: copy [THETA-POLICY.example.md](docs/THETA-POLICY.example.md) to `~/.dexter/THETA-POLICY.md`, then try the Phase 5 workflow queries in [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md).

### Phase 5 Operating Loop

Use this order for a normal theta workflow:

1. `\/theta-risk` — understand current book risk, challenged shorts, and concentration before adding anything.
2. `\/theta-scan` — generate candidates that fit your current book and `THETA-POLICY`.
3. `\/theta-preview` — turn the best candidate into a trade memo and dry-run.
4. If you want to place it, explicitly confirm after preview; only then use live order flow.

Use this order for a stressed or challenged position:

1. `\/theta-risk` — confirm whether the short strike is actually threatened.
2. `\/theta-repair` — compare hold vs close vs roll vs assignment.
3. `\/theta-roll` — if rolling is the right path, build the actual later-dated roll candidate and inspect the dry-run.

If you want the CLI to explain this interactively, type `\/theta-help`. If you have not created `~/.dexter/THETA-POLICY.md` yet, start with `\/theta-policy`.

### Hyperliquid: On-Chain Portfolio & Execution (Phases 6–10)

Dexter ships a full Hyperliquid (HIP-3) stack — from HL-native data and deterministic ops to live account sync and optional signed execution.

| Phase | What shipped |
|-------|----------------|
| **6a** | HL API client; `hyperliquid_prices` — HL mid/mark prices for HIP-3 symbols and pre-IPO (OPENAI, SPACEX, ANTHROPIC). |
| **6b** | `hyperliquid_liquidity` — underlyings ranked by 24h notional volume; use when suggesting or rebalancing PORTFOLIO-HYPERLIQUID. |
| **7** | `hyperliquid_performance` — hl_basket and portfolio_hl for a period (e.g. 2026-Q1, 7d); feed into `performance_history record_quarter`. |
| **8** | `hyperliquid_portfolio_ops` — rebalance_check (drift, concentration alerts, trim/add); quarterly_summary; validate_target. HIP-3 Target from HEARTBEAT.md; code-backed drift and actions. |
| **9** | Live account sync: `hyperliquid_positions`, `hyperliquid_sync_portfolio` (live holdings → PORTFOLIO-HYPERLIQUID.md). Set `HYPERLIQUID_ACCOUNT_ADDRESS`; heartbeat and ops prefer synced state. `aum_hl` in fund-config for dollar rebalance. |
| **9b** | Execution planning: canonical intent model; market resolver (underlying → most liquid market); `hyperliquid_order_preview` (rebalance → order intents); `~/.dexter/hl-execution-policy.json`; preview-first UX — heartbeat never submits. |
| **10** | Opt-in execution: `hyperliquid_live_orders`, `hyperliquid_submit_order`, `hyperliquid_cancel_order` (gated by `HYPERLIQUID_ORDER_ENABLED` + `HYPERLIQUID_PRIVATE_KEY`); runtime approval for submit/cancel; idempotent client order IDs; post-trade reconciliation. |

**Flow:** Sync live (if configured) → `hyperliquid_portfolio_ops` rebalance_check → `hyperliquid_order_preview` → present and stop; only after explicit user confirmation (and with order execution enabled) → submit/cancel → reconcile → optional sync.

**Env:** `HYPERLIQUID_ACCOUNT_ADDRESS` (live sync); optional `HYPERLIQUID_ORDER_ENABLED` and `HYPERLIQUID_PRIVATE_KEY` for execution. See [env.example](env.example) and [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md); [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) (Queries 8, 8b–8e); [HYPERLIQUID-SYMBOL-MAP.md](docs/HYPERLIQUID-SYMBOL-MAP.md).

**Hyperliquid example queries:**
```
Suggest a Hyperliquid portfolio — only tickers available on HIP-3. Save to PORTFOLIO-HYPERLIQUID.md
What's the weekly performance of my on-chain portfolio vs SPY, GLD, BTC?
Run a rebalance check for my Hyperliquid portfolio (hyperliquid_portfolio_ops rebalance_check)
Show my live HL positions; sync my live HL portfolio to PORTFOLIO-HYPERLIQUID.md
Run order preview after rebalance (hyperliquid_order_preview); do not submit until I confirm
```

**Newsletter and investor letters:**
```
Write a 2-paragraph newsletter snippet for this week's performance vs BTC, GLD, SPY
Draft an investor letter: performance summary, key moves, outlook, risks
Reflect on this quarter's report and suggest 3 essay angles for Substack
```

**Macro + monitoring:**
```
What's the current BTC/Gold ratio telling us about risk appetite?
Summarize the latest hyperscaler capex guidance from MSFT, GOOG, AMZN, META
```

**Deep dives:**
```
Read AMAT's latest 10-K risk factors and identify anything that changes the equipment cycle thesis
Find the latest Fabricated Knowledge or SemiAnalysis coverage on H2 2026 wafer fab equipment outlook
What are the latest NAND contract pricing trends from TrendForce?
```

See [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) for a full copy-paste query library.

---

## 📊 Evaluating

Dexter includes an evaluation suite that tests the agent against a dataset of financial questions. Evals use LangSmith for tracking and an LLM-as-judge for scoring.

```bash
# Run on all questions
bun run src/evals/run.ts

# Run on a random sample
bun run src/evals/run.ts --sample 10
```

The eval runner displays a real-time UI showing progress, current question, and running accuracy. Results are logged to LangSmith for analysis.

**Tracing:** Set `LANGSMITH_API_KEY` and `LANGSMITH_TRACING=true` to trace tool calls and debug failures in [LangSmith](https://smith.langchain.com).

---

## ⚡ API Rate Limiting

When querying many tickers at once, Dexter includes built-in protections against `429 Too Many Requests` errors:

- **Concurrency semaphore** — limits parallel API requests to 5 at a time
- **Exponential backoff with retry** — retries failed requests up to 3 times with increasing delays, respecting `Retry-After` headers
- **Batched execution** — tool calls within `financial_search` and `financial_metrics` are processed in batches of 8

For internationally listed stocks (e.g., BESI on Euronext Amsterdam), the Financial Datasets API may return no data. Dexter automatically falls back to `web_search` for these names. Note OTC ADR tickers (e.g., `BESIY`) in `SOUL.md` to improve lookup success.

---

## 🐛 Debugging

Dexter logs all tool calls to a scratchpad file for each query.

**Location:**
```
.dexter/scratchpad/
├── 2026-01-30-111400_9a8f10723f79.jsonl
├── 2026-01-30-143022_a1b2c3d4e5f6.jsonl
└── ...
```

Each JSONL file tracks:
- `init` — the original query
- `tool_result` — each tool call with arguments, raw result, and LLM summary
- `thinking` — agent reasoning steps

**Example entry:**
```json
{
  "type": "tool_result",
  "timestamp": "2026-01-30T11:14:05.123Z",
  "toolName": "get_income_statements",
  "args": { "ticker": "AAPL", "period": "annual", "limit": 5 },
  "result": { "..." },
  "llmSummary": "Retrieved 5 years of Apple annual income statements showing revenue growth from $274B to $394B"
}
```

---

## 📱 WhatsApp Interface

Chat with Dexter through WhatsApp — messages you send to yourself are processed by Dexter and responses are returned to the same chat.

```bash
# Link your WhatsApp account (scan the QR code)
bun run gateway:login

# Start the gateway
bun run gateway
```

Then open WhatsApp, go to your own chat (message yourself), and ask Dexter a question.

For detailed setup, configuration, and troubleshooting, see the [WhatsApp Gateway README](src/gateway/channels/whatsapp/README.md).

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

Keep pull requests small and focused — this makes review and merging much easier.

---

## 🔄 Syncing with Upstream

If you forked from [virattt/dexter](https://github.com/virattt/dexter) and want to pull in upstream updates:

```bash
# Add upstream remote (once)
git remote add upstream https://github.com/virattt/dexter.git

# Fetch and merge
git fetch upstream
git merge upstream/main

# Resolve any conflicts, then push
git push origin main
```

> Do not use GitHub's "Discard X commits" button — that deletes your work. Merge locally instead.

---

## 📚 Documentation

### Core

| Doc | Description |
|-----|-------------|
| [SOUL.md](SOUL.md) | Investment thesis, coverage universe, conviction tiers, sizing rules |
| [VOICE.md](docs/VOICE.md) | Brand and writing style for ikigaistudio — tone, phrases, examples |
| [HEARTBEAT.example.md](docs/HEARTBEAT.example.md) | Monitoring checklist template — copy to `~/.dexter/HEARTBEAT.md` |

### Data & APIs

| Doc | Description |
|-----|-------------|
| [DATA-API-FINANCIAL-DATASETS.md](docs/DATA-API-FINANCIAL-DATASETS.md) | Financial Datasets API — endpoints, auth, parameters |
| [DATA-API-TASTYTRADE.md](docs/DATA-API-TASTYTRADE.md) | tastytrade API — OAuth, operator states (read-only vs trading), accounts/positions/theta scan/preview/dry-run, sync portfolio, opt-in submit/cancel |
| [THETA-POLICY.md](docs/THETA-POLICY.md) | Persistent Phase 5 theta policy format: allowed underlyings, no-call list, delta/DTE defaults, and sizing caps |
| [THETA-POLICY.example.md](docs/THETA-POLICY.example.md) | Copyable starter template for `~/.dexter/THETA-POLICY.md` |
| [TASTYTRADE-SYMBOLOGY.md](docs/TASTYTRADE-SYMBOLOGY.md) | OCC option symbol format and underlying ticker mapping for sync and drift checks |
| [PRD-TASTYTRADE-INTEGRATION.md](docs/PRD-TASTYTRADE-INTEGRATION.md) | tastytrade integration phases: read-only → market data → order flow → portfolio sync & heartbeat |
| [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](docs/PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md) | Phase 5: portfolio-aware theta engine — position risk, theta scan, strategy preview, roll/repair, THETA-POLICY |
| [PRD-FINNHUB-SUBAGENTS.md](docs/PRD-FINNHUB-SUBAGENTS.md) | Finnhub free-tier fallback for finance subagents |
| [EXTERNAL-RESOURCES.md](docs/EXTERNAL-RESOURCES.md) | Money for AI, CryptoTax Map, Every, OtoCo — research and startup references |

### Fund & Newsletter

| Doc | Description |
|-----|-------------|
| [FUND-CONFIG.md](docs/FUND-CONFIG.md) | AUM and inception date for dollar rebalancing and since-inception returns |
| [ROADMAP-FUND-NEWSLETTER.md](docs/ROADMAP-FUND-NEWSLETTER.md) | Roadmap: VOICE, heartbeat, AUM, performance history, investor letter |
| [ESSAY-WORKFLOW.md](docs/ESSAY-WORKFLOW.md) | Dexter → Claude → Substack: turn quarterly reports into essays |
| [docs/newsletter/](docs/newsletter/) | Newsletter archive — published essays and key takeaways |

### Research & Queries

| Doc | Description |
|-----|-------------|
| [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) | Copy-paste query library: portfolio, weekly performance, essay, investor letter, Hyperliquid |
| [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md) | Third portfolio: on-chain (HIP-3), data feasibility, symbol mapping |
| [PRD-HYPERLIQUID-PORTFOLIO-PARITY.md](docs/PRD-HYPERLIQUID-PORTFOLIO-PARITY.md) | HL portfolio parity: essay, quarterly tracking, weekly rebalancing |
| [HYPERLIQUID-SYMBOL-MAP.md](docs/HYPERLIQUID-SYMBOL-MAP.md) | HL → FD ticker mapping for price data |
| [CYCLE-STRUCTURE-MACRO-BIAS.md](docs/CYCLE-STRUCTURE-MACRO-BIAS.md) | Cycle structure framework for BTC timing and entry |
| [COUNTER-THESIS-IREN.md](docs/COUNTER-THESIS-IREN.md) | IREN pushback: dilution, pivot, CIFR/NBIS alternatives |
| [PRD-STARTUP-STACK.md](docs/PRD-STARTUP-STACK.md) | doola, Coinbase, Fairmint, Base — from MVP to startup |

---

## 📄 License

MIT
