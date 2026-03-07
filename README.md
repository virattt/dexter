# Dexter 🤖

Dexter is an autonomous financial research agent that thinks, plans, and learns as it works. It performs analysis using task planning, self-reflection, and real-time market data. Think Claude Code, but built specifically for financial research.

<img width="1098" height="659" alt="Screenshot 2026-01-21 at 5 25 10 PM" src="https://github.com/user-attachments/assets/3bcc3a7f-b68a-4f5e-8735-9d22196ff76e" />

## Table of Contents

- [👋 Overview](#-overview)
- [🔧 How We've Customized Dexter](#-how-weve-customized-dexter)
- [✅ Prerequisites](#-prerequisites)
- [💻 How to Install](#-how-to-install)
- [🚀 How to Run](#-how-to-run)
- [🧠 Customizing Dexter — SOUL.md & HEARTBEAT.md](#-customizing-dexter--soulmd--heartbeatmd)
- [📊 How to Evaluate](#-how-to-evaluate)
- [⚡ API Rate Limiting](#-api-rate-limiting)
- [🐛 How to Debug](#-how-to-debug)
- [📱 How to Use with WhatsApp](#-how-to-use-with-whatsapp)
- [🤝 How to Contribute](#-how-to-contribute)
- [🔄 Syncing with Upstream (for forks)](#-syncing-with-upstream-for-forks)
- [📚 Documentation](#-documentation)
- [📄 License](#-license)


## 👋 Overview

Dexter's **north star** is the **Portfolio Builder** — helping you build and maintain a near-perfect portfolio aligned with your investment thesis. The agent knows what that portfolio looks like (from SOUL.md). Performance is essential: a portfolio must outperform best hedge funds, stock market indexes (S&P 500, NASDAQ), and BTC — otherwise it fails the bar. The heartbeat runs **weekly** to check if rebalancing is needed and **quarterly** to write a performance report vs these benchmarks.

Dexter takes complex financial questions and turns them into clear, step-by-step research plans. It runs those tasks using live market data, checks its own work, and refines the results until it has a confident, data-backed answer.  

**Key Capabilities:**
- **Intelligent Task Planning**: Automatically decomposes complex queries into structured research steps
- **Autonomous Execution**: Selects and executes the right tools to gather financial data
- **Self-Validation**: Checks its own work and iterates until tasks are complete
- **Real-Time Financial Data**: Access to income statements, balance sheets, and cash flow statements
- **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt) [![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=social&logo=discord)](https://discord.gg/jpGHv2XB6T)

<img width="1042" height="638" alt="Screenshot 2026-02-18 at 12 21 25 PM" src="https://github.com/user-attachments/assets/2a6334f9-863f-4bd2-a56f-923e42f4711e" />


## 🔧 How We've Customized Dexter

This fork extends [virattt/dexter](https://github.com/virattt/dexter) with a specific investment thesis, data stack, and startup path. Here's what we changed and why.

| Customization | What | Why |
|---------------|------|-----|
| **North star: Portfolio Builder** | Agent's primary purpose is building and maintaining a near-perfect portfolio aligned with SOUL.md. Performance must beat hedge funds, indexes, and BTC. | Generic research agents answer questions; we need one that *owns* the outcome — rebalancing, benchmarking, and reporting. |
| **SOUL.md — thesis & coverage universe** | Full investment thesis: AI infrastructure supply chain (7 layers), conviction tiering (Core Compounders → Avoid), sizing rules, analytical edge. BTC-heavy core; HYPE and SOL/NEAR/SUI/ETH as satellites. | Standard tools can't evaluate equipment cycle dynamics, EDA complexity, or power bottlenecks. The edge lives where consensus hasn't priced. SOUL.md gives every query structural context. |
| **HEARTBEAT — weekly rebalance + quarterly report** | Mondays: rebalance check vs target. First week of quarter: performance report vs S&P, NASDAQ, BTC. | Passive monitoring isn't enough. We need scheduled action: detect drift, compare to benchmarks, deliver reports. |
| **Financial Datasets as primary data API** | All finance subagents (prices, fundamentals, filings, insider trades, news) use Financial Datasets. | Built for AI agents: section-level SEC filings, structured JSON, real-time ingestion. Beats Finnhub for filings and fundamentals. See [DATA-API-FINANCIAL-DATASETS.md](docs/DATA-API-FINANCIAL-DATASETS.md). |
| **Finnhub fallback (planned)** | PRD for Finnhub free tier as fallback when FD fails or is rate-limited. | Resilience and cost relief. Zero marginal cost for overflow on simple price/news queries. See [PRD-FINNHUB-SUBAGENTS.md](docs/PRD-FINNHUB-SUBAGENTS.md). |
| **WhatsApp as primary interface** | Gateway for WhatsApp; group chat is the main way to interact. | Research and alerts in the same place we already communicate. CLI and HTTP API remain for power users. |
| **Startup stack (doola, Coinbase, Fairmint, Base)** | PRD for moving from MVP to startup: Wyoming LLC, custody, tokenized equity, USDC on Base. | The Stack collapses entity formation, compliance, and settlement into something a solo founder can access. See [PRD-STARTUP-STACK.md](docs/PRD-STARTUP-STACK.md). |
| **External research (Money for AI, CryptoTax Map, Every, OtoCo)** | Documented references for AI monetary preferences, crypto tax by jurisdiction, back-office tools, Web3 entity formation. | Informs thesis (BTC preference in AI agents), entity planning (tax efficiency), and startup infra (Every, OtoCo as alternatives). See [EXTERNAL-RESOURCES.md](docs/EXTERNAL-RESOURCES.md). |

**Core motivation:** This project exists to answer *how (and why) should we diversify a BTC-heavy portfolio?* BTC HODL is the thesis. Diversification satellites are HYPE (onchain stocks) and SOL/NEAR/SUI/ETH (agentic web4). The AI infrastructure universe is the opportunity set. Dexter helps decide when to diversify — and when HODLing is the right call. **We are NOT real estate bulls** — housing collapse thesis in SOUL.md; smart villas in southern Europe are a passion project only.

---

## ✅ Prerequisites

- [Bun](https://bun.com) runtime (v1.0 or higher)
- OpenAI API key (get [here](https://platform.openai.com/api-keys))
- Financial Datasets API key (get [here](https://financialdatasets.ai))
- Exa API key (get [here](https://exa.ai)) - optional, for web search

#### Installing Bun

If you don't have Bun installed, you can install it using curl:

**macOS/Linux:**
```bash
curl -fsSL https://bun.com/install | bash
```

**Windows:**
```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

After installation, restart your terminal and verify Bun is installed:
```bash
bun --version
```

## 💻 How to Install

1. Clone the repository:
```bash
git clone https://github.com/virattt/dexter.git
cd dexter
```

2. Install dependencies with Bun:
```bash
bun install
```

3. Set up your environment variables:
```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your API keys (if using cloud providers)
# OPENAI_API_KEY=your-openai-api-key
# ANTHROPIC_API_KEY=your-anthropic-api-key (optional)
# GOOGLE_API_KEY=your-google-api-key (optional)
# XAI_API_KEY=your-xai-api-key (optional)
# OPENROUTER_API_KEY=your-openrouter-api-key (optional)

# Institutional-grade market data for agents; AAPL, NVDA, MSFT are free
# FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key

# (Optional) If using Ollama locally
# OLLAMA_BASE_URL=http://127.0.0.1:11434

# Web Search (Exa preferred, Tavily fallback)
# EXASEARCH_API_KEY=your-exa-api-key
# TAVILY_API_KEY=your-tavily-api-key
```

## 🚀 How to Run

Run Dexter in interactive mode:
```bash
bun start
```

Or with watch mode for development:
```bash
bun dev
```

## 🧠 Customizing Dexter — SOUL.md & HEARTBEAT.md

**Core motivation:** This project exists to get suggestions for how (and why) to diversify a **BTC-heavy portfolio**. BTC HODL is the thesis. HYPE (onchain stocks) and SOL/NEAR/SUI/ETH (agentic web4) are thesis-aligned satellites. The WhatsApp group is the primary interface. Dexter helps you decide when, how, and why to diversify — or when HODLing is the right call.

Out of the box, Dexter is a general-purpose financial research agent. But it becomes dramatically more useful when you give it a persistent investment thesis, a defined coverage universe, and a monitoring discipline. That's what `SOUL.md` and `HEARTBEAT.md` do.

### Why customize?

Standard financial APIs and LLM-based analysis work well for high-coverage names — everyone agrees Nvidia is a buy. But the edge in research lives in the positions that standard tools *can't* evaluate: equipment cycle dynamics, EDA complexity growth, power bottleneck economics, memory supply-demand gaps. These require domain-specific context that no generic agent carries.

By embedding your thesis into Dexter's identity files, every query it runs is informed by your structural view of the market. It doesn't just answer "what is AMAT's P/E?" — it answers it in the context of where AMAT sits in the AI supply chain, what the H2 2026 equipment cycle inflection means, and whether the current valuation reflects the structural flywheel — and whether it's a good diversification opportunity for a BTC-heavy portfolio.

### SOUL.md — The agent's identity and thesis

`SOUL.md` lives in the repo root and is injected into Dexter's system prompt on every query. It defines:

- **Coverage universe** — organized by supply chain layer (Chip Designers, Foundry, Equipment, EDA, Power, Memory, Networking)
- **Structural thesis** — the "why" behind each position, not just the ticker
- **Conviction tiering** — every name classified as Core Compounder, Cyclical Beneficiary, Speculative Optionality, or Avoid/Too Crowded, with bottleneck type, duration, and attackability
- **Sizing rules** — regime determines size (not conviction), layer determines durability, catalyst determines timing
- **Analytical edge** — where standard tools fail and what domain-specific analysis to prioritize

Edit `SOUL.md` to reflect your own thesis. The structure matters more than the specific names — Dexter uses it to contextualize every answer.

### HEARTBEAT.md — The monitoring checklist

`~/.dexter/HEARTBEAT.md` is a user-managed file that defines what Dexter should monitor periodically. In addition to the checklist, the heartbeat runs:

- **Weekly (Mondays):** Rebalance check — compares your portfolio to the target from SOUL.md and alerts if adjustments are needed
- **Quarterly (first week of Jan/Apr/Jul/Oct):** Performance report — summarizes how the portfolio performed and what changed

Keep your current holdings in `~/.dexter/PORTFOLIO.md` (ticker, weight, layer, tier) so the agent can compare against the target. Copy `docs/HEARTBEAT.example.md` to `~/.dexter/HEARTBEAT.md` for a BTC/HYPE/SOL-focused checklist. The checklist also includes:

- **Per-ticker monitoring criteria** — what to check for each name (e.g., "AMAT price + order trends, H2 2026 equipment cycle signals")
- **Conviction tier tags** — `[CC]`, `[CB]`, `[SO]`, `[AV]` on every entry so research effort scales with conviction
- **Macro signals** — Fed rates, SOX index, hyperscaler capex, BTC/Gold ratio, Burry's danger signal
- **Thematic sections** — equity tokenization/RWA, HIP-3 onchain perps, commodities, bear market accumulation zones
- **Research priority guide** — Core Compounders get deep fundamental research; Speculative Optionality gets catalyst-only monitoring

### Example queries to get the most out of this setup

**Thesis-aware research:**
```
What's our thesis on Bloom Energy and where does it sit in the durability hierarchy?
```
```
Compare the structural position of SNDK vs MU in the memory bottleneck thesis
```
```
What did Aschenbrenner's Q4 2025 13F signal about pricing power migration?
```

**Financial data + thesis context:**
```
Pull current price and key ratios for our Layer 3 equipment names: AMAT, ASML, LRCX, KLAC, TEL, BESI
```
```
Pull the latest income statement for TSM and analyze it through the foundry tollbooth lens
```
```
What's KLAC's margin profile and how does process control complexity insurance play into the thesis?
```

**Stress-test the thesis:**
```
What's the bear case for holding Layer 1 chip designers right now?
```
```
Where does this thesis break? What assumptions are most vulnerable?
```
```
If AI demand is merely good but not euphoric, which positions survive and which don't?
```

**Cross-layer analysis:**
```
Which of our core compounders have the longest bottleneck duration and lowest attackability?
```
```
Rank our cyclical beneficiaries by how exposed they are to a single capex cycle
```

**Portfolio building:**
```
Does my portfolio need rebalancing? Compare to the target from SOUL
```
```
What would a near-perfect portfolio look like given our thesis?
```
```
How and why should we diversify from a BTC-heavy portfolio right now?
```
```
What's the case for adding HYPE or SOL/NEAR/SUI/ETH to a BTC-heavy portfolio?
```

**Macro + monitoring:**
```
Check the latest price and news on BE, CORZ, and SNDK
```
```
What's the current BTC/Gold ratio telling us about risk appetite?
```
```
Summarize the latest hyperscaler capex guidance from MSFT, GOOG, AMZN, META
```

**Deep dives (uses web_search + financial tools together):**
```
Read AMAT's latest 10-K risk factors and identify anything that changes the equipment cycle thesis
```
```
Find the latest Fabricated Knowledge or SemiAnalysis coverage on H2 2026 wafer fab equipment outlook
```
```
What are the latest NAND contract pricing trends from TrendForce?
```

## 📊 How to Evaluate

Dexter includes an evaluation suite that tests the agent against a dataset of financial questions. Evals use LangSmith for tracking and an LLM-as-judge approach for scoring correctness.

**Run on all questions:**
```bash
bun run src/evals/run.ts
```

**Run on a random sample of data:**
```bash
bun run src/evals/run.ts --sample 10
```

The eval runner displays a real-time UI showing progress, current question, and running accuracy statistics. Results are logged to LangSmith for analysis.

## ⚡ API Rate Limiting

When querying many tickers at once (e.g., pulling data across an entire coverage universe), Dexter includes built-in protections against `429 Too Many Requests` errors from the Financial Datasets API:

- **Concurrency semaphore** — limits parallel API requests to 5 at a time
- **Exponential backoff with retry** — automatically retries failed requests up to 3 times with increasing delays, respecting `Retry-After` headers
- **Batched execution** — tool calls within `financial_search` and `financial_metrics` are processed in batches of 8 rather than all at once

For internationally listed stocks (e.g., BESI on Euronext Amsterdam), the Financial Datasets API may return no data. Dexter will automatically fall back to `web_search` for these names. You can note OTC ADR tickers (e.g., `BESIY`) in `SOUL.md` to improve lookup success.

## 🐛 How to Debug

Dexter logs all tool calls to a scratchpad file for debugging and history tracking. Each query creates a new JSONL file in `.dexter/scratchpad/`.

**Scratchpad location:**
```
.dexter/scratchpad/
├── 2026-01-30-111400_9a8f10723f79.jsonl
├── 2026-01-30-143022_a1b2c3d4e5f6.jsonl
└── ...
```

Each file contains newline-delimited JSON entries tracking:
- **init**: The original query
- **tool_result**: Each tool call with arguments, raw result, and LLM summary
- **thinking**: Agent reasoning steps

**Example scratchpad entry:**
```json
{"type":"tool_result","timestamp":"2026-01-30T11:14:05.123Z","toolName":"get_income_statements","args":{"ticker":"AAPL","period":"annual","limit":5},"result":{...},"llmSummary":"Retrieved 5 years of Apple annual income statements showing revenue growth from $274B to $394B"}
```

This makes it easy to inspect exactly what data the agent gathered and how it interpreted results.

## 📱 How to Use with WhatsApp

Chat with Dexter through WhatsApp by linking your phone to the gateway. Messages you send to yourself are processed by Dexter and responses are sent back to the same chat.

**Quick start:**
```bash
# Link your WhatsApp account (scan QR code)
bun run gateway:login

# Start the gateway
bun run gateway
```

Then open WhatsApp, go to your own chat (message yourself), and ask Dexter a question.

For detailed setup instructions, configuration options, and troubleshooting, see the [WhatsApp Gateway README](src/gateway/channels/whatsapp/README.md).

## 🤝 How to Contribute

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

**Important**: Please keep your pull requests small and focused.  This will make it easier to review and merge.

## 🔄 Syncing with Upstream (for forks)

If you forked from [virattt/dexter](https://github.com/virattt/dexter) and want to pull in upstream updates without losing your commits:

```bash
# 1. Add upstream (once; skip if you already have it)
git remote add upstream https://github.com/virattt/dexter.git

# 2. Fetch upstream
git fetch upstream

# 3. Merge upstream/main into your main
git merge upstream/main
```

If there are conflicts, resolve them in the listed files, then:

```bash
git add .
git commit -m "Merge upstream main"
```

Then push:

```bash
git push origin main
```

**Do not** use GitHub's "Discard X commits" — that deletes your work. Merge locally instead.

## 📚 Documentation

| Doc | Description |
|-----|-------------|
| [DATA-API-FINANCIAL-DATASETS.md](docs/DATA-API-FINANCIAL-DATASETS.md) | Financial Datasets API — endpoints, auth, parameters used by Dexter |
| [EXTERNAL-RESOURCES.md](docs/EXTERNAL-RESOURCES.md) | Money for AI, CryptoTax Map, Every, OtoCo — research and startup stack references |
| [PRD-STARTUP-STACK.md](docs/PRD-STARTUP-STACK.md) | The Stack (doola, Coinbase, Fairmint, Base) — from MVP to startup |
| [PRD-FINNHUB-SUBAGENTS.md](docs/PRD-FINNHUB-SUBAGENTS.md) | Finnhub free tier as fallback for finance subagents |
| [CYCLE-STRUCTURE-MACRO-BIAS.md](docs/CYCLE-STRUCTURE-MACRO-BIAS.md) | Cycle structure framework for BTC timing and entry (bias forming, not predicting) |
| [COUNTER-THESIS-IREN.md](docs/COUNTER-THESIS-IREN.md) | IREN pushback: dilution, pivot, CIFR/NBIS as better alternatives |
| [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) | Copy-paste queries: suggest portfolio + track weekly performance vs BTC, GLD, SPY |

## 📄 License

This project is licensed under the MIT License.
