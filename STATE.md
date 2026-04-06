# STATE.md

## Purpose
- Set up and adapt upstream `virattt/dexter` so it can be used locally with our OpenClaw-based LLM path and evaluated for a lower-cost free-data path.

## Goal
- Make Dexter answer natural-language US equity comparison requests in this environment even without `FINANCIAL_DATASETS_API_KEY`, especially queries like comparing AAPL vs TSLA on fundamentals, recent price moves, and ranking them for investment priority.

## Done
- Cloned `https://github.com/virattt/dexter.git` into `dexter`.
- Installed Bun `1.3.11` under `~/.bun/bin/bun`.
- Installed repo dependencies with `bun install`.
- Installed Playwright Chromium/FFmpeg via repo `postinstall`.
- Verified baseline `bun run typecheck` and `bun test` (`37 pass`, `0 fail`).
- Added `scripts/ask-openclaw.ts`, a headless runner that reuses the local OpenClaw main-agent `openai-codex` OAuth profile.
- Added `bun run ask:openclaw -- ...` package script plus README / `env.example` docs for the headless bridge.
- Forked the repo to `https://github.com/nabewo02/dexter` and pushed branch `feat/openclaw-bridge`.
- Added provider-level OpenClaw integration in `src/model/openclaw-bridge.ts`, `src/model/llm.ts`, `src/providers.ts`, and `src/utils/model.ts`.
- Added interactive provider selection entry `OpenClaw Codex` so Dexter can use OpenClaw OAuth from the normal TUI path.
- Re-verified after the integration with `bun run typecheck`, `bun test`, simple prompt smoke test, structured-output smoke test, and tool-call smoke test.
- Launched `bun start` with `.dexter/settings.json` set to `openai-codex:gpt-5.4` and confirmed the interactive TUI answered `OK` to `Reply with OK only.`.
- Committed and pushed the TUI/core integration as `46e39dc feat: add OpenClaw Codex provider integration`.
- Probed free replacement candidates for `Financial Datasets` and documented the results in `notes/free-source-probe-2026-04-06.md`.
- Added a reusable Free-US POC module `src/tools/finance/free-us-poc.ts` and CLI `scripts/free-us-poc.ts` with package script `bun run poc:free-us -- ...`.
- Verified the Free-US POC live against Yahoo Finance `chart`, SEC `company_tickers` / `companyfacts` / `submissions` / `Archives`, and Google News RSS.
- Ran the POC for `AAPL` and `TSLA`, successfully retrieving price snapshots, recent bars, filings metadata, core financial facts, and news headlines.
- Wired the Free-US fallback into production-facing finance tools when `FINANCIAL_DATASETS_API_KEY` is absent or `DEXTER_FREE_US_MODE=1` is set:
  - `get_stock_price`
  - `get_stock_prices`
  - `get_available_stock_tickers`
  - `get_company_news`
  - `get_filings`
  - `get_income_statements`
  - `get_balance_sheets`
  - `get_cash_flow_statements`
  - `get_all_financial_statements`
  - `get_key_ratios`
  - `get_historical_key_ratios`
  - `get_earnings`
- Fixed `ask:openclaw` so its inner meta-tools also use `openai-codex:*` instead of plain `gpt-5.4`, removing the hidden `OPENAI_API_KEY` dependency in routed finance queries.
- Strengthened `ask:openclaw` finance instructions so stock-comparison / ranking queries must try `get_financials` / `get_market_data` before declaring data unavailable.
- Verified end-to-end with this natural-language query:
  - `AAPLとTSLAのファンダメンタル分析をして、直近の株価と1か月変化率も踏まえて投資優先順位を1位と2位で決めてください。理由は売上成長率、利益率、利益水準、価格モメンタムを分けて比較してください。`
- Confirmed the tool-driven answer now returns a numeric AAPL vs TSLA ranking with price, 1-month move, growth, margins, and profit-level comparisons.
- Re-ran `bun run typecheck` and `bun test` after the fallback wiring; both passed.

## Current status
- Branch `feat/openclaw-bridge` tracks `fork/feat/openclaw-bridge` and is locally ahead with unpushed Free-US work.
- Dexter can now answer the target US-equity comparison workflow in this environment without `FINANCIAL_DATASETS_API_KEY`, as long as the request can be covered by the Free-US sources.
- Practical supported path today:
  - current/1-month price and recent bars via Yahoo `chart`
  - filings metadata via SEC `submissions`
  - core financial statement rows and derived metrics via SEC `companyfacts`
  - basic company news via Google News RSS
- Remaining weak areas:
  - screener-quality normalized datasets
  - full filing item extraction / section parsing
  - polished insider transaction parsing from Form 4

## Branch / baseline
- Tracking `fork/feat/openclaw-bridge`.
- Pushed baseline: `46e39dc` on 2026-04-05 22:03 JST — `feat: add OpenClaw Codex provider integration`.
- Local branch contains additional Free-US POC and fallback-integration work not yet pushed.

## Last verified
- 2026-04-06 12:30:34 JST

## Last action
- Re-ran `bun run ask:openclaw -- "AAPLとTSLAのファンダメンタル分析をして…"` and confirmed it now returns a numeric ranking backed by live Yahoo/SEC/Google data instead of claiming API-key blockage.

## Next actions
- Commit and optionally push the Free-US fallback integration.
- If the fallback proves stable, add a small README section explaining the no-`FINANCIAL_DATASETS_API_KEY` US-only mode.
- If needed for deeper analysis, add SEC Form 4 transaction parsing and filing-section extraction.

## Blockers
- No free near-term drop-in was found for screener-quality broad normalized data.
- SEC `companyfacts` is good enough for core comparison, but still less polished and less globally consistent than a paid normalized provider.
- Yahoo / Google News RSS are usable but may be brittle versus paid APIs.

## Commands
- `export PATH="$HOME/.bun/bin:$PATH" && bun run typecheck`
- `export PATH="$HOME/.bun/bin:$PATH" && bun test`
- `export PATH="$HOME/.bun/bin:$PATH" && bun run poc:free-us -- AAPL TSLA`
- `export PATH="$HOME/.bun/bin:$PATH" && bun run ask:openclaw -- "AAPLとTSLAのファンダメンタル分析をして…"`

## Artifacts
- Local clone: `/home/openclaw/.openclaw/workspace/dexter`
- Fork: `https://github.com/nabewo02/dexter`
- Branch: `https://github.com/nabewo02/dexter/tree/feat/openclaw-bridge`
- Latest pushed commit: `46e39dc`
- Free-source probe note: `/home/openclaw/.openclaw/workspace/dexter/notes/free-source-probe-2026-04-06.md`
- Free-US POC module: `/home/openclaw/.openclaw/workspace/dexter/src/tools/finance/free-us-poc.ts`
- Free-US POC CLI: `/home/openclaw/.openclaw/workspace/dexter/scripts/free-us-poc.ts`
- Bun binary: `~/.bun/bin/bun`
- Playwright cache: `~/.cache/ms-playwright/`
