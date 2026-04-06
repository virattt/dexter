# STATE.md

## Purpose
- Set up and adapt upstream `virattt/dexter` so it can be used locally with our OpenClaw-based LLM path and evaluated for a lower-cost free-data path.

## Goal
- Keep a usable local clone, reduce separate LLM key management, and validate whether a practical US-only free-data mode can cover Dexter's core research flows.

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
- Re-ran `bun run typecheck` and `bun test` after the POC changes; both passed.

## Current status
- Branch `feat/openclaw-bridge` still tracks `fork/feat/openclaw-bridge` at pushed commit `46e39dc`.
- Local working tree now contains an unpushed Free-US POC implementation (`package.json`, `scripts/free-us-poc.ts`, `src/tools/finance/free-us-poc.ts`, `notes/free-source-probe-2026-04-06.md`, `STATE.md`).
- A partial **US-only free-data mode** is now proven viable for:
  - price snapshot + short history
  - filings metadata and raw filing URLs
  - core financial facts from SEC `companyfacts`
  - basic company news via Google News RSS
- The hard remaining gaps are screener-quality normalized datasets and polished insider-trade parsing.

## Branch / baseline
- Tracking `fork/feat/openclaw-bridge`.
- Pushed baseline: `46e39dc` on 2026-04-05 22:03 JST — `feat: add OpenClaw Codex provider integration`.
- Local branch has additional unpushed POC changes.

## Last verified
- 2026-04-06 09:36 JST

## Last action
- Ran `bun run poc:free-us -- AAPL TSLA`, confirmed live outputs from Yahoo/SEC/Google, and then re-ran `bun run typecheck` and `bun test` successfully.

## Next actions
- Decide whether to keep the Free-US POC as a standalone script or wire it behind an env flag such as `DEXTER_FREE_US_MODE=1`.
- If wiring into tools, replace `get_stock_price` / `get_stock_prices` first, then `get_filings`, then a reduced `get_all_financial_statements`.
- If insider activity matters, add a parser for SEC Form 4 transaction tables.

## Blockers
- No free near-term drop-in was found for screener-quality broad normalized data.
- SEC `companyfacts` needs concept-mapping / normalization logic if promoted from POC to production tool paths.
- Google News RSS and Yahoo endpoints are workable but less stable/clean than a paid normalized provider.

## Commands
- `git status --short --branch`
- `git log -1 --oneline --decorate`
- `git rev-list --left-right --count @{upstream}...HEAD`
- `git diff --stat`
- `export PATH="$HOME/.bun/bin:$PATH" && bun run typecheck`
- `export PATH="$HOME/.bun/bin:$PATH" && bun test`
- `export PATH="$HOME/.bun/bin:$PATH" && bun run poc:free-us -- AAPL TSLA`

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
