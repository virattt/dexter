# Repository Guidelines

- Repo: https://github.com/yuya-sugita/dexter-for-forex
- Dexter for Forex is a CLI-based AI agent for FX, indices, and commodity trade analysis, optimized for Fintokei prop trading. Built with TypeScript, Ink (React for CLI), and LangChain.

## Project Structure

- Source code: `src/`
  - Agent core: `src/agent/` (agent loop, prompts, scratchpad, token counting, types)
  - CLI interface: `src/cli.tsx` (Ink/React), entry point: `src/index.tsx`
  - Components: `src/components/` (Ink UI components)
  - Hooks: `src/hooks/` (React hooks for agent runner, model selection, input history)
  - Model/LLM: `src/model/llm.ts` (multi-provider LLM abstraction)
  - Tools: `src/tools/` (forex/CFD tools, web search, browser, skill tool)
  - Forex tools: `src/tools/forex/` (market data, technical analysis, economic calendar, Fintokei rules, trade journal)
  - Search tools: `src/tools/search/` (Exa preferred, Perplexity, Tavily fallback)
  - Browser: `src/tools/browser/` (Playwright-based web scraping)
  - Skills: `src/skills/` (SKILL.md-based extensible workflows: trade-analysis, fintokei-challenge, risk-management)
  - Utils: `src/utils/` (env, config, caching, token estimation, markdown tables)
  - Evals: `src/evals/` (LangSmith evaluation runner with Ink UI)
- Config: `.dexter/settings.json` (persisted model/provider selection)
- Trade Journal: `.dexter/journal/trades.json` (trade records)
- Environment: `.env` (API keys; see `env.example`)
- Scripts: `scripts/release.sh`

## Build, Test, and Development Commands

- Runtime: Bun (primary). Use `bun` for all commands.
- Install deps: `bun install`
- Run: `bun run start` or `bun run src/index.tsx`
- Dev (watch mode): `bun run dev`
- Type-check: `bun run typecheck`
- Tests: `bun test`
- Evals: `bun run src/evals/run.ts` (full) or `bun run src/evals/run.ts --sample 10` (sampled)
- CI runs `bun run typecheck` and `bun test` on push/PR.

## Coding Style & Conventions

- Language: TypeScript (ESM, strict mode). JSX via React (Ink for CLI rendering).
- Prefer strict typing; avoid `any`.
- Keep files concise; extract helpers rather than duplicating code.
- Add brief comments for tricky or non-obvious logic.
- Do not add logging unless explicitly asked.
- Do not create README or documentation files unless explicitly asked.

## LLM Providers

- Supported: OpenAI (default), Anthropic, Google, xAI (Grok), Moonshot, DeepSeek, OpenRouter, Ollama (local).
- Default model: `gpt-5.4`. Provider detection is prefix-based (`claude-` -> Anthropic, `gemini-` -> Google, etc.).
- Fast models for lightweight tasks: see `FAST_MODELS` map in `src/model/llm.ts`.
- Anthropic uses explicit `cache_control` on system prompt for prompt caching cost savings.
- Users switch providers/models via `/model` command in the CLI.

## Tools

- `get_market_data`: meta-tool for all market data queries (prices, historical OHLCV, technical indicators). Routes to sub-tools internally.
- `economic_calendar`: fetches upcoming economic events with impact levels and affected instruments.
- `get_fintokei_rules`: Fintokei challenge rules (profit targets, drawdown limits, daily loss limits).
- `calculate_position_size`: position sizing respecting per-trade risk and Fintokei daily loss limits.
- `check_account_health`: account health evaluation against challenge rules.
- `record_trade` / `close_trade`: trade journal entry and exit recording.
- `get_trade_stats` / `get_trade_history`: trading performance analysis and history.
- `web_search`: general web search (Exa if `EXASEARCH_API_KEY` set, else Perplexity/Tavily).
- `browser`: Playwright-based web scraping for reading pages the agent discovers.
- `skill`: invokes SKILL.md-defined workflows. Each skill runs at most once per query.
- Tool registry: `src/tools/registry.ts`. Tools are conditionally included based on env vars.

## Skills

- Skills live as `SKILL.md` files with YAML frontmatter (`name`, `description`) and markdown body (instructions).
- Built-in skills:
  - `src/skills/trade-analysis/SKILL.md` — Multi-timeframe trade analysis with confluence scoring
  - `src/skills/fintokei-challenge/SKILL.md` — Fintokei challenge tracking and management
  - `src/skills/risk-management/SKILL.md` — Advanced risk management and position sizing
- Discovery: `src/skills/registry.ts` scans for SKILL.md files at startup.
- Skills are exposed to the LLM as metadata in the system prompt; the LLM invokes them via the `skill` tool.

## Agent Architecture

- Agent loop: `src/agent/agent.ts`. Iterative tool-calling loop with configurable max iterations (default 10).
- Scratchpad: `src/agent/scratchpad.ts`. Single source of truth for all tool results within a query.
- Context management: Anthropic-style. Full tool results kept in context; oldest results cleared when token threshold exceeded.
- Final answer: generated in a separate LLM call with full scratchpad context (no tools bound).
- Events: agent yields typed events (`tool_start`, `tool_end`, `thinking`, `answer_start`, `done`, etc.) for real-time UI updates.

## Fintokei Instrument Coverage

- FX Majors: EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD
- FX Minors/Crosses: EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, and 15+ more
- Stock Indices: JP225, US30, US500, NAS100, GER40, UK100, FRA40, AUS200, HK50
- Commodities: XAUUSD (Gold), XAGUSD (Silver), USOIL (WTI), UKOIL (Brent)
- Instrument mapping and pip sizes defined in `src/tools/forex/api.ts`

## Environment Variables

- LLM keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `MOONSHOT_API_KEY`, `DEEPSEEK_API_KEY`
- Ollama: `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`)
- Market Data: `TWELVE_DATA_API_KEY` (prices, indicators, economic calendar)
- Search: `EXASEARCH_API_KEY` (preferred), `PERPLEXITY_API_KEY`, `TAVILY_API_KEY` (fallbacks)
- Tracing: `LANGSMITH_API_KEY`, `LANGSMITH_ENDPOINT`, `LANGSMITH_PROJECT`, `LANGSMITH_TRACING`
- Never commit `.env` files or real API keys.

## Version & Release

- Version format: CalVer `YYYY.M.D` (no zero-padding). Tag prefix: `v`.
- Release script: `bash scripts/release.sh [version]` (defaults to today's date).
- Release flow: bump version in `package.json`, create git tag, push tag, create GitHub release via `gh`.
- Do not push or publish without user confirmation.

## Testing

- Framework: Bun's built-in test runner (primary), Jest config exists for legacy compatibility.
- Tests colocated as `*.test.ts`.
- Run `bun test` before pushing when you touch logic.

## Security

- API keys stored in `.env` (gitignored). Users can also enter keys interactively via the CLI.
- Config stored in `.dexter/settings.json` (gitignored).
- Trade journal stored in `.dexter/journal/` (gitignored).
- Never commit or expose real API keys, tokens, or credentials.
