# Dexter

**Research that runs. Portfolios that stay aligned.**

An autonomous financial research agent built for deep analysis: it decomposes questions into plans, runs them against live market data and SEC filings, checks its own work, and refines until the answer is data-backed. The bar is the **Portfolio Builder** — build and maintain a portfolio aligned with your thesis that beats the benchmarks (S&P 500, NASDAQ, BTC, top hedge funds). Otherwise it fails the bar.

## Table of Contents

- [What you get](#what-you-get)
- [Customization](#customization)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running Dexter](#running-dexter)
- [Project structure](#project-structure)
- [SOUL and HEARTBEAT](#soul-and-heartbeat)
- [Example queries](#example-queries)
- [tastytrade](#tastytrade)
- [Hyperliquid](#hyperliquid)
- [Evaluating, rate limits, debugging](#evaluating-rate-limits-debugging)
- [Documentation](#documentation)
- [License](#license)

---

## What you get

Not a chatbot. A research loop: plan → execute → validate → refine. Every answer is contextualized by your investment thesis in **SOUL.md**. You get weekly rebalance checks (Mondays), quarterly benchmark reports, and optional dollar rebalancing when AUM is set. You get regime labels, concentration alerts, and investor-letter drafts. You get fund ops: AUM config, YTD and since-inception performance, reports written to `~/.dexter/`. **VOICE.md** injects a consistent tone into every response; override at `~/.dexter/VOICE.md`. Loop detection and step limits cap runaway execution.

The thesis is structural. The sizing is tactical. The discipline is the moat.

---

## Customization

This fork extends [virattt/dexter](https://github.com/virattt/dexter) with a defined thesis, data stack, and broker integrations.

| Layer | What | Why |
|-------|------|-----|
| **Portfolio Builder** | Agent owns the outcome: rebalance, benchmark, report. Bar = beat hedge funds, indexes, BTC. | Generic agents answer questions. This one is judged on the portfolio. |
| **SOUL.md** | Thesis: AI infra supply chain (7 layers), conviction tiers, sizing rules. BTC-heavy core; HYPE, SOL/NEAR/SUI/ETH as satellites. | The edge lives where consensus hasn't priced. SOUL gives every query structural context. |
| **HEARTBEAT** | Weekly rebalance vs target. Quarterly report vs S&P, NASDAQ, BTC. Regime label. Newsletter draft when it matters. Dollar rebalancing when AUM set. | Passive monitoring isn't enough. Scheduled action: detect drift, deliver reports. |
| **VOICE.md** | ikigaistudio tone and structure in every prompt. | Generic output sounds generic. Essays and letters need a recognizable voice. |
| **Financial Datasets** | Primary source for prices, fundamentals, filings, insider trades, news. Optional Finnhub fallback for price/news when FD is down or rate-limited. | Built for agents: section-level filings, structured JSON. [DATA-API-FINANCIAL-DATASETS.md](docs/DATA-API-FINANCIAL-DATASETS.md). |
| **tastytrade** | Read-only first: accounts, positions, theta scan, strategy preview, order dry-run. Trading only when you enable it; submit/cancel behind explicit approval. Policy and portfolio-fit enforced in-tool. | Live broker data vs static PORTFOLIO.md. Theta workflows without touching live orders until you confirm. [PRD-TASTYTRADE-INTEGRATION.md](docs/PRD-TASTYTRADE-INTEGRATION.md), [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](docs/PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md). |
| **Hyperliquid** | HIP-3 data, liquidity ranking, period returns, portfolio ops, live sync, order preview, opt-in execution with approval. | Third portfolio: on-chain, 24/7, preview-first then execute when you say. [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md). |

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

Query shortcuts in the CLI: `/suggest`, `/weekly`, `/quarterly`, `/suggest-hl`, `/hl-report`, `/theta-risk`, `/theta-scan`, `/theta-preview`, `/theta-repair`, `/theta-roll`, `/theta-help`, `/theta-policy`. See [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) for the full library.

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

Standard analysis works for high-coverage names. The edge lives where it can't: equipment cycles, EDA complexity, power bottlenecks. **SOUL.md** in the repo root is injected into every prompt. It defines coverage universe, structural thesis, conviction tiers, sizing rules, and where domain analysis beats generic tools. Edit it to reflect your thesis. Structure matters more than the specific names.

**~/.dexter/HEARTBEAT.md** is your monitoring checklist. Weekly: rebalance vs target, regime label, concentration alerts, newsletter draft. Quarterly: performance vs BTC, SPY, GLD; result recorded for since-inception tracking. Keep **~/.dexter/PORTFOLIO.md** (ticker, weight, layer, tier) so Dexter can compare to target.

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

Three states: **not connected** → **read-only** → **trading enabled**. In read-only you get accounts, positions, theta scan, strategy preview, and **order dry-run** — no live orders. When you set `TASTYTRADE_ORDER_ENABLED=true`, live_orders, submit, and cancel appear; submit and cancel still require explicit approval in the CLI. Use `/tastytrade-status` to see your state.

Theta: position risk, scan, strategy preview, roll, repair. Scan and preview validate against **THETA-POLICY** (allowed underlyings, no-call list, DTE) and return **portfolio-fit** (pass/warn/block) from SOUL and PORTFOLIO. Roll and repair check the proposed order against policy; if it violates, you get `policy_blocked` and violations, not a recommendation. Earnings exclusion in scan when THETA-POLICY and Financial Datasets allow; degraded-mode notice when the key is missing. Sync portfolio from broker to a PORTFOLIO.md-style table (optional write to `~/.dexter/PORTFOLIO.md`). With `TASTYTRADE_HEARTBEAT_ENABLED=true`, heartbeat compares live positions to target and flags drift.

Setup: `TASTYTRADE_CLIENT_ID` and `TASTYTRADE_CLIENT_SECRET` in `.env`, then `bun run tastytrade:login` and paste the refresh token from my.tastytrade.com. Credentials in `~/.dexter/tastytrade-credentials.json`. Theta policy: copy [THETA-POLICY.example.md](docs/THETA-POLICY.example.md) to `~/.dexter/THETA-POLICY.md`. Docs: [DATA-API-TASTYTRADE.md](docs/DATA-API-TASTYTRADE.md), [THETA-POLICY.md](docs/THETA-POLICY.md).

---

## Hyperliquid

HIP-3 stack: prices, liquidity ranking, period returns, portfolio ops (rebalance_check, quarterly_summary), live sync to PORTFOLIO-HYPERLIQUID.md, order preview, then opt-in execution (submit/cancel) gated by `HYPERLIQUID_ORDER_ENABLED` and private key, with runtime approval. Preview first; heartbeat never submits. Env: `HYPERLIQUID_ACCOUNT_ADDRESS`; optional `HYPERLIQUID_ORDER_ENABLED` and `HYPERLIQUID_PRIVATE_KEY`. [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md), [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) (Queries 8, 8b–8e).

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
| [SOUL.md](SOUL.md) | Thesis, coverage, conviction tiers |
| [VOICE.md](docs/VOICE.md) | Brand and writing style |
| [HEARTBEAT.example.md](docs/HEARTBEAT.example.md) | Monitoring template → `~/.dexter/HEARTBEAT.md` |
| [DATA-API-FINANCIAL-DATASETS.md](docs/DATA-API-FINANCIAL-DATASETS.md) | Financial Datasets API |
| [DATA-API-TASTYTRADE.md](docs/DATA-API-TASTYTRADE.md) | tastytrade: states, tools, theta |
| [THETA-POLICY.md](docs/THETA-POLICY.md), [THETA-POLICY.example.md](docs/THETA-POLICY.example.md) | Theta policy format and template |
| [PRD-TASTYTRADE-INTEGRATION.md](docs/PRD-TASTYTRADE-INTEGRATION.md), [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](docs/PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md) | tastytrade phases and theta engine |
| [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md) | Hyperliquid portfolio and execution |
| [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) | Copy-paste query library |
| [FUND-CONFIG.md](docs/FUND-CONFIG.md), [EXTERNAL-RESOURCES.md](docs/EXTERNAL-RESOURCES.md) | AUM, inception, research refs |

---

## Contributing

Fork, branch, commit, push, open a PR. Keep PRs small and focused.

**Syncing with upstream** (if you forked from virattt/dexter):

```bash
git remote add upstream https://github.com/virattt/dexter.git   # once
git fetch upstream && git merge upstream/main
```

Do not use GitHub "Discard commits" — merge locally.

---

## License

MIT
