# Dexter Codebase Audit

**Date:** 2026-02-09
**Version audited:** 2026.2.6 (CalVer)
**Repository:** https://github.com/virattt/dexter

---

## 1. Architecture & Workflow Mapping

### What Dexter Is

Dexter is an autonomous AI-powered financial research agent. It runs as a CLI application built with TypeScript on the Bun runtime, using React (Ink) for terminal rendering. A user types a financial question in natural language; Dexter plans a research strategy, calls financial data APIs and web search tools iteratively, then synthesizes a final answer.

### End-to-End Execution Flow

```
User input (CLI)
  → src/index.tsx          Bun entry point, loads .env, renders <CLI />
  → src/cli.tsx            React/Ink shell: model selection, input handling, history display
  → useAgentRunner hook    Creates Agent instance, iterates async event stream
  → Agent.run()            Core loop (up to 10 iterations):
       ├─ callModel()          LLM call with tools bound
       ├─ executeToolCalls()   Runs selected tools, records to Scratchpad
       ├─ context management   Clears oldest tool results if >100k tokens estimated
       └─ buildIterationPrompt()  Feeds tool results back to LLM for next step
  → Final answer generation
       ├─ buildFullContextForAnswer()  Loads all tool results from Scratchpad
       ├─ buildFinalAnswerPrompt()     Separate LLM call, no tools bound
       └─ DoneEvent yielded to UI
  → HistoryItemView renders answer in terminal
```

### Component Interaction Map

| Component | Role | Calls / Called By |
|-----------|------|-------------------|
| `src/index.tsx` | Entry point | Renders `<CLI />` |
| `src/cli.tsx` | UI shell | Uses `useAgentRunner`, `useModelSelection`, `useInputHistory` |
| `src/hooks/useAgentRunner.ts` | Agent lifecycle | Creates `Agent`, consumes event stream, updates React state |
| `src/agent/agent.ts` | Core orchestration | Calls `callLlm()`, executes tools, manages `Scratchpad` |
| `src/agent/scratchpad.ts` | State tracking | JSONL persistence of all tool calls/results per query |
| `src/agent/prompts.ts` | Prompt construction | Builds system, iteration, and final-answer prompts |
| `src/model/llm.ts` | LLM abstraction | Dispatches to provider SDKs (OpenAI, Anthropic, Google, etc.) |
| `src/tools/registry.ts` | Tool registry | Conditionally registers tools based on env vars |
| `src/tools/finance/financial-search.ts` | Financial router | Inner LLM call that dispatches to 16 sub-tools |
| `src/tools/finance/financial-metrics.ts` | Metrics router | Inner LLM call that dispatches to 6 fundamental analysis sub-tools |
| `src/tools/finance/read-filings.ts` | SEC filing reader | Two-step inner LLM workflow (get metadata → read content) |
| `src/tools/browser/browser.ts` | Web scraper | Playwright-based browser automation |
| `src/tools/search/exa.ts` / `tavily.ts` | Web search | Exa preferred, Tavily fallback |
| `src/tools/skill.ts` | Skill executor | Loads SKILL.md instructions for the agent to follow |
| `src/skills/registry.ts` | Skill discovery | Scans builtin/user/project directories for SKILL.md files |

### Multi-Agent / Pipeline Patterns

Dexter uses a **nested agent pattern** where the outer agent delegates to inner "router" LLMs:

1. **Outer agent** (`Agent.run()`) — iterative tool-calling loop, max 10 iterations
2. **`financial_search` inner agent** — a separate LLM call with 16 finance sub-tools bound; routes the user's natural language query to the correct API calls
3. **`financial_metrics` inner agent** — similar pattern, routes to 6 fundamental analysis tools
4. **`read_filings` inner agent** — two-step pipeline: Step 1 LLM selects filings, Step 2 LLM selects sections to read

The outer agent sees `financial_search`, `financial_metrics`, and `read_filings` as single tools. Each internally makes its own LLM call(s) to decide which sub-tools to invoke. This is a form of **hierarchical tool routing**.

---

## 2. Data Sources & Ingestion

### External Data Sources

