# Dexter 🤖

Dexter is an autonomous financial research agent that thinks, plans, and learns as it works. It performs analysis using task planning, self-reflection, and real-time market data. Think Claude Code, but built specifically for financial research.

> **This is a community fork of [virattt/dexter](https://github.com/virattt/dexter)** with additional TUI improvements, session persistence, multi-provider fallbacks, Ollama support, and reliability fixes. See [Fork Changes](#-fork-changes) for details.

<img width="1098" height="659" alt="Screenshot 2026-01-21 at 5 25 10 PM" src="https://github.com/user-attachments/assets/3bcc3a7f-b68a-4f5e-8735-9d22196ff76e" />

## Table of Contents

- [👋 Overview](#-overview)
- [🔀 Fork Changes](#-fork-changes)
- [✅ Prerequisites](#-prerequisites)
- [💻 How to Install](#-how-to-install)
- [🚀 How to Run](#-how-to-run)
- [⌨️ Slash Commands](#️-slash-commands)
- [💾 Session Persistence](#-session-persistence)
- [🧠 Local Models with Ollama](#-local-models-with-ollama)
- [📊 How to Evaluate](#-how-to-evaluate)
- [🐛 How to Debug](#-how-to-debug)
- [📱 How to Use with WhatsApp](#-how-to-use-with-whatsapp)
- [🤝 How to Contribute](#-how-to-contribute)
- [📄 License](#-license)


## 👋 Overview

Dexter takes complex financial questions and turns them into clear, step-by-step research plans. It runs those tasks using live market data, checks its own work, and refines the results until it has a confident, data-backed answer.

**Key Capabilities:**
- **Intelligent Task Planning**: Automatically decomposes complex queries into structured research steps
- **Autonomous Execution**: Selects and executes the right tools to gather financial data
- **Self-Validation**: Checks its own work and iterates until tasks are complete
- **Real-Time Financial Data**: Income statements, balance sheets, cash flow, analyst targets, insider trades
- **Multi-Provider Fallback**: Automatically retries with Yahoo Finance / FMP when primary data APIs fail
- **Session Persistence**: Conversations are auto-saved and can be resumed across restarts
- **Local Model Support**: Run fully offline with Ollama (no API keys required)
- **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt) [![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=social&logo=discord)](https://discord.gg/jpGHv2XB6T)

<img width="1042" height="638" alt="Screenshot 2026-02-18 at 12 21 25 PM" src="https://github.com/user-attachments/assets/2a6334f9-863f-4bd2-a56f-923e42f4711e" />


## 🔀 Fork Changes

This fork adds the following on top of the upstream repository:

### Session Persistence
- Conversations are **auto-saved** after each query to `.dexter/sessions/`
- Resume any past session with `/sessions` — the list shows the first query, relative timestamp (*Today 14:30*, *Yesterday 09:12*), and query count
- Sessions are flushed to disk immediately on `Ctrl+C` or `/exit`, preventing data loss
- LLM context and full display history are both restored on resume

### TUI Improvements
- **Scrollback buffer**: previous exchanges remain readable while a new query runs
- **Table alignment**: markdown tables with bold/styled cells render with correct column widths
- **Escape cancellation**: `Esc` immediately interrupts a running query
- **Status footer**: live hints show keyboard shortcuts and current agent state
- **Think indicator**: visual feedback when the model is using extended reasoning

### Data & API Reliability
- **Yahoo Finance fallback**: analyst price targets and international tickers (e.g. `VWS.CO`, `AZN.L`) automatically use Yahoo Finance when the primary API returns a 402
- **FMP fallback**: Financial Modeling Prep fills in international financial statements not covered by financialdatasets.ai (250 free requests/day)
- **Web search fallback**: agent automatically retries with web search when financial data tools fail
- **Data freshness enforcement**: agent explicitly checks whether retrieved data is recent enough
- **Exponential backoff on rate limits**: all financial API calls (`financialdatasets.ai`, FMP) automatically retry with exponential back-off (1 s → 2 s → 4 s → 8 s) on HTTP 429 responses — no manual intervention needed
- **Multi-source data validation**: when `financialdatasets.ai` returns annual income statements and `FMP_API_KEY` is set, FMP is queried concurrently; if `totalRevenue` or `netIncome` diverge by more than 15 % between sources, a `⚠️ Data discrepancy` warning is appended to the result so you can investigate before acting on the numbers

### Ollama / Local LLM
- Full support for local Ollama models with no API key required
- `/think` command toggles extended reasoning on compatible models (`qwen3`, `deepseek-r1`, `qwq`)
- Think-tag output from Ollama is stripped and displayed cleanly in the TUI
- PDF text extraction via `unpdf` (useful for filing analysis)

### New Slash Commands
- `/help` — in-TUI help panel with all commands and keyboard shortcuts
- `/sessions` — session browser with resume support
- `/think` — toggle extended thinking for supported models
- `/watchlist` — portfolio morning briefing; subcommands: `add TICKER [cost] [shares]`, `remove TICKER`, `list`, `show TICKER`, `snapshot`
- `/dream` — manually trigger Dream memory consolidation; `force` bypasses trigger conditions

### Watchlist Display Enhancements
- **`/watchlist list`** now fetches live prices in parallel and shows: current price, day %, unrealised P&L ($), return %, allocation %, plus a portfolio totals row
- **`/watchlist show TICKER`** — instant inline info card: price + 52-week range, key ratios (P/E, P/B, EV/EBITDA, PEG), analyst consensus + average price target, last 3 news headlines — no agent call required
- **`/watchlist snapshot`** — portfolio dashboard with ASCII horizontal bar chart (allocation %), total invested vs. current value, P&L, best/worst performers
- All three commands gracefully degrade when `FINANCIAL_DATASETS_API_KEY` is not set

### New Skills & Research Templates
- **Earnings Calendar** — structured table of upcoming earnings with consensus estimates, prior surprise %, and options implied move
- **Peer Comparison** — side-by-side valuation, growth, and quality metrics against auto-discovered sector peers
- **Earnings Preview** — pre-earnings research template: consensus, guidance history, implied move, bull/bear scenarios
- **Short Thesis** — bear-case research template: valuation, debt, competitive threats, insider activity, trough-multiple price target
- **Sector Overview** — macro backdrop, top names, valuation spread, recent catalysts, three actionable ideas
- **Watchlist Briefing** — triggered by `/watchlist`; live price + P&L + next earnings table for your positions

### Memory System & Dream Consolidation
- **Persistent memory** stored in `.dexter/memory/` as plain Markdown (`MEMORY.md`, `FINANCE.md`, daily `YYYY-MM-DD.md` files)
- **Four-tier priority system** (P1 critical → P4 noise) guides what the agent remembers and prunes
- **Memory auto-injection**: at the start of every query, Dexter extracts any stock tickers mentioned (e.g. `AAPL`, `NVDA`) and silently searches memory for prior research on those tickers; if relevant notes are found, they are prepended as a `📚 Prior Research:` block so the agent can build on earlier work without re-fetching the same data (capped at 2 tickers × 3 snippets per query)
- **Dream** — background consolidation cycle inspired by Claude Code's AutoDream: merges fragmented daily notes, replaces relative timestamps with absolute dates, deduplicates ticker data, resolves contradictions, and rewrites `MEMORY.md`/`FINANCE.md` into clean summaries
  - Auto-triggers at startup when: ≥2 daily files exist, ≥24h elapsed, ≥3 sessions since last run
  - Manual trigger: `/dream` (respects conditions) or `/dream force` (always runs)
  - Processed daily files are archived to `.dexter/memory/archive/` — never deleted
- **Smarter context clearing**: when the agent's context window fills up and old tool results must be dropped, a compact text summary is automatically generated and injected into the scratchpad — the LLM never loses key numbers or ticker data even when results are cleared
- Full documentation: [`docs/memory.md`](docs/memory.md)

### TUI Stability Fixes
- **`@`-path completion lag eliminated** — removed blocking `spawnSync(fdfind)` call that froze the terminal on every `@` keystroke; replaced with async `readdirSync`-based completion
- **`/watchlist` double-Enter fixed** — exact-match slash command autocomplete suppression prevents the completion dropdown from requiring a second Enter press to submit
- Agent can write markdown reports to `~/reports/` (and any `~/` subdirectory), not just the current working directory
- Requested with `@` prefix in prompts (e.g. `@~/reports/my-analysis.md`) — full tab-completion included


## ✅ Prerequisites

- [Bun](https://bun.com) runtime (v1.0 or higher)
- At least one LLM provider:
  - **OpenAI** API key — [platform.openai.com](https://platform.openai.com/api-keys)
  - **Anthropic** API key — [console.anthropic.com](https://console.anthropic.com)
  - **Google** API key — [aistudio.google.com](https://aistudio.google.com)
  - **Ollama** running locally — [ollama.com](https://ollama.com) *(no key needed)*
- Financial data (optional but recommended):
  - **Financial Datasets** API key — [financialdatasets.ai](https://financialdatasets.ai) *(AAPL, NVDA, MSFT free)*
  - **FMP** API key — [financialmodelingprep.com](https://site.financialmodelingprep.com) *(250 req/day free)*
- Web search (optional):
  - **Exa** API key — [exa.ai](https://exa.ai) *(preferred)*
  - **Tavily** API key — [tavily.com](https://tavily.com) *(fallback)*

#### Installing Bun

**macOS/Linux:**
```bash
curl -fsSL https://bun.com/install | bash
```

**Windows:**
```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

Verify the installation:
```bash
bun --version
```

## 💻 How to Install

1. Clone this fork:
```bash
git clone https://github.com/Rlahuerta/dexter.git
cd dexter
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp env.example .env
```

Edit `.env` and fill in the keys you have. The minimum viable setup is **one LLM provider** — everything else is optional:

```bash
# ── LLM Providers (need at least one) ──────────────────────────────────────
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key   # optional
GOOGLE_API_KEY=your-google-api-key         # optional
XAI_API_KEY=your-xai-api-key               # optional
OPENROUTER_API_KEY=your-openrouter-api-key # optional

# Ollama — no key needed, just set the URL if not using the default
OLLAMA_BASE_URL=http://127.0.0.1:11434

# ── Financial Data ──────────────────────────────────────────────────────────
FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key
FMP_API_KEY=your-fmp-api-key               # international tickers fallback

# ── Web Search (Exa → Tavily fallback chain) ────────────────────────────────
EXASEARCH_API_KEY=your-exa-api-key
TAVILY_API_KEY=your-tavily-api-key
```

## 🚀 How to Run

```bash
bun start
```

Or with watch mode for development:
```bash
bun dev
```

On first launch Dexter detects which API keys are present and selects the best available model automatically. You can switch at any time with `/model`.

## ⌨️ Slash Commands

Type `/` at the prompt to see all available commands:

| Command | Description |
|---------|-------------|
| `/help` | Show available commands and keyboard shortcuts |
| `/model` | Switch LLM provider or model |
| `/sessions` | Browse and resume past conversations |
| `/think` | Toggle extended thinking (supported models only) |
| `/watchlist` | Run portfolio morning briefing (LLM agent) |
| `/watchlist add TICKER [cost] [shares]` | Add a position to your watchlist |
| `/watchlist remove TICKER` | Remove a position |
| `/watchlist list` | Live-enriched table: prices, P&L, return %, allocation |
| `/watchlist show TICKER` | Instant info card: price, ratios, analyst target, news |
| `/watchlist snapshot` | Portfolio dashboard with ASCII allocation chart |
| `/dream` | Consolidate memory files (merges daily notes into MEMORY.md) |
| `/dream force` | Force Dream consolidation regardless of trigger conditions |
| `/exit` | Exit Dexter (session is saved first) |

**Keyboard shortcuts:**
- `↑` / `↓` — navigate input history
- `Esc` — cancel a running query immediately
- `Ctrl+C` — exit (session auto-saved before exit)

## 💾 Session Persistence

Every query is automatically saved. To resume a past conversation:

1. Start Dexter: `bun start`
2. Type `/sessions` and press Enter
3. Navigate the list with `↑` / `↓` (or `j` / `k`)
4. Press `Enter` to resume — LLM context and display history are fully restored

Sessions are stored in `.dexter/sessions/`. The selector shows the first question asked, a relative timestamp, and query count so you can quickly identify the right session.

## 🧠 Local Models with Ollama

Run Dexter with no cloud API keys using [Ollama](https://ollama.com):

```bash
# Install a model
ollama pull qwen3

# OLLAMA_BASE_URL defaults to http://127.0.0.1:11434 — no .env change needed
bun start
```

Switch to a specific Ollama model at runtime with `/model → Ollama`.

For models that support extended reasoning (`qwen3`, `deepseek-r1`, `qwq`), use `/think` to toggle it on or off.

## 📊 How to Evaluate

Dexter includes an evaluation suite that tests the agent against a dataset of financial questions. Evals use LangSmith for tracking and an LLM-as-judge approach for scoring correctness.

**Run on all questions:**
```bash
bun run src/evals/run.ts
```

**Run on a random sample:**
```bash
bun run src/evals/run.ts --sample 10
```

The eval runner displays a real-time UI showing progress, current question, and running accuracy. Results are logged to LangSmith for analysis.

## 🐛 How to Debug

Dexter logs all tool calls to a scratchpad file for debugging and history tracking. Each query creates a new JSONL file in `.dexter/scratchpad/`.

```
.dexter/
├── scratchpad/
│   ├── 2026-01-30-111400_9a8f10723f79.jsonl
│   └── ...
├── sessions/
│   ├── _index.json
│   └── <session-id>.json
└── settings.json
```

Each scratchpad file contains newline-delimited JSON entries tracking:
- **init**: The original query
- **tool_result**: Each tool call with arguments, raw result, and LLM summary
- **thinking**: Agent reasoning steps
- **context_summary**: Compact digest of tool results that were cleared from context to make room — preserves key numbers and tickers even when old results are dropped

**Example entry:**
```json
{"type":"tool_result","timestamp":"2026-01-30T11:14:05.123Z","toolName":"get_income_statements","args":{"ticker":"AAPL","period":"annual","limit":5},"result":{...},"llmSummary":"Retrieved 5 years of Apple annual income statements showing revenue growth from $274B to $394B"}
```

**Example context_summary entry:**
```json
{"type":"context_summary","timestamp":"2026-01-30T11:14:10.456Z","content":"The following 2 earlier tool result(s) were condensed to save context:\n- get_income_statements(ticker=AAPL, period=annual): Revenue $394B, Net Income $97B, gross margin 45%…\n- get_stock_price(ticker=AAPL): $182.50 (+1.2%)…"}
```

## 📱 How to Use with WhatsApp

Chat with Dexter through WhatsApp by linking your phone to the gateway. Messages you send to yourself are processed by Dexter and responses are sent back to the same chat.

```bash
# Link your WhatsApp account (scan QR code)
bun run gateway:login

# Start the gateway
bun run gateway
```

Then open WhatsApp, go to your own chat (message yourself), and ask a question.

For detailed setup and troubleshooting see the [WhatsApp Gateway README](src/gateway/channels/whatsapp/README.md).

## 🤝 How to Contribute

Contributions are welcome. To keep things manageable:

1. Fork the repository
2. Create a focused feature branch
3. Commit your changes with clear messages
4. Push and open a Pull Request against this fork or [upstream](https://github.com/virattt/dexter)

**Please keep pull requests small and focused** — one fix or feature per PR makes review much faster.

To sync this fork with the upstream:
```bash
git remote add upstream https://github.com/virattt/dexter.git
git fetch upstream
git merge upstream/main
```

## 📄 License

This project is licensed under the MIT License.
