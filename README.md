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
| **Financial Datasets API** | All finance subagents (prices, fundamentals, filings, insider trades, news) use Financial Datasets as primary data source. | Built for AI agents: section-level SEC filings, structured JSON, real-time ingestion. See [DATA-API-FINANCIAL-DATASETS.md](docs/DATA-API-FINANCIAL-DATASETS.md). |
| **Finnhub fallback** | PRD for Finnhub free tier as fallback when FD fails or is rate-limited. | Resilience and cost reduction. Zero marginal cost for overflow on simple price/news queries. See [PRD-FINNHUB-SUBAGENTS.md](docs/PRD-FINNHUB-SUBAGENTS.md). |
| **WhatsApp interface** | Gateway for WhatsApp; group chat is the primary interaction surface. | Research and alerts in the same place we already communicate. CLI and HTTP API remain for power users. |
| **Startup stack** | PRD for moving from MVP to startup: Wyoming LLC, custody, tokenized equity, USDC on Base (doola, Coinbase, Fairmint). | Collapses entity formation, compliance, and settlement into something a solo founder can access. See [PRD-STARTUP-STACK.md](docs/PRD-STARTUP-STACK.md). |
| **External research** | Documented references for AI monetary preferences, crypto tax by jurisdiction, back-office tools, Web3 entity formation. | Informs thesis (BTC preference in AI agents), entity planning (tax efficiency), and startup infra. See [EXTERNAL-RESOURCES.md](docs/EXTERNAL-RESOURCES.md). |

**Core thesis:** BTC HODL is the foundation. Diversification satellites are HYPE (onchain stocks) and SOL/NEAR/SUI/ETH (agentic web4). The AI infrastructure universe is the opportunity set. Dexter helps decide *when to diversify — and when HODLing is the right call*. We are not real estate bulls — housing collapse thesis is in SOUL.md.

---

## ✅ Prerequisites

| Requirement | Notes |
|---|---|
| [Bun](https://bun.com) v1.0+ | Primary runtime |
| OpenAI API key | Required — [get one](https://platform.openai.com/api-keys) |
| Financial Datasets API key | Required for market data — [get one](https://financialdatasets.ai) |
| Exa API key | Optional — for web search |

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

# Web search (Exa preferred → Perplexity → Tavily as fallbacks)
EXASEARCH_API_KEY=
PERPLEXITY_API_KEY=       # Optional fallback
TAVILY_API_KEY=           # Optional fallback

# X/Twitter (enables x_search tool for public sentiment research)
X_BEARER_TOKEN=           # Optional

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

# Validate portfolio structure
bun run validate-portfolio
```

### Quick validation (5 min)

1. `bun run start` → paste Query 1 from [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md)
2. Verify `~/.dexter/PORTFOLIO.md` was created
3. Run `bun test` and `bun run src/evals/run.ts --sample 3` (evals need `OPENAI_API_KEY`)

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

**Hyperliquid portfolio (on-chain, HIP-3 — 24/7 tradeable, no fiat conversion):**
```
Suggest a Hyperliquid portfolio — only tickers available on HIP-3. Save to PORTFOLIO-HYPERLIQUID.md
What's the weekly performance of my on-chain portfolio vs SPY, GLD, BTC?
Compare my Hyperliquid portfolio to the HL basket
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