| Source | Module | Data Pulled | Auth | Configurable? |
|--------|--------|-------------|------|---------------|
| **Financial Datasets API** (`api.financialdatasets.ai`) | `src/tools/finance/api.ts` | Stock prices, financials, key ratios, insider trades, company facts, news, estimates, segments, crypto, SEC filings | `x-api-key` header via `FINANCIAL_DATASETS_API_KEY` | Base URL hardcoded |
| **Exa Search** | `src/tools/search/exa.ts` | Web search results (5 results with text) | `EXASEARCH_API_KEY` via `exa-js` client | Hardcoded to Exa API |
| **Tavily Search** | `src/tools/search/tavily.ts` | Web search results (5 results) | `TAVILY_API_KEY` via `@langchain/tavily` | Hardcoded |
| **Playwright browser** | `src/tools/browser/browser.ts` | Arbitrary web pages (navigate, snapshot, read) | None (public web) | N/A |
| **SEC Filing Item Types** | `src/tools/finance/filings.ts:22` | Canonical item names for 10-K/10-Q | None (public endpoint) | Hardcoded URL: `https://api.financialdatasets.ai/filings/items/types/` |

### Financial Datasets API Endpoints

All routed through `callApi()` in `src/tools/finance/api.ts`:

| Endpoint | Tool | Data |
|----------|------|------|
| `/prices/snapshot/` | `get_price_snapshot` | Latest OHLCV + volume |
| `/prices/` | `get_prices` | Historical price data |
| `/crypto/prices/snapshot/` | `get_crypto_price_snapshot` | Latest crypto OHLCV |
| `/crypto/prices/` | `get_crypto_prices` | Historical crypto prices |
| `/crypto/prices/tickers/` | `get_available_crypto_tickers` | Available crypto pairs |
| `/financials/income-statements/` | `get_income_statements` | Revenue, expenses, net income |
| `/financials/balance-sheets/` | `get_balance_sheets` | Assets, liabilities, equity |
| `/financials/cash-flow-statements/` | `get_cash_flow_statements` | Operating/investing/financing cash flows |
| `/financials/` | `get_all_financial_statements` | All three statement types |
| `/financials/key-ratios/snapshot/` | `get_key_ratios_snapshot` | Latest P/E, ROE, margins |
| `/financials/key-ratios/` | `get_key_ratios` | Historical key ratios |
| `/news/` | `get_news` | Company news articles |
| `/financials/analyst-estimates/` | `get_analyst_estimates` | Forward EPS projections |
| `/financials/segmented-revenues/` | `get_segmented_revenues` | Revenue segment breakdowns |
| `/insider-trades/` | `get_insider_trades` | SEC Form 4 insider transactions |
| `/company/facts/` | `get_company_facts` | Sector, industry, employee count |
| `/filings/` | `get_filings` | SEC filing metadata |
| `/filings/items/` | `get_10K/10Q/8K_filing_items` | SEC filing full text sections |

### Data Processing Pipeline

1. **API response** → `callApi()` returns `{ data, url }`
2. **Cache check** — `readCache()` checks `.dexter/cache/` before network call (opt-in via `{ cacheable: true }`)
3. **Tool result formatting** — `formatToolResult()` wraps data as `{ data, sourceUrls }` JSON string
4. **Router aggregation** — `financial_search` and `financial_metrics` combine multiple sub-tool results into a single `combinedData` object keyed by `{tool}_{ticker}`
5. **Scratchpad storage** — `scratchpad.addToolResult()` persists full result to JSONL file and in-memory
6. **Context injection** — `getToolResults()` formats all active results for the iteration prompt
7. **Final answer** — `getFullContexts()` loads all results (including previously cleared ones) for comprehensive final answer generation

### Caching Strategy

Defined in `src/utils/cache.ts`. File-based cache in `.dexter/cache/`:

- **Cache key**: MD5 hash of endpoint + sorted params, stored as `{endpoint}/{TICKER_}{hash}.json`
- **Opt-in only**: callers pass `{ cacheable: true }` — used for historical price data (closed date windows) and SEC filings (legally immutable)
- **No TTL/expiration**: cached entries persist indefinitely; no eviction policy
- **Corruption handling**: validates `CacheEntry` structure on read; deletes corrupted files

---

## 3. Model & LLM Usage

### Provider Configuration (`src/model/llm.ts`)

