# Dexter — Financial Analysis Tutorial

> **Dexter** is an autonomous financial research agent that lives in your terminal. It thinks, plans, and iterates until it has a data-backed answer. This tutorial walks you from installation to advanced research workflows.

> **Note:** This tutorial covers the community fork at [Rlahuerta/dexter](https://github.com/Rlahuerta/dexter), which extends the original [virattt/dexter](https://github.com/virattt/dexter) with session persistence, TUI improvements, extended thinking, and multi-provider data fallbacks.

---

## Table of Contents

1. [What is Dexter?](#1-what-is-dexter)
2. [Prerequisites](#2-prerequisites)
3. [Installation](#3-installation)
4. [Environment Setup](#4-environment-setup)
5. [Running Dexter](#5-running-dexter)
6. [Session Persistence](#6-session-persistence)
7. [How the Agent Works](#7-how-the-agent-works)
8. [Choosing Your LLM Model](#8-choosing-your-llm-model)
9. [Financial Data Queries](#9-financial-data-queries)
10. [Stock Screening](#10-stock-screening)
11. [SEC Filings Analysis](#11-sec-filings-analysis)
12. [DCF Valuation](#12-dcf-valuation)
13. [Watchlist & Portfolio Tracker](#13-watchlist--portfolio-tracker)
14. [Earnings Calendar](#14-earnings-calendar)
15. [Peer Comparison](#15-peer-comparison)
16. [Analysis Templates](#16-analysis-templates)
17. [Web Research](#17-web-research)
18. [X/Twitter Sentiment Research](#18-xtwitter-sentiment-research)
19. [Persistent Memory](#19-persistent-memory)
20. [Heartbeat Monitoring](#20-heartbeat-monitoring)
21. [Debugging with the Scratchpad](#21-debugging-with-the-scratchpad)
22. [WhatsApp Gateway](#22-whatsapp-gateway)
23. [Evaluations](#23-evaluations)
24. [Example Prompts Reference](#24-example-prompts-reference)
25. [Tips & Best Practices](#25-tips--best-practices)
26. [Troubleshooting](#26-troubleshooting)

---

## 1. What is Dexter?

Dexter is a CLI-based AI agent purpose-built for **deep financial research**. Unlike a chatbot, it doesn't just answer from its training data — it pulls live data, reads filings, runs valuations, and checks its own work before responding.

**What it can do:**

| Capability | Example |
|---|---|
| Fundamental analysis | Income statements, balance sheets, cash flows |
| Valuation | DCF fair value with sensitivity analysis |
| Market data | Real-time and historical prices, crypto |
| SEC filings | Read 10-K, 10-Q, 8-K sections |
| Stock screening | Filter by P/E, margins, growth, dividends |
| Earnings analysis | Beat/miss history, analyst estimates |
| Insider activity | Who is buying and selling |
| Web research | News, press releases, IR pages |
| Sentiment | X/Twitter market sentiment via public posts |
| Memory | Remembers your preferences and past research |

**Its investing philosophy:**  
Dexter is grounded in Buffett and Munger principles — it values accuracy over comfort, inverts before endorsing, and acknowledges uncertainty explicitly. When the numbers contradict the narrative, it will tell you which one is lying.

---

## 2. Prerequisites

| Requirement | Details |
|---|---|
| [Bun](https://bun.com) runtime | v1.0 or higher |
| LLM API key | OpenAI (default), Anthropic, Google, xAI, Ollama, etc. |
| Financial Datasets API key | Free tier includes AAPL, NVDA, MSFT ([get one here](https://financialdatasets.ai)) |
| Web search key *(optional)* | Exa (preferred), Perplexity, or Tavily |
| X Bearer Token *(optional)* | For Twitter/X sentiment research |

### Install Bun

**macOS / Linux:**
```bash
curl -fsSL https://bun.com/install | bash
```

**Windows:**
```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

Verify:
```bash
bun --version
```

---

## 3. Installation

```bash
# Clone this fork
git clone https://github.com/Rlahuerta/dexter.git
cd dexter

# Install dependencies
bun install
```

---

## 4. Environment Setup

Copy the example environment file and fill in your keys:

```bash
cp env.example .env
```

Open `.env` and configure the keys you need:

```bash
# ── LLM Providers (at least one required) ──────────────────────────────────

OPENAI_API_KEY=sk-...          # Default provider (gpt-5.4)
ANTHROPIC_API_KEY=sk-ant-...   # Claude Sonnet/Opus
GOOGLE_API_KEY=...             # Gemini
XAI_API_KEY=...                # Grok
OPENROUTER_API_KEY=sk-or-...   # Any model via OpenRouter
MOONSHOT_API_KEY=...           # Kimi K2
DEEPSEEK_API_KEY=...           # DeepSeek V3 / R1

# Local Ollama (no key needed — set the base URL)
OLLAMA_BASE_URL=http://127.0.0.1:11434

# ── Financial Data ───────────────────────────────────────────────────────────
# Free tier: AAPL, NVDA, MSFT. Paid for all tickers.
FINANCIAL_DATASETS_API_KEY=...

# ── Web Search (priority: Exa → Perplexity → Tavily) ────────────────────────
EXASEARCH_API_KEY=...          # Preferred
PERPLEXITY_API_KEY=...         # Fallback
TAVILY_API_KEY=...             # Fallback

# ── X / Twitter (optional, enables sentiment research) ───────────────────────
X_BEARER_TOKEN=...

# ── LangSmith (optional, for evaluation tracing) ─────────────────────────────
LANGSMITH_API_KEY=...
LANGSMITH_PROJECT=dexter
LANGSMITH_TRACING=false
```

> **Minimum setup:** One LLM key + `FINANCIAL_DATASETS_API_KEY` is enough to start. Add `EXASEARCH_API_KEY` to unlock web research.

---

## 5. Running Dexter

```bash
# Start interactive mode
bun start

# Development mode (auto-restarts on file changes)
bun dev
```

You'll see the Dexter intro screen with your active model displayed. Type any question and press **Enter** to run it.

### Slash commands

| Command | Action |
|---|---|
| `/help` | Show available commands and keyboard shortcuts |
| `/model` | Switch your LLM provider and model |
| `/sessions` | Browse and resume past conversations |
| `/think` | Toggle extended thinking on/off (supported models only) |
| `/watchlist` | Run portfolio morning briefing (LLM agent) |
| `/watchlist add TICKER [cost] [shares]` | Add or update a position |
| `/watchlist remove TICKER` | Remove a position |
| `/watchlist list` | Live-enriched table: prices, P&L, return %, allocation % |
| `/watchlist show TICKER` | Instant info card: price, ratios, analyst target, news |
| `/watchlist snapshot` | Portfolio dashboard with ASCII allocation chart |
| `/dream` | Consolidate memory files (merges daily notes into MEMORY.md) |
| `/dream force` | Force Dream consolidation immediately |
| `exit` / `quit` | Quit Dexter (session saved before exit) |

### Keyboard shortcuts

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate input history |
| `Enter` | Submit query |
| `Esc` | **Cancel a running query immediately** |
| `j` / `k` | Navigate selection lists (Vim-style) |
| `Ctrl+C` | Exit Dexter (session saved before exit) |

---

## 6. Session Persistence

Every query you submit is **automatically saved** to `.dexter/sessions/`. You can exit at any time and resume exactly where you left off — including full LLM context and conversation display.

### Resuming a session

1. Start Dexter: `bun start`
2. Type `/sessions` and press `Enter`
3. Navigate the list with `↑` / `↓` (or `j` / `k`)
4. Press `Enter` to resume

The session selector shows:
- **Your first question** (up to 46 chars) — so you can identify each conversation
- **Relative timestamp** — *Today 14:30*, *Yesterday 09:12*, or *Mar 20 08:00*
- **Query count** — how many exchanges were in that session

### What gets restored

| Restored | Details |
|---|---|
| LLM context | The model "remembers" your prior questions and answers |
| Display history | The previous conversation is visible in the scrollback |
| Session identity | New queries continue the same session file |

### How saving works

- **After each query**: session is queued for save (250ms debounce)
- **On `Ctrl+C` or `exit`**: any pending save is **flushed immediately** before the process exits — no data loss even if you quit right after a query

### Session files location

```
.dexter/sessions/
├── _index.json                    ← session list (id, name, queryCount, firstQuery, lastModified)
├── 1774531777088-fcc12161.json    ← full session (llmMessages + history)
└── ...
```

> **Tip:** Sessions are independent of the scratchpad. The scratchpad captures raw tool calls for debugging; sessions capture the conversation for continuity.

---

## 7. How the Agent Works

Understanding the agent loop helps you write better queries.

### The iteration loop

Dexter runs a **tool-calling loop** of up to 10 iterations per query:

```
Query
  └─ Iteration 1: LLM decides which tools to call
       └─ Execute tools in parallel
            └─ Add results to scratchpad
  └─ Iteration 2: LLM reviews results, calls more tools if needed
       └─ ...
  └─ Iteration N: LLM has enough data → writes final answer
```

Each iteration, the LLM sees:
- Your original query
- All tool results gathered so far
- A tool usage status (prevents redundant calls)

The loop exits when the LLM stops calling tools, indicating it has a complete answer.

### Context management

Dexter manages a **120,000-token context window**. When tool results push past this limit:
- Oldest results are cleared from the prompt
- The last 10 results (or 3 on overflow) are kept
- Important data is flushed to persistent memory

### Parallel tool execution

Multiple tool calls within a single iteration run **in parallel**, keeping research fast.

---

## 8. Choosing Your LLM Model

### Switching models

Type `/model` at the prompt to open the interactive selector:

1. Choose a **provider** (OpenAI, Anthropic, Google, xAI, Moonshot, DeepSeek, OpenRouter, Ollama)
2. Choose a **model** from the list, or type one manually (for OpenRouter and Ollama)

Your selection is saved to `.dexter/settings.json` and persists across sessions.

### Available models

| Provider | Models | Best for |
|---|---|---|
| **OpenAI** | gpt-5.4 *(default)*, gpt-4.1 | General-purpose, fast |
| **Anthropic** | claude-sonnet-4.6, claude-opus-4.6 | Complex reasoning, long filings |
| **Google** | gemini-3-flash-preview, gemini-3.1-pro | Fast, cost-efficient |
| **xAI** | grok-4-0709, grok-4-1-fast-reasoning | Real-time knowledge |
| **Moonshot** | kimi-k2-5 | Long-context analysis |
| **DeepSeek** | deepseek-chat, deepseek-reasoner | Reasoning tasks, low cost |
| **OpenRouter** | Any model (type manually) | Flexibility |
| **Ollama** | Any locally/cloud-served model | Privacy, local inference |

### Using Ollama (local or cloud)

Ollama lets you run models locally or point to a remote Ollama endpoint:

```bash
# .env
OLLAMA_BASE_URL=http://127.0.0.1:11434       # local
OLLAMA_BASE_URL=https://your-cloud-host      # remote / cloud
```

Then use `/model` → select **Ollama** → pick from your downloaded models (or type a model name if using a remote endpoint).

Model names use the `ollama:` prefix internally, e.g. `ollama:nemotron-3-super:cloud`.

### Extended thinking with Ollama (`/think`)

For models that support extended reasoning (`qwen3`, `deepseek-r1`, `qwq`), use `/think` to toggle it on or off mid-session:

```
/think
```

- **ON** (default for reasoning models): the model produces a `<think>` reasoning block before its answer. Dexter strips this from the displayed output and shows it in a dimmed style.
- **OFF**: disables the reasoning block for faster, shorter replies.

> **Tip:** Use `/think` ON for deep analysis and DCF valuations; toggle it OFF for quick factual lookups to save time and tokens.

### Provider-specific notes

- **Anthropic**: Uses prompt caching on the system prompt — reduces token costs ~90% on repeated queries.
- **OpenRouter**: Type any model ID from [openrouter.ai/models](https://openrouter.ai/models) when prompted.
- **Ollama cloud**: If your remote Ollama endpoint is not discoverable via `/api/tags`, the model selector will fall back to a free-text input where you can type the model name directly.

---

## 9. Financial Data Queries

### The two core financial tools

Dexter routes financial queries through two intelligent meta-tools:

| Tool | Use for |
|---|---|
| `get_financials` | Statements, metrics, ratios, estimates, segments, earnings |
| `get_market_data` | Prices, crypto, news, insider trades |

You never call these directly — just ask in plain English.

### Data source fallback chain

When the primary Financial Datasets API cannot return data (e.g. 402 for unpaid tickers, missing international data), Dexter automatically falls back to:

1. **Yahoo Finance** — analyst price targets, international tickers (`VWS.CO`, `AZN.L`, `SAP.DE`, etc.)
2. **Financial Modeling Prep (FMP)** — income statements, balance sheets, and cash flows for European and other international tickers (250 free requests/day with `FMP_API_KEY`)
3. **Web search** — if financial APIs return no data, the agent retries using `web_search`

This means many queries that previously failed silently on non-US tickers now return real results automatically.

### Income statements

```
Show me Apple's revenue and net income for the last 5 years
```

```
Compare NVDA vs AMD gross margins over the past 3 years
```

```
What was Microsoft's operating income trend from 2020 to 2024?
```

### Balance sheet

```
What is Tesla's total debt and cash position?
```

```
Show me Amazon's current ratio and debt-to-equity over the last 4 years
```

### Cash flow analysis

```
What is Meta's free cash flow history for the past 5 years?
```

```
How much does Apple spend on capex annually?
```

### Financial metrics and ratios

```
What are Apple's key valuation metrics? (P/E, EV/EBITDA, P/FCF)
```

```
Compare ROE and ROIC for AAPL, MSFT, and GOOGL
```

```
What is NVDA's price-to-sales ratio history?
```

### Analyst estimates

```
What are analyst EPS estimates for Tesla for the next 3 years?
```

```
What is the consensus price target for MSFT?
```

### Earnings history

```
Show AAPL's last 8 quarters of EPS beat/miss history
```

```
Did Amazon beat revenue expectations last quarter?
```

### Revenue segments

```
Break down Microsoft's revenue by business segment for 2024
```

```
How much of Google's revenue comes from advertising vs. cloud?
```

### Current stock prices

```
What is NVDA's current price and 52-week range?
```

```
Show me the current prices for AAPL, MSFT, GOOGL, and AMZN
```

### Historical prices

```
What has Apple's stock done over the past year?
```

```
Plot TSLA's price from January 2023 to today
```

### Cryptocurrency

```
What is Bitcoin's current price?
```

```
Show Ethereum's price history for the past 6 months
```

### Company news

```
What's the latest news on Nvidia?
```

```
Any recent news on Tesla earnings or product launches?
```

### Insider trading

```
Have any Apple insiders been buying or selling recently?
```

```
Show me insider transactions for NVDA in the last 3 months
```

---

## 10. Stock Screening

Use the `stock_screener` tool to find stocks that match financial criteria. Just describe what you want in plain English.

### Screening examples

**Value stocks:**
```
Find stocks with P/E below 15 and dividend yield above 3%
```

**Growth stocks:**
```
Screen for companies with revenue growth above 20% and gross margin above 60%
```

**Quality stocks:**
```
Find stocks with ROE above 20%, debt-to-equity below 0.5, and positive free cash flow
```

**Combined criteria:**
```
Show me tech stocks with P/E below 25, EPS growth above 15%, and market cap above $10B
```

**Value + quality:**
```
Find companies trading below book value with positive earnings and low debt
```

> **Note:** The screener returns matching tickers with the metric values used for screening. You can then drill into any result with `get_financials`.

---

## 11. SEC Filings Analysis

The `read_filings` tool fetches and reads actual SEC filing text — 10-K annual reports, 10-Q quarterly reports, and 8-K current events.

### Reading specific sections

```
What does Apple's 10-K say about its risk factors?
```

```
Summarize Tesla's MD&A section from their most recent 10-K
```

```
What did Amazon say about AWS growth in their latest 10-Q?
```

### Earnings announcements

```
What did Nvidia report in their most recent 8-K earnings release?
```

```
Read Microsoft's latest earnings announcement
```

### Business description

```
Describe Meta's business model from their 10-K
```

```
What does Netflix's 10-K say about competition risks?
```

### Comparing across filings

```
How has Apple's business description changed between their 2022 and 2024 10-K filings?
```

```
What risk factors did Tesla add to their 10-K this year compared to last?
```

> **Tip:** Filings can be large. Be specific about the section you want (risk factors, MD&A, business description, financial statements) to get targeted results faster.

---

## 12. DCF Valuation

Dexter has a built-in **DCF (Discounted Cash Flow) valuation skill** that follows a rigorous 8-step workflow. It triggers automatically on valuation-related queries.

### Triggering the DCF skill

Any of these phrases will invoke the skill:

```
What is Apple's intrinsic value?
```

```
Run a DCF on Nvidia
```

```
Is Microsoft undervalued or overvalued?
```

```
What's Tesla worth based on fundamentals?
```

```
Give me a fair value estimate for Amazon
```

### What the DCF skill does

The skill runs an 8-step workflow automatically:

1. **Gather data** — 5-year FCF history, financial metrics, balance sheet, analyst estimates, current price, sector
2. **Calculate FCF growth rate** — 5-year CAGR with 10–20% haircut, capped at 15%
3. **Estimate WACC** — sector-adjusted using the Dexter sector-WACC table (risk-free: 4%, ERP: 5–6%)
4. **Project cash flows** — Years 1–5 with 5% annual growth decay; terminal value at 2.5%
5. **Calculate present value** — Discount to Enterprise Value → subtract net debt → per-share fair value
6. **Sensitivity analysis** — 3×3 matrix varying WACC (±1%) and terminal growth (2.0%, 2.5%, 3.0%)
7. **Validate results** — Sanity-checks EV against reported, terminal value ratio, FCF per share
8. **Present findings** — Summary, inputs table, projected FCF table, sensitivity matrix, caveats

### Example output structure

```
Valuation Summary
  Current price: $185.40
  Fair value: $210–240 (base case: $225)
  Upside: ~21%

Key Inputs
  | Assumption          | Value  | Source              |
  |---------------------|--------|---------------------|
  | FCF (TTM)           | $107B  | Cash flow statement |
  | FCF 5-yr CAGR       | 9.2%   | Calculated          |
  | Growth rate used    | 8.0%   | With 13% haircut    |
  | WACC                | 9.0%   | Tech sector + D/E   |
  | Terminal growth     | 2.5%   | GDP proxy           |

Sensitivity Matrix (Fair Value per Share)
  ...

Caveats
  - FCF has been lumpy; 2021 spike inflates CAGR
  - Services segment growing faster than assumed
  - Significant buyback program not fully modeled
```

---

## 13. Watchlist & Portfolio Tracker

Dexter includes a built-in watchlist so you can track your positions and get a morning briefing with a single command.

### Managing positions

```
/watchlist add NVDA 400 100       # Add NVDA: 100 shares at $400 cost basis
/watchlist add MSFT               # Track without cost basis (watch-only)
/watchlist remove TSLA            # Remove a position
```

The watchlist is persisted to `.dexter/watchlist.json` and survives restarts.

### Live-enriched list — `/watchlist list`

```
/watchlist list
```

Fetches live prices in parallel and displays a fully enriched table:

```
Watchlist  —  2026-04-15  (4 positions)

TICKER  SHARES  COST     CURRENT    DAY%     P&L       RETURN   ALLOC
──────  ──────  ───────  ─────────  ───────  ────────  ───────  ──────
NVDA      100   $400.00  $875.40   -2.1%    +$47,540  +118.9%   61%
MSFT       50   $380.00  $420.15   +1.2%    + $2,008   +10.6%   28%
AMD        --        --  $156.20   +0.8%          --       --    --
─────────────────────────────────────────────────────────────────────
TOTAL                   $61,885    +0.3%    +$49,548   +49.3%  100%
```

- **DAY%** — colour-coded green/red
- **P&L** — unrealised dollars only for positions with cost basis + shares
- **ALLOC** — each position's % of total portfolio value
- **Watch-only** tickers (no shares) show current price and day % only
- Gracefully falls back to stored data when `FINANCIAL_DATASETS_API_KEY` is not set

### Single-ticker info card — `/watchlist show TICKER`

```
/watchlist show AMD
```

Instant inline card — no agent call, no waiting:

```
┌─ AMD — Advanced Micro Devices ────────────────────────────────┐
│ Price:  $156.20  (+0.81%)          52-wk: $107.05 – $227.30  │
│ Mkt Cap: $253B                                                 │
├───────────────────────────────────────────────────────────────┤
│ P/E: 45.2   P/B: 4.1   EV/EBITDA: 32.1   PEG: 1.8           │
├───────────────────────────────────────────────────────────────┤
│ Analyst: BUY (28 buy / 4 hold / 3 sell)                       │
│ Avg Target: $195.00   Upside: +24.8%                          │
├───────────────────────────────────────────────────────────────┤
│ News (2026-04-14): AMD launches MI350 GPU for AI inference    │
│      (2026-04-12): Analyst raises PT to $200 from $180        │
│      (2026-04-09): Q1 earnings guide reaffirmed               │
└───────────────────────────────────────────────────────────────┘
```

Useful when you want a quick sanity check before asking the agent for a deep dive.

### Portfolio snapshot — `/watchlist snapshot`

```
/watchlist snapshot
```

Dashboard view with an ASCII horizontal bar chart:

```
Portfolio Snapshot  —  2026-04-15
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Invested:  $59,000
Current Value:   $61,885
Total P&L:       +$2,885  (+4.9%)

Allocation:
  NVDA  █████████████████████████░   61%
  MSFT  ████████████░░░░░░░░░░░░░░   28%
  AMD   ████░░░░░░░░░░░░░░░░░░░░░░   11%

Best:  NVDA   +118.9%
Worst: MSFT    +10.6%

Watch-only (no position size): AMD
```

Only tickers with both `shares` and `costBasis` contribute to totals.

### Morning briefing — `/watchlist` (bare)

```
/watchlist
```

Injects your full position list into the agent and triggers the **watchlist-briefing** skill, which:

1. Fetches live price, day % change, and 52-week range for every ticker
2. Looks up next earnings date and analyst consensus rating
3. Calculates unrealised P&L % for positions with cost basis set
4. Outputs a compact table: `Ticker | Price | Day% | P&L% | Next Earnings | Rating`
5. Flags any position ±5% intraday or with earnings within 7 days

---

## 14. Earnings Calendar

Ask Dexter for a structured earnings calendar for any set of tickers.

### Example prompts

```
What are the upcoming earnings for NVDA, MSFT, and AAPL?
```

```
Show me an earnings calendar for my watchlist this month.
```

```
When does Tesla report next quarter, and what's the implied move?
```

The **earnings-calendar** skill:

1. Fetches earnings dates, analyst EPS/revenue consensus, and prior-quarter surprise %
2. Estimates the options-implied earnings move (IV ÷ √52 approximation)
3. Groups results by week in a table: `Date | Ticker | EPS Est. | Prior Surprise | Impl. Move | Key watch`
4. Offers to save to `~/reports/earnings-calendar-YYYY-MM-DD.md`

### Triggers

The skill fires automatically when your query contains phrases like "earnings this week", "upcoming earnings", "earnings calendar", or "when does X report".

---

## 15. Peer Comparison

Get a structured side-by-side comparison of a company against its sector peers.

### Example prompts

```
Compare NVDA to its semiconductor peers.
```

```
How does Palantir's valuation compare to other enterprise software companies?
```

```
Is Microsoft expensive relative to mega-cap tech?
```

The **peer-comparison** skill:

1. Identifies peers automatically via `stock_screener` (same industry, 0.25×–4× market cap), or uses tickers you name
2. Fetches for all companies: P/E, EV/EBITDA, P/FCF, PEG, revenue growth YoY, gross margin, ROIC, net debt/EBITDA
3. Produces two tables:
   - **Valuation multiples** (cheapest/priciest vs. peer median annotated)
   - **Growth & quality** (outliers highlighted per column)
4. Writes a 3–4 sentence verdict on where the subject stands
5. Offers to save to `~/reports/{TICKER}-peer-comparison-YYYY-MM-DD.md`

---

## 16. Analysis Templates

Dexter ships four structured research templates that can be triggered naturally or by name.

### Earnings Preview

```
Run an earnings preview for AMD before next week's report.
```

```
Give me an earnings preview template for TSLA.
```

Covers: consensus vs. actuals history, segment breakdown, guidance track record, implied move, key metrics to watch, bull/bear scenarios. Saves to `~/reports/{TICKER}-earnings-preview-{date}.md`.

### Short Thesis

```
Build a short thesis for NKLA.
```

```
What are the bear case arguments for WeWork?
```

Covers: valuation vs. historical range, debt and liquidity, competitive threats, insider activity (Form 4), technical picture, trough-multiple price target. Saves to `~/reports/{TICKER}-short-thesis-{date}.md`.

### Sector Overview

```
Give me a sector overview for semiconductors.
```

```
What's the state of the cloud computing sector right now?
```

Covers: macro backdrop, top 5 names by market cap with YTD performance, valuation spread, recent catalysts, three actionable ideas (value / growth / contrarian). Saves to `~/reports/sector-{name}-overview-{date}.md`.

### Saving reports

All four templates offer to save their output to `~/reports/`. You can also ask explicitly:

```
Run an earnings preview for AAPL and save it to ~/reports/
```

---

## 17. Web Research

Dexter can research the open web to complement structured financial data.

### Web fetch (static pages)

The `web_fetch` tool reads any URL directly — ideal for press releases, IR pages, articles, and **PDF documents**:

```
Read Apple's latest investor relations page at https://investor.apple.com
```

```
Get the content from this earnings call transcript: [URL]
```

```
Read this annual report PDF: https://example.com/annual-report-2024.pdf
```

> **PDF support:** `web_fetch` automatically extracts text from PDFs via `unpdf`. Just pass a `.pdf` URL — no extra steps needed.

### Web search

The `web_search` tool searches the web and returns the top results. Requires Exa, Perplexity, or Tavily API key.

```
Search for recent analyst reports on Nvidia's AI chip demand outlook
```

```
Find news about the latest Federal Reserve interest rate decision
```

```
What are analysts saying about Tesla's robotaxi timeline?
```

### Browser tool (interactive / JS-heavy pages)

The `browser` tool uses Playwright for full JavaScript rendering — use it for SPAs, dashboards, and pages that require interaction:

```
Navigate to Yahoo Finance and read AAPL's analyst ratings
```

> **When to use which:**
> - Static pages (news, IR, filings) → `web_fetch` (faster)
> - Dynamic pages, dashboards, SPAs → `browser`
> - Finding pages you don't know the URL for → `web_search` first, then `web_fetch`

---

## 18. X/Twitter Sentiment Research

If you have an `X_BEARER_TOKEN`, Dexter can research public sentiment on X/Twitter through the **X Research skill**.

### Triggering the X Research skill

```
What are people saying about NVDA on X?
```

```
Search Twitter for sentiment on the Fed's latest rate decision
```

```
What's Crypto Twitter saying about Bitcoin right now?
```

```
Find what analysts are posting about Microsoft earnings
```

### What the skill does

1. Decomposes your question into 3–5 targeted searches
2. Searches by cashtag (`$NVDA`), keywords, bullish/bearish signals, expert voices
3. Filters by engagement (sort by likes, `min_likes` threshold)
4. Follows high-engagement threads for full context
5. Synthesizes findings by theme: bullish, bearish, neutral, catalysts

### Output format

```
Query Summary
  Searched: $NVDA, "nvidia earnings", "nvidia AI" — last 7 days

Sentiment Themes
  Bullish
    - @analyst_1: "NVDA data center margins expanding..." — 1.2k♥
    - @fund_mgr: "Blackwell demand exceeding estimates..." — 845♥

  Bearish
    - @skeptic_2: "Valuation pricing in perfection..." — 312♥

Overall Sentiment
  Predominantly bullish (7:2 ratio). Retail and institutional voices aligned.
  Key divergence: long-term bulls vs. near-term valuation concerns.

Caveats
  - X sentiment is not a reliable predictor of short-term price moves
  - Sample bias toward vocal minorities
  - 7-day window only
```

---

## 19. Persistent Memory

Dexter has a **persistent memory system** that stores information across sessions as Markdown files backed by a SQLite vector database.

### Memory storage location

```
.dexter/memory/
  MEMORY.md              ← Long-term facts and preferences
  FINANCE.md             ← Accumulated financial research notes
  2026-03-25.md          ← Today's daily log
  archive/               ← Processed daily files (safe to inspect)
  index.sqlite           ← Embeddings + keyword search index
  .dream-meta.json       ← Dream consolidation state
```

### Storing memories

```
Remember that I'm analyzing the semiconductor sector for Q2 2026
```

```
Note: I prefer P/FCF over P/E for valuation comparisons
```

```
Remember that my portfolio target for NVDA is $200 with a 5-year hold
```

### Recalling memories

```
What do you remember about my portfolio preferences?
```

```
What sector analysis have I been working on?
```

### Daily notes

```
Log today's research: reviewed AAPL 10-K, noted Services gross margin expansion
```

### Memory search (automatic)

Dexter automatically searches memory at the start of relevant queries. For example, if you previously told it your portfolio weights, it will factor that in when giving allocation advice.

### Dream — Memory Consolidation

As daily notes accumulate, memory can become fragmented (relative phrases like "yesterday" lose meaning, the same ticker appears in multiple files with conflicting data). **Dream** consolidates all of this automatically.

#### What Dream does

1. Reads every daily note file (`YYYY-MM-DD.md`) not yet processed
2. Merges fragmented entries into clean, dated paragraphs
3. Replaces relative language ("yesterday", "last week") with absolute dates
4. Deduplicates ticker mentions — keeps the most recent data per ticker
5. Resolves contradictions (e.g., two different price targets for NVDA)
6. Rewrites `MEMORY.md` and `FINANCE.md` with consolidated summaries
7. Archives processed daily files to `.dexter/memory/archive/` (never deleted)

#### Auto-trigger conditions

Dream runs automatically at startup when **all three** are true:

| Condition | Default |
|-----------|---------|
| ≥ 2 unprocessed daily files exist | — |
| ≥ 24 hours since last Dream run | — |
| ≥ 3 sessions since last Dream run | — |

#### Manual trigger

```
/dream           # runs if trigger conditions are met
/dream force     # always runs, regardless of conditions
```

#### When Dream is most useful

- **After a research sprint** — you've had 5 sessions over 3 days researching NVDA, with notes spread across 5 daily files. Dream merges them into a single coherent summary.
- **Returning after a gap** — "two weeks ago" in a daily note is now meaningless. Dream replaces it with the actual date before you lose the context.
- **Conflicting data** — you got different analyst targets on different days. Dream keeps the most recent and removes the stale entry.
- **Context pressure** — without Dream, all daily files are loaded into context. After Dream, only `MEMORY.md` and `FINANCE.md` are needed — significantly reducing token usage on long sessions.

#### Checking Dream status

```
/dream           # shows "conditions not met" message if no action is taken
```

Or inspect `.dexter/memory/.dream-meta.json`:

```json
{
  "lastRunAt": "2026-04-14T09:23:11.000Z",
  "sessionsSinceLastRun": 0,
  "filesProcessed": 5,
  "version": 1
}
```

### Memory embedding providers

Memory embeddings use your existing LLM keys with this priority:

1. **OpenAI** (`OPENAI_API_KEY`)
2. **Gemini** (`GOOGLE_API_KEY`)
3. **Ollama** (`OLLAMA_BASE_URL`)

---

## 20. Heartbeat Monitoring

The **heartbeat** feature lets Dexter periodically check things you care about on a schedule. This is especially useful when running Dexter through the WhatsApp gateway.

### Setting up a heartbeat

```
Watch NVDA for me and alert me if it moves more than 3% in a day
```

```
Add a morning market check to my heartbeat
```

```
Set up a heartbeat to track Tesla news daily
```

### Viewing your heartbeat checklist

```
What is my heartbeat currently checking?
```

### How it works

Your checklist lives in `.dexter/HEARTBEAT.md`. The gateway reads this file on each heartbeat tick (configurable interval) and runs the agent against it. Results are sent back via your configured channel (e.g., WhatsApp).

---

## 21. Debugging with the Scratchpad

Every query creates a **JSONL scratchpad file** in `.dexter/scratchpad/`. This is your audit trail.

### `.dexter/` directory overview

```
.dexter/
├── scratchpad/                         ← raw tool call logs (one file per query)
│   ├── 2026-03-25-142300_9a8f10723f79.jsonl
│   └── ...
├── sessions/                           ← conversation history (for /sessions resume)
│   ├── _index.json
│   └── <session-id>.json
├── memory/                             ← persistent memory (MEMORY.md + SQLite)
├── settings.json                       ← active model/provider selection
└── HEARTBEAT.md                        ← heartbeat checklist (optional)
```

### Scratchpad entry types

| Type | Contents |
|---|---|
| `init` | Original query |
| `tool_result` | Tool name, arguments, raw result, LLM summary, duration |
| `thinking` | Agent reasoning steps between iterations |

### Example entry

```json
{
  "type": "tool_result",
  "timestamp": "2026-03-25T14:23:05.123Z",
  "toolName": "get_income_statements",
  "args": { "ticker": "AAPL", "period": "annual", "limit": 5 },
  "result": { "income_statements": [...] },
  "llmSummary": "5 years of Apple annual income statements: revenue grew from $274B to $394B"
}
```

### Reading scratchpad files

```bash
# Pretty-print the latest scratchpad
cat .dexter/scratchpad/*.jsonl | tail -1 | python3 -m json.tool

# See all tool calls in a session
cat .dexter/scratchpad/2026-03-25-142300_9a8f10723f79.jsonl | \
  python3 -c "import sys,json; [print(json.loads(l)['toolName']) for l in sys.stdin if 'toolName' in l]"
```

---

## 22. WhatsApp Gateway

Run Dexter through WhatsApp to get financial research delivered to your phone.

### Setup

```bash
# Step 1: Link your WhatsApp account (scan QR code in terminal)
bun run gateway:login

# Step 2: Start the gateway
bun run gateway
```

### Usage

Open WhatsApp and **message yourself**. Dexter processes messages sent to your own chat and responds.

For group chats, **@mention** Dexter to activate it.

### Gateway configuration

The gateway is configured through `.dexter/gateway.json`. The heartbeat feature integrates here:

```json
{
  "gateway": {
    "heartbeat": {
      "enabled": true,
      "intervalMinutes": 10,
      "activeHours": { "start": 9, "end": 17 },
      "maxIterations": 6
    }
  }
}
```

For full setup instructions, see [`src/gateway/channels/whatsapp/README.md`](../src/gateway/channels/whatsapp/README.md).

---

## 23. Evaluations

Dexter includes a built-in evaluation suite to test answer quality against a dataset of financial questions.

### Running evaluations

```bash
# Full test set
bun run src/evals/run.ts

# Random sample of 10 questions
bun run src/evals/run.ts --sample 10
```

### What it tests

The dataset (`src/evals/dataset/finance_agent.csv`) covers question types including:

- **Market analysis** — M&A, corporate events, industry trends
- **Trend analysis** — Multi-year metric trends (ARPU, revenue, margins)
- **Valuation** — Price targets, fair value estimates
- **Earnings** — Beat/miss history, guidance, surprises

### Scoring

Uses an **LLM-as-judge** approach: the evaluating LLM checks each answer against correctness criteria and contradiction checks. Results are displayed in real-time and logged to LangSmith (requires `LANGSMITH_API_KEY`).

---

## 24. Example Prompts Reference

Below is a curated library of prompts organized by analysis type.

### Fundamental analysis

```
What are Apple's revenue, gross margin, and net income for the last 5 fiscal years?
```

```
Compare Microsoft and Google's operating leverage over the past 3 years
```

```
What is Amazon's free cash flow yield based on current market cap?
```

```
Break down Meta's revenue growth by segment (advertising vs. Reality Labs)
```

### Valuation

```
Is Nvidia overvalued based on its current P/E relative to its 5-year average?
```

```
Run a full DCF valuation on Microsoft
```

```
Compare EV/EBITDA multiples for the FAANG group
```

```
What is the implied growth rate in Tesla's current stock price?
```

### Competitive analysis

```
Compare gross margins for AAPL, MSFT, GOOGL, META, and AMZN for FY2024
```

```
Which semiconductor company has the best return on invested capital?
```

```
Show me revenue growth rates for the top 5 cloud providers
```

### Risk and due diligence

```
What are the key risk factors in Nvidia's latest 10-K?
```

```
What does Tesla's most recent 10-Q say about production risks?
```

```
Have any Apple executives sold stock in the last 6 months?
```

```
What material events did Amazon file in 8-K disclosures this year?
```

### Market and macro

```
What is Bitcoin's price history over the past year and its current market cap?
```

```
Find me value stocks with P/E below 12 and dividend yield above 4%
```

```
Screen for high-quality compounders: ROE > 20%, debt/equity < 0.5, 10yr revenue CAGR > 10%
```

```
What's the latest news on the Federal Reserve's interest rate policy?
```

### Portfolio analysis

```
Compare the 3-year total return of AAPL, MSFT, NVDA, and the S&P 500
```

```
What sectors have the highest forward P/E multiples right now?
```

```
Find dividend aristocrats with payout ratio below 50% and 10yr DGR above 8%
```

### Sentiment and social

```
What is market sentiment on Nvidia ahead of their next earnings?
```

```
What are institutional investors saying about AI capex on X/Twitter?
```

---

## 25. Tips & Best Practices

### Writing better queries

**Be specific about time periods:**
```
# Vague
Show me Apple's revenue

# Better
Show me Apple's annual revenue for fiscal years 2019–2024
```

**Name your ticker explicitly:**
```
# May require resolution
Show me the iPhone maker's earnings

# Better
Show me AAPL's earnings
```

**Ask for comparisons in one query:**
```
# Two separate queries (slower)
Get AAPL revenue
Get MSFT revenue

# One query (faster, single tool call)
Compare AAPL and MSFT revenue for the last 3 years
```

**Let Dexter pick the tool:**  
You never need to say "use get_financials" or "call the DCF skill" — Dexter picks the right approach automatically based on your question.

### Getting the most from the DCF skill

- Specify the ticker clearly: `Run a DCF on NVDA` not `what's it worth`
- Ask for sensitivity: Dexter includes it automatically, but you can say `include a sensitivity analysis` to reinforce
- Ask for caveats: `What are the main risks to your DCF assumptions?` after the valuation

### Using memory effectively

- Store your investment thesis: `Remember my thesis for NVDA: long AI infrastructure buildout, 3-5 year hold`
- Store your preferences: `Remember that I prefer EV/FCF over EV/EBITDA for valuation`
- Store portfolio context: `Remember my current AAPL position is 100 shares bought at $150`

### Understanding tool limits

- `read_filings` limits to 3 filings per query (API calls are slow)
- The agent loop runs a max of 10 iterations — complex multi-company deep dives may hit this
- `web_fetch` has a 15-minute cache — re-running a query quickly may return cached results

### Free tier tickers

The free tier of the Financial Datasets API covers **AAPL, NVDA, and MSFT**. To analyze other stocks, you need a paid API key.

---

## 26. Troubleshooting

### "No tools available. Please check your API key configuration."

**Cause:** The agent started but has no valid API key for any LLM.  
**Fix:** Ensure `.env` has at least one LLM key (e.g., `OPENAI_API_KEY`).

### The model selector shows no Ollama models

**Cause:** Ollama isn't running locally, or `OLLAMA_BASE_URL` points to a remote endpoint.  
**Fix:** When the list is empty, Dexter falls back to free-text input — type your model name directly (e.g., `nemotron-3-super:cloud`).

### "Reached maximum iterations"

**Cause:** A very complex query hit the 10-iteration cap.  
**Fix:** Break the query into parts. For example, instead of one massive multi-company, multi-year, multi-metric query, run two focused ones.

### Financial data returns empty results for non-US tickers

**Cause:** The ticker is not covered by the Financial Datasets free tier, or is an international ticker not in their dataset.  
**Fix:** This fork automatically falls back to Yahoo Finance and FMP. Add `FMP_API_KEY` to `.env` for the best international coverage. If both fail, the agent will try `web_search` as a last resort.

### Financial data returns empty results for US tickers

**Cause:** The ticker requires a paid Financial Datasets API key.  
**Fix:** Free tier covers AAPL, NVDA, MSFT only. Use those tickers to test, or upgrade your API key.

### `/sessions` list is empty

**Cause:** No sessions have been saved yet, or Dexter was exited before any query was submitted.  
**Fix:** Sessions are created on the **first query** of a run. Submit at least one question, then `/sessions` will show it on next launch.

### Session context not fully restored after resume

**Cause:** If the session was created before session persistence was added, or the session file is corrupted.  
**Fix:** Start a new session. Old sessions before the persistence feature are not retroactively available.

### Esc key not cancelling a running query

**Cause:** Older version of Dexter or stream does not support mid-flight abort.  
**Fix:** This fork includes immediate Escape cancellation. Ensure you are running the fork (`bun start` in the forked repo).

### Web search not working

**Cause:** No search API key configured.  
**Fix:** Add at least one of `EXASEARCH_API_KEY`, `PERPLEXITY_API_KEY`, or `TAVILY_API_KEY` to `.env`.

### Memory search not returning results

**Cause:** Embeddings provider not configured, or memory directory empty.  
**Fix:** Ensure `OPENAI_API_KEY` (or `GOOGLE_API_KEY` / `OLLAMA_BASE_URL`) is set. Memory embeddings require an embedding-capable model.

### Checking tool call history

If Dexter gave an unexpected answer, check the scratchpad:

```bash
# List scratchpad files sorted by recency
ls -lt .dexter/scratchpad/

# Read the latest session
cat .dexter/scratchpad/<latest-file>.jsonl
```

This shows every tool call, its arguments, the raw response, and the LLM's interpretation — useful for debugging routing or unexpected results.

---

## Appendix: Tool Quick Reference

| Tool | What it fetches | Requires key |
|---|---|---|
| `get_financials` | Statements, metrics, ratios, estimates, earnings | `FINANCIAL_DATASETS_API_KEY` |
| `get_market_data` | Prices, crypto, news, insider trades | `FINANCIAL_DATASETS_API_KEY` |
| `read_filings` | SEC 10-K, 10-Q, 8-K content | `FINANCIAL_DATASETS_API_KEY` |
| `stock_screener` | Filter stocks by financial criteria | `FINANCIAL_DATASETS_API_KEY` |
| `web_fetch` | Static web pages and articles | None |
| `browser` | Interactive / JS-rendered pages | None |
| `web_search` | Web search results | Exa / Perplexity / Tavily |
| `x_search` | X/Twitter public posts | `X_BEARER_TOKEN` |
| `memory_search` | Semantic search over your memory | LLM key (for embeddings) |
| `memory_get` | Read specific memory file sections | None |
| `memory_update` | Add / edit / delete memories | None |
| `heartbeat` | View / update heartbeat checklist | None |
| `skill` | DCF valuation, earnings calendar, peer comparison, earnings preview, short thesis, sector overview, watchlist briefing | Depends on skill |
| `read_file` | Local workspace files | None |
| `write_file` | Create new local files | None |
| `edit_file` | Modify existing local files | None |

---

*Built with ♥ by [virattt](https://github.com/virattt/dexter) · Fork maintained at [Rlahuerta/dexter](https://github.com/Rlahuerta/dexter) · MIT License*
