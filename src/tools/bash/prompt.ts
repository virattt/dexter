/**
 * Rich description for the bash tool, injected into the system prompt.
 */
export const BASH_TOOL_DESCRIPTION = `
Run a shell command via \`/bin/sh -c\` and get back its stdout, stderr, and exit code.

## When to Use

- Inspecting the local filesystem or repo (ls, find, grep/rg, stat, wc, git status/log/diff)
- Running project tooling (build scripts, test runners, formatters, linters)
- Quick local data wrangling on files you already have (sort, uniq, head/tail, jq)
- Anything that genuinely needs a shell and has no dedicated tool

## When NOT to Use

- Reading a single file you know the path of — use read_file (it is cheaper and clearer)
- Fetching web pages or APIs — use web_fetch / web_search (bash has no network sandbox)
- Structured financial data, prices, or filings — use get_financials / get_market_data / read_filings
- Interactive programs (vim, a REPL, ssh sessions) — bash captures output only, no interactivity
- Long-running daemons — they will hit the timeout; schedule recurring work with the cron tool

## Schema

- **command** (required): the shell command to run
- **timeout** (optional): hard timeout in milliseconds (default 120000, max 600000)
- **description** (optional): a short (3-7 word) summary of what the command does, shown in the approval prompt

## Returns

JSON with: command, stdout, stderr, exitCode, interrupted, timedOut, truncated, durationMs.

## Usage Notes

- **CLI only.** This tool is not available over the WhatsApp gateway or to subagents.
- **Every command asks for approval** before it runs. Keep commands simple and legible so the
  approval is easy to read; the user sees the exact command.
- Runs in the current working directory. There is no OS sandbox yet, so the command runs with
  your normal permissions — prefer read-only commands and avoid destructive ones.
- Output over ~256KB is truncated (and the command killed); results over 50KB are spilled to disk
  and previewed — use read_file to read the full output if needed.
- On timeout or interruption the whole process group is terminated, so background children are
  cleaned up too.
`.trim();