| Provider | Prefix Detection | Default Model | Fast Model | Auth |
|----------|-----------------|---------------|------------|------|
| **OpenAI** (default) | No prefix / fallback | `gpt-5.2` | `gpt-4.1` | `OPENAI_API_KEY` |
| **Anthropic** | `claude-` | User-selected | `claude-haiku-4-5` | `ANTHROPIC_API_KEY` |
| **Google** | `gemini-` | User-selected | `gemini-3-flash-preview` | `GOOGLE_API_KEY` |
| **xAI (Grok)** | `grok-` | User-selected | `grok-4-1-fast-reasoning` | `XAI_API_KEY` (via `api.x.ai/v1`) |
| **OpenRouter** | `openrouter:` | User-selected | `openrouter:openai/gpt-4o-mini` | `OPENROUTER_API_KEY` (via `openrouter.ai/api/v1`) |
| **Ollama** | `ollama:` | User-selected | Same as primary | `OLLAMA_BASE_URL` (default `127.0.0.1:11434`) |

### Where LLM Calls Happen

| Call Site | Model Used | Tools Bound? | Purpose |
|-----------|-----------|--------------|---------|
| `Agent.callModel()` — iteration | User-selected primary | Yes (all registered tools) | Main reasoning loop: decide which tools to call |
| `Agent.callModel()` — final answer | User-selected primary | No | Generate final answer from gathered data |
| `financial_search` router (`src/tools/finance/financial-search.ts:114`) | Same as outer agent | Yes (16 finance sub-tools) | Route NL query to appropriate financial API calls |
| `financial_metrics` router (`src/tools/finance/financial-metrics.ts:98`) | Same as outer agent | Yes (6 metrics sub-tools) | Route NL query to fundamental analysis tools |
| `read_filings` Step 1 (`src/tools/finance/read-filings.ts:114`) | Same as outer agent | Yes (`get_filings` only) | Select relevant SEC filings |
| `read_filings` Step 2 (`src/tools/finance/read-filings.ts:145`) | Same as outer agent | Yes (10K/10Q/8K item tools) | Select sections to read from filings |
| `InMemoryChatHistory.generateSummary()` (`src/utils/in-memory-chat-history.ts:73`) | Same as outer agent | No | Summarize previous answers for multi-turn context |
| `InMemoryChatHistory.selectRelevantMessages()` (`src/utils/in-memory-chat-history.ts:147`) | Same as outer agent | No (structured output) | Select which prior messages are relevant |
| Eval correctness judge (`src/evals/run.ts:199`) | `gpt-5.2` (hardcoded) | No (structured output) | Score agent answers against reference |

### Prompt Templates & System Instructions

**Main system prompt** (`src/agent/prompts.ts:103-161`):
- Identity: "You are Dexter, a CLI assistant with access to research tools"
- Injects current date, tool descriptions, skill metadata
- Tool usage policy: prefer `financial_search` over `web_search` for financial data; call once with full query
- Behavior guidelines: prioritize accuracy, professional tone, never ask users to provide raw data
- Response format: brief, no markdown headers, compact tables with abbreviations

**Iteration prompt** (`src/agent/prompts.ts:176-200`):
- Includes original query + all tool results gathered so far
- Injects tool usage status (call counts, limits) for graceful exit
- Instruction: "Continue working toward answering the query"

**Final answer prompt** (`src/agent/prompts.ts:210-220`):
- Includes original query + full context data from all tool results
- Instruction: "Answer the user's query using this data. Do not ask the user to provide additional data"

**Financial search router prompt** (`src/tools/finance/financial-search.ts:53-86`):
- Ticker resolution guidelines (Apple → AAPL)
- Date inference (relative → YYYY-MM-DD)
- Tool selection heuristics (snapshot vs. historical, which statement for which metric)

**Read filings prompts** (`src/tools/finance/read-filings.ts:27-91`):
- Step 1: filing type inference from query (risk factors → 10-K, quarterly → 10-Q)
- Step 2: item selection with canonical item names from API

### Token/Cost Management

