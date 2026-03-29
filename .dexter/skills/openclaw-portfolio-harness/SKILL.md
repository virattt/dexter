---
name: openclaw-portfolio-harness
description: Use when OpenClaw needs to validate portfolio config, run Dexter portfolio analysis from the CLI, choose a model/provider such as Moonshot Kimi, sync daily portfolio jobs, and parse the resulting JSON contract.
---

# OpenClaw Portfolio Harness

Use this skill when the task is operational rather than conversational:
- validating `.dexter/portfolios.json`
- listing available portfolios
- running one portfolio or all enabled portfolios
- selecting a model/provider for the run
- syncing daily portfolio cron jobs
- consuming structured JSON from stdout

## Workflow

1. Validate configuration first.
2. If the portfolio id is unknown, list portfolios.
3. Run the requested portfolio command with `--json`.
4. Parse stdout as JSON and inspect `ok`, `model`, and `diagnostics.errors`.
5. Treat non-zero exit codes as failures.

## Commands

Validate:

```bash
dexter portfolio validate --json
```

List portfolios:

```bash
dexter portfolio list --json
```

Run one portfolio:

```bash
dexter portfolio run <portfolio-id> --json
```

Run one portfolio with Kimi:

```bash
dexter portfolio run <portfolio-id> --json --provider moonshot
```

or:

```bash
dexter portfolio run <portfolio-id> --json --model kimi-k2-5
```

Run all enabled portfolios:

```bash
dexter portfolio run-all --json --provider moonshot
```

Sync daily portfolio jobs:

```bash
dexter portfolio sync-jobs --json
```

Run a synced portfolio job manually:

```bash
dexter portfolio run-job <job-id> --json
```

## Model Guidance

- Prefer tool-capable providers for portfolio analysis because current market/news/filing data matters.
- Moonshot/Kimi is supported. Use `--provider moonshot` or `--model kimi-k2-5`.
- Do not use the Codex provider for portfolio-analysis runs. Dexter rejects it because the current Codex path is tool-free.
- If `--model` and `--provider` are both passed, they must match. For example, `kimi-k2-5` must pair with `moonshot`.

## Output Contract

Portfolio commands return JSON to stdout.

Successful runs include:
- `ok`
- `run_id`
- `generated_at`
- `trigger`
- `portfolio`
- `model`
- `summary`
- `holdings`
- `portfolio_highlights`
- `diagnostics`
- `final_text`

Failure responses still return JSON. Check:
- `error.code`
- `error.message`
- non-zero exit code

## Operating Rules

- Always pass `--json`.
- Prefer `validate` before `run` if the config may have changed.
- For automation, rely on stdout JSON rather than scraping human-readable text.
- If a run completes with `ok: false`, inspect `diagnostics.errors` before retrying.