- **Token estimation**: `estimateTokens()` in `src/utils/tokens.ts` — rough char/3.5 heuristic
- **Context threshold**: 100,000 estimated tokens triggers clearing of oldest tool results (`CONTEXT_THRESHOLD`)
- **Keep count**: 5 most recent tool results retained when clearing (`KEEP_TOOL_USES`)
- **Token budget**: 150,000 token max for final answer context (`TOKEN_BUDGET`, referenced but not enforced as a hard limit)
- **Token counter**: `TokenCounter` class in `src/agent/token-counter.ts` accumulates `usage_metadata` from provider responses
- **Anthropic prompt caching**: `buildAnthropicMessages()` in `src/model/llm.ts:165-178` marks system prompt with `cache_control: { type: 'ephemeral' }` — documented as ~90% input token cost reduction on subsequent calls
- **Retry with backoff**: `withRetry()` in `src/model/llm.ts:36-46` — 3 attempts, 500ms × 2^attempt delay

---

## 4. Output Generation

### Final Output Format

The agent produces a **plain text / markdown response** rendered in the terminal via Ink components. Output follows these constraints (from system prompt):
- No markdown headers or italics
- Bold used sparingly
- Compact markdown tables for comparative data (max 2-3 columns)
- Abbreviated metrics (Rev, OM, EPS, etc.)
- Tickers not company names in tables

### Synthesis Pipeline

1. **Tool results gathered** — stored in `Scratchpad` as JSONL entries
2. **Final answer trigger** — when the LLM returns no tool calls, or max iterations reached
3. **Full context assembly** — `buildFullContextForAnswer()` loads ALL tool results (including previously context-cleared ones) from Scratchpad
4. **Error filtering** — results starting with `Error:` are excluded from final context
5. **Context formatting** — each tool result formatted as `### {description}\n```json\n{data}\n` `` `
6. **Final LLM call** — `buildFinalAnswerPrompt()` with query + full context, no tools bound
7. **Answer extraction** — text content extracted from AIMessage
8. **Event emission** — `DoneEvent` includes answer, tool call records, iteration count, total time, token usage, tokens/second

### Quality Controls

| Control | Location | Mechanism |
|---------|----------|-----------|
| Tool call limits | `Scratchpad.canCallTool()` | Soft limit of 3 calls per tool per query; warns but never blocks |
| Query similarity detection | `Scratchpad.findSimilarQuery()` | Jaccard word-overlap similarity (threshold 0.7) to prevent retry loops |
| Skill deduplication | `Agent.executeToolCalls()` | Each skill runs at most once per query |
| Context overflow management | `Agent.run()` line 132-140 | Clears oldest tool results when estimated tokens > 100k |
| Max iterations | `Agent.run()` line 77 | Hard cap at 10 iterations (configurable) |
| Abort signal | `AgentConfig.signal` | User can cancel via Escape/Ctrl+C; propagated to LLM and tool calls |
| Cache validation | `cache.ts:isValidCacheEntry()` | Validates cache entry structure; deletes corrupted files |
| API error handling | `api.ts:46-69` | Network errors and non-200 responses throw with descriptive messages |

### Human-in-the-Loop

- **No explicit HITL checkpoints** during agent execution. The agent runs autonomously once a query is submitted.
- User can **cancel** mid-execution via Escape key (marks history item as "interrupted")
- User can **switch models** via `/model` command between queries
- **Eval system** provides post-hoc quality assessment via LLM-as-judge scoring

---

## 5. Infrastructure & Dependencies

### Runtime Requirements

- **Bun** (latest) — JavaScript/TypeScript runtime, used for execution, testing, and package management
- **Node.js** compatibility — LangChain and Playwright require Node-compatible APIs
- **Chromium** — installed via `playwright install chromium` (postinstall script)

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@langchain/core` | ^1.1.0 | Base abstractions for LLM, tools, prompts |
| `@langchain/openai` | ^1.1.3 | OpenAI + xAI + OpenRouter provider |
| `@langchain/anthropic` | ^1.1.3 | Anthropic Claude provider |
| `@langchain/google-genai` | ^2.0.0 | Google Gemini provider |
| `@langchain/ollama` | ^1.0.3 | Local Ollama provider |
| `@langchain/exa` | ^1.0.1 | Exa search integration |
| `@langchain/tavily` | ^1.0.1 | Tavily search fallback |
| `exa-js` | ^2.2.0 | Exa client SDK |
| `ink` | ^6.5.1 | React for CLI rendering |
| `react` | ^19.2.0 | UI framework (used via Ink) |
| `playwright` | ^1.52.0 | Headless browser automation |
| `zod` | ^4.1.13 | Schema validation for tool inputs/outputs |
| `dotenv` | ^17.2.3 | Environment variable loading |
| `gray-matter` | ^4.0.3 | YAML frontmatter parsing for SKILL.md files |
| `langsmith` | ^0.4.10 | LLM tracing and evaluation |

### Deployment Model

**Local-only CLI application.** No server, no cloud deployment, no Docker. Runs directly on the user's machine via `bun run start`.

### Required Environment Variables

**Minimum to run** (at least one LLM provider key):
- `OPENAI_API_KEY` (default provider) OR
- `ANTHROPIC_API_KEY` OR `GOOGLE_API_KEY` OR `XAI_API_KEY` OR `OPENROUTER_API_KEY`

**For financial data** (core functionality):
- `FINANCIAL_DATASETS_API_KEY`

**For web search** (optional, at least one):
- `EXASEARCH_API_KEY` (preferred)
- `TAVILY_API_KEY` (fallback)

**For tracing/evaluation** (optional):
- `LANGSMITH_API_KEY`, `LANGSMITH_ENDPOINT`, `LANGSMITH_PROJECT`, `LANGSMITH_TRACING`

**For local LLM** (optional):
- `OLLAMA_BASE_URL` (default: `http://127.0.0.1:11434`)

### Local Artifacts

| Path | Purpose | Git-tracked? |
|------|---------|-------------|
| `.env` | API keys | No (gitignored) |
| `.dexter/settings.json` | Persisted provider/model selection | No |
| `.dexter/cache/` | File-based API response cache | No |
| `.dexter/scratchpad/` | JSONL files per query (debugging/history) | No |

### CI/CD

GitHub Actions (`.github/workflows/ci.yml`):
- Triggers on push to `main` and PRs (with `run-ci` label gate)
- Matrix: `typecheck` (`tsc --noEmit`) and `test` (`bun test`)
- Uses `bun install --frozen-lockfile --ignore-scripts` (skips Playwright install in CI)

Release process (`scripts/release.sh`):
- CalVer versioning (`YYYY.M.D`)
- Bumps `package.json`, creates git tag, pushes, creates GitHub release via `gh` CLI

---

## 6. Strengths, Limitations & Notable Design Choices

### Strengths

**Hierarchical tool routing is well-designed.** The `financial_search` tool acts as a meta-tool: the outer agent calls it once with a natural language query, and an inner LLM call decides which of 16 sub-tools to invoke. This keeps the outer agent's tool choice space small (5-6 tools) while supporting rich financial data access. The same pattern in `read_filings` (two-step: find filings → read sections) is particularly elegant.

**Scratchpad as single source of truth.** `src/agent/scratchpad.ts` is an append-only JSONL log that serves both as context for the LLM and as a debugging artifact. The separation between in-memory context clearing (for token management) and persistent JSONL (for final answer and debugging) is a clean design. The `getFullContexts()` method loads everything for the final answer even if entries were cleared during iteration.

**Soft limits with guidance, not hard blocks.** Tool call limits (`canCallTool()`) warn the LLM that it's repeating itself and suggest alternatives, but never block execution. This is a pragmatic approach that avoids cutting off productive research while discouraging loops.

**Prompt caching for Anthropic.** The `buildAnthropicMessages()` function in `src/model/llm.ts:165-178` uses `cache_control: { type: 'ephemeral' }` on the system prompt, which can reduce input token costs by ~90% on subsequent calls within a session. This is a meaningful cost optimization.

**Progress channel pattern.** `src/utils/progress-channel.ts` implements a lightweight async-iterable queue that lets sub-agent tools (like `financial_search`) stream status updates ("Searching...", "Fetching from Income Statements...") back to the UI in real-time. This is a clean abstraction for bridging synchronous tool execution with the async event stream.

**Extensible skill system.** SKILL.md files with YAML frontmatter provide a natural way to add structured workflows. The DCF valuation skill (`src/skills/dcf/SKILL.md`) is a well-crafted 8-step checklist that includes validation steps, sector-specific WACC lookup, and sensitivity analysis.

**Conditional tool registration.** `src/tools/registry.ts` only registers `web_search` if an Exa or Tavily key is present, and only registers the `skill` tool if skills are discovered. This avoids exposing non-functional tools to the LLM.

### Limitations & Risks

**Browser launches with `headless: false`.** In `src/tools/browser/browser.ts:28`, the Playwright browser launches in headed mode (`headless: false`). This will fail in headless environments (CI, servers) and is likely a development artifact that should be configurable or default to `headless: true`.

**No rate limiting on API calls.** The `callApi()` function in `src/tools/finance/api.ts` has no rate limiting, backoff, or throttling. A complex query that triggers many parallel sub-tool calls (via `Promise.all()` in the router tools) could hit API rate limits. The only retry logic exists at the LLM call level (`withRetry` in `llm.ts`), not at the data API level.

**Cache has no TTL or eviction.** The file cache in `src/utils/cache.ts` persists indefinitely with no expiration. While the opt-in design (only caching immutable data like historical prices and SEC filings) mitigates staleness risk, the cache directory can grow unboundedly over time.

**Token estimation is rough.** `estimateTokens()` uses a flat `chars / 3.5` heuristic (`src/utils/tokens.ts:12`). This is adequate for threshold-based decisions but can be significantly off for JSON-heavy content (which is denser) vs. prose. The `TOKEN_BUDGET` constant (150k) is defined but not enforced as a hard limit anywhere in the code.

**`financial_search` and `financial_metrics` overlap.** Both tools route to overlapping sub-tool sets (e.g., both include `getIncomeStatements`, `getBalanceSheets`, `getKeyRatios`). The system prompt tries to differentiate them, but the LLM could call either for the same query, wasting tokens on a redundant inner LLM call.

**No authentication/authorization on the CLI.** API keys entered interactively via the CLI are written directly to `.env` in plaintext (`src/utils/env.ts:62-108`). There's no encryption or secure storage.

**Eval system hardcodes `gpt-5.2`.** The evaluation runner (`src/evals/run.ts:145,166`) hardcodes `gpt-5.2` for both the target agent and the correctness judge. This means evaluations always test OpenAI regardless of what provider the user normally uses.

**`_snapshotForAI` is an internal Playwright API.** The browser tool (`src/tools/browser/browser.ts:18-20`) uses `page._snapshotForAI()`, which is a private/undocumented Playwright method (note the underscore prefix). This could break on Playwright upgrades. There is a fallback to `ariaSnapshot()`.

**No streaming of final answer.** The final answer is generated in a single LLM call and returned as a complete string. For long answers, this means the user sees nothing until the entire response is ready. The `answer_start` event is emitted before the call, but actual content only arrives with the `done` event.

### Dead Code & TODOs

- `DEFAULT_SYSTEM_PROMPT` (`src/agent/prompts.ts:53-90`) is exported but only used as a fallback in `callLlm()` when no `systemPrompt` option is provided. It duplicates content from `buildSystemPrompt()` with slightly different wording (missing tool descriptions, skills section).
- The `getApiKey()` function in `src/model/llm.ts:55-61` accepts a `providerName` parameter that is never used in the function body.
- `TOKEN_BUDGET` (`src/utils/tokens.ts:19`) is exported but never imported or used elsewhere in the codebase.
- `InMemoryChatHistory.selectRelevantMessages()` and `formatForPlanning()`/`formatForAnswerGeneration()` are defined but the agent only uses `getUserMessages()` for building the initial prompt (`Agent.buildInitialPrompt()`). The more sophisticated relevance-based message selection is unused.
- `Scratchpad.getActiveToolResults()` and `getActiveToolResultCount()` are defined but never called from outside the class.
- `useTextBuffer` hook exists in `src/hooks/` but is not imported anywhere in the codebase.

### Architectural Notes

- **No dependency injection.** Components are tightly coupled via direct imports. The `Agent` class creates tools internally via `getTools()` rather than accepting them as constructor parameters. This makes unit testing harder.
- **Agent is recreated per query.** `useAgentRunner.ts:170` calls `Agent.create()` for every user query. This is simple but means tool registration and system prompt building happen repeatedly.
- **All sub-tool LLM calls use the same model as the outer agent.** The `model` parameter is passed through to router tools, so if a user selects an expensive model, every inner routing call also uses it. The `FAST_MODELS` map exists but is not used for inner routing calls.
- **Browser state is global.** `src/tools/browser/browser.ts` uses module-level `let browser` and `let page` variables. Multiple concurrent agent runs would share browser state, though this is unlikely given the single-user CLI design.

---

## Appendix: File Index

```
src/
├── index.tsx                          Entry point
├── cli.tsx                            CLI React shell
├── theme.ts                           UI theme constants
├── agent/
│   ├── agent.ts                       Core agent loop (367 lines)
│   ├── prompts.ts                     System/iteration/final prompts (222 lines)
│   ├── scratchpad.ts                  JSONL state tracking (513 lines)
│   ├── token-counter.ts               Token accumulator (33 lines)
│   └── types.ts                       Event type definitions (137 lines)
├── model/
│   └── llm.ts                         Multi-provider LLM abstraction (219 lines)
├── tools/
│   ├── registry.ts                    Tool registration (101 lines)
│   ├── types.ts                       Tool result formatting (53 lines)
│   ├── skill.ts                       Skill tool (62 lines)
│   ├── browser/browser.ts             Playwright scraper (318 lines)
│   ├── finance/
│   │   ├── api.ts                     Financial API client (77 lines)
│   │   ├── financial-search.ts        Router to 16 sub-tools (188 lines)
│   │   ├── financial-metrics.ts       Router to 6 metrics tools (172 lines)
│   │   ├── read-filings.ts            Two-step filing reader (216 lines)
│   │   ├── filings.ts                 SEC filing tools (150 lines)
│   │   ├── fundamentals.ts            Income/balance/cash flow (100 lines)
│   │   ├── prices.ts                  Stock price tools (62 lines)
│   │   ├── key-ratios.ts              Key financial ratios
│   │   ├── estimates.ts               Analyst estimates
│   │   ├── news.ts                    Company news
│   │   ├── segments.ts                Revenue segments
│   │   ├── crypto.ts                  Cryptocurrency data (72 lines)
│   │   ├── insider_trades.ts          Insider trading (53 lines)
│   │   └── company_facts.ts           Company metadata
│   ├── search/
│   │   ├── exa.ts                     Exa search (36 lines)
│   │   └── tavily.ts                  Tavily fallback (28 lines)
│   └── descriptions/                  Rich tool descriptions for system prompt
├── skills/
│   ├── registry.ts                    Skill discovery (125 lines)
│   ├── loader.ts                      SKILL.md parser (73 lines)
│   └── dcf/
│       ├── SKILL.md                   DCF valuation workflow (127 lines)
│       └── sector-wacc.md             WACC lookup table
├── hooks/
│   ├── useAgentRunner.ts              Agent lifecycle hook (243 lines)
│   ├── useModelSelection.ts           Model/provider selection
│   ├── useInputHistory.ts             Input history navigation
│   ├── useDebugLogs.ts                Debug log management
│   └── useTextBuffer.ts               Text buffering (unused)
├── components/                        Ink/React UI components (13 files)
├── evals/
│   ├── run.ts                         LangSmith evaluation runner (355 lines)
│   ├── dataset/finance_agent.csv      Q&A evaluation dataset
│   └── components/                    Eval UI components (5 files)
└── utils/
    ├── cache.ts                       File-based API cache (188 lines)
    ├── config.ts                      Settings persistence (91 lines)
    ├── env.ts                         Environment/API key management (114 lines)
    ├── in-memory-chat-history.ts      Multi-turn conversation (224 lines)
    ├── tokens.ts                      Token estimation constants (36 lines)
    ├── progress-channel.ts            Async progress streaming (84 lines)
    ├── logger.ts                      Debug logger singleton (67 lines)
    ├── ai-message.ts                  AIMessage parsing
    ├── markdown-table.ts              JSON → markdown table
    ├── tool-description.ts            Tool display names
    ├── ollama.ts                      Ollama integration utils
    └── thinking-verbs.ts              UI thinking messages
```
